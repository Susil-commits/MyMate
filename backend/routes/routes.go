package routes

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"mymate-backend/config"
	"mymate-backend/controllers"
	"mymate-backend/middleware"
	"mymate-backend/socket"
)

var startTime = time.Now()

func SetupRoutes(r *gin.Engine) {
	// Global Middleware
	r.Use(gin.Recovery())

	// Security & correlation headers
	r.Use(func(c *gin.Context) {
		corrID := c.GetHeader("X-Correlation-Id")
		if corrID == "" {
			corrID = fmt.Sprintf("corr_%d", time.Now().UnixNano())
		}
		c.Header("X-Correlation-Id", corrID)
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Cross-Origin-Resource-Policy", "cross-origin")
		c.Next()
	})

	r.Use(middleware.CORSMiddleware())

	// Static uploads directory
	r.Static("/uploads", "./uploads")

	// Liveness Check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "ok",
			"uptime":    time.Since(startTime).Seconds(),
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	})

	// Readiness Check
	r.GET("/health/ready", func(c *gin.Context) {
		dependencies := make(map[string]gin.H)
		isReady := true

		// 1. Check MongoDB
		mongoStart := time.Now()
		ctxMongo, cancelMongo := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancelMongo()

		if config.DB != nil {
			err := config.DB.Client().Ping(ctxMongo, nil)
			if err == nil {
				dependencies["mongodb"] = gin.H{
					"status":    "ok",
					"latencyMs": time.Since(mongoStart).Milliseconds(),
				}
			} else {
				isReady = false
				dependencies["mongodb"] = gin.H{"status": "error", "message": err.Error()}
			}
		} else {
			isReady = false
			dependencies["mongodb"] = gin.H{"status": "error", "message": "database client is nil"}
		}

		// 2. Check Redis
		if config.AppConfig.DisableRedis {
			dependencies["redis"] = gin.H{"status": "ok", "message": "disabled"}
		} else if config.RedisClient != nil {
			redisStart := time.Now()
			ctxRedis, cancelRedis := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancelRedis()
			_, err := config.RedisClient.Ping(ctxRedis).Result()
			if err == nil {
				dependencies["redis"] = gin.H{
					"status":    "ok",
					"latencyMs": time.Since(redisStart).Milliseconds(),
				}
			} else {
				isReady = false
				dependencies["redis"] = gin.H{"status": "error", "message": err.Error()}
			}
		} else {
			dependencies["redis"] = gin.H{"status": "ok", "message": "not_configured"}
		}

		// 3. Check Kafka
		if !config.AppConfig.KafkaEnabled {
			dependencies["kafka"] = gin.H{"status": "ok", "message": "disabled"}
		} else if config.IsKafkaConnected() {
			dependencies["kafka"] = gin.H{"status": "ok"}
		} else {
			isReady = false
			dependencies["kafka"] = gin.H{"status": "error", "message": "producer_disconnected"}
		}

		statusStr := "ready"
		httpCode := http.StatusOK
		if !isReady {
			statusStr = "unready"
			httpCode = http.StatusServiceUnavailable
		}

		c.JSON(httpCode, gin.H{
			"status":       statusStr,
			"uptime":       time.Since(startTime).Seconds(),
			"timestamp":    time.Now().UTC().Format(time.RFC3339),
			"dependencies": dependencies,
		})
	})

	// Root info endpoint
	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"name":   "MyMate API",
			"status": "running",
			"docs":   "/api",
			"health": "/health",
		})
	})

	// Webhooks bypass CSRF & JSON limits
	r.POST("/api/v1/payments/webhook", controllers.VerifyWebhook)
	r.POST("/api/payments/webhook", controllers.VerifyWebhook)

	// Socket.IO handlers
	socketHandler := socket.Handler()
	r.GET("/socket.io/*any", socketHandler)
	r.POST("/socket.io/*any", socketHandler)

	// API Endpoints: Mount on both /api/v1 and /api for 100% backward compatibility
	v1Group := r.Group("/api/v1")
	v1Group.Use(middleware.GeneralLimiter())
	v1Group.Use(middleware.CSRFProtection())
	registerEndpoints(v1Group)

	apiGroup := r.Group("/api")
	apiGroup.Use(middleware.GeneralLimiter())
	apiGroup.Use(middleware.CSRFProtection())
	registerEndpoints(apiGroup)

	// 404 Handler
	r.NoRoute(func(c *gin.Context) {
		c.JSON(http.StatusNotFound, gin.H{
			"message": fmt.Sprintf("Route not found: %s %s", c.Request.Method, c.Request.URL.Path),
		})
	})
}

func registerEndpoints(rg *gin.RouterGroup) {
	// /auth
	auth := rg.Group("/auth")
	{
		auth.POST("/user/register", middleware.AuthLimiter(), controllers.UserRegister)
		auth.POST("/user/login", middleware.AuthLimiter(), controllers.UserLogin)
		auth.PUT("/user/complete-profile", middleware.Protect(), middleware.AuthorizeUser(), controllers.CompleteUserProfile)

		auth.POST("/driver/register", middleware.AuthLimiter(), controllers.DriverRegister)
		auth.POST("/driver/login", middleware.AuthLimiter(), controllers.DriverLogin)
		auth.PUT("/driver/complete-profile", middleware.Protect(), middleware.AuthorizeDriver(), controllers.CompleteDriverProfile)

		auth.POST("/admin/login", middleware.AuthLimiter(), controllers.AdminLogin)
		auth.GET("/me", middleware.OptionalAuth(), controllers.GetMe)

		auth.POST("/forgot-password", middleware.AuthLimiter(), controllers.ForgotPassword)
		auth.POST("/reset-password", middleware.AuthLimiter(), controllers.ResetPassword)
		auth.POST("/verify-email", controllers.VerifyEmail)
		auth.POST("/resend-verification", middleware.AuthLimiter(), controllers.ResendVerification)
		auth.GET("/csrf-token", controllers.GetCsrfToken)

		auth.POST("/logout", controllers.Logout)
		auth.POST("/logout-all", middleware.Protect(), controllers.LogoutAll)
	}

	// /users
	users := rg.Group("/users")
	{
		users.PUT("/change-password", middleware.Protect(), middleware.AuthorizeUserOrDriver(), controllers.ChangePassword)
		users.GET("/profile", middleware.Protect(), middleware.AuthorizeUser(), controllers.GetUserProfile)
		users.PUT("/profile", middleware.Protect(), middleware.AuthorizeUser(), controllers.UpdateUserProfile)
	}

	// /drivers
	drivers := rg.Group("/drivers")
	{
		drivers.GET("", controllers.GetDrivers)
		drivers.GET("/", controllers.GetDrivers)
		drivers.GET("/stats", controllers.GetPublicStats)
		drivers.GET("/wallet", middleware.Protect(), middleware.AuthorizeDriver(), controllers.GetDriverWallet)
		drivers.PUT("/profile", middleware.Protect(), middleware.AuthorizeDriver(), controllers.UpdateDriverProfile)
		drivers.GET("/:id", controllers.GetDriverByID)
	}

	// /bookings
	bookings := rg.Group("/bookings")
	{
		bookings.POST("", middleware.Protect(), middleware.AuthorizeUser(), middleware.Idempotency(), controllers.CreateBooking)
		bookings.POST("/", middleware.Protect(), middleware.AuthorizeUser(), middleware.Idempotency(), controllers.CreateBooking)
		bookings.GET("/user", middleware.Protect(), middleware.AuthorizeUser(), controllers.GetUserBookings)
		bookings.GET("/driver", middleware.Protect(), middleware.AuthorizeDriver(), controllers.GetDriverBookings)
		bookings.GET("/driver/stats", middleware.Protect(), middleware.AuthorizeDriver(), controllers.GetDriverStats)
		bookings.GET("/:id", middleware.Protect(), controllers.GetBookingByID)
		bookings.PUT("/:id/status", middleware.Protect(), middleware.Idempotency(), controllers.UpdateBookingStatus)
		bookings.GET("/:id/calendar", middleware.Protect(), controllers.DownloadCalendar)
		bookings.GET("/:id/calendar.ics", middleware.Protect(), controllers.DownloadCalendar)
		bookings.GET("/:id/invoice", middleware.Protect(), controllers.DownloadInvoice)
		bookings.GET("/:id/invoice.pdf", middleware.Protect(), controllers.DownloadInvoice)
	}

	// /reviews
	reviews := rg.Group("/reviews")
	{
		reviews.POST("", middleware.Protect(), middleware.AuthorizeUser(), controllers.CreateReview)
		reviews.POST("/", middleware.Protect(), middleware.AuthorizeUser(), controllers.CreateReview)
		reviews.GET("/driver/:driverId", controllers.GetDriverReviews)
		reviews.GET("/booking/:bookingId", middleware.Protect(), controllers.GetBookingReview)
		reviews.PUT("/:id", middleware.Protect(), middleware.AuthorizeUser(), controllers.UpdateReview)
		reviews.DELETE("/:id", middleware.Protect(), middleware.AuthorizeUser(), controllers.DeleteReview)
	}

	// /payments
	payments := rg.Group("/payments")
	{
		payments.POST("/create-order", middleware.Protect(), middleware.AuthorizeUser(), middleware.PaymentLimiter(), middleware.Idempotency(), controllers.CreateOrder)
		payments.POST("/verify", middleware.Protect(), middleware.AuthorizeUser(), middleware.PaymentLimiter(), middleware.Idempotency(), controllers.VerifyPayment)
		payments.GET("/booking/:bookingId", middleware.Protect(), controllers.GetPaymentStatus)
		payments.POST("/refund", middleware.Protect(), middleware.AuthorizeAdmin(), middleware.Idempotency(), controllers.RefundPayment)
		payments.POST("/wallet-pay", middleware.Protect(), middleware.AuthorizeUser(), middleware.PaymentLimiter(), middleware.Idempotency(), controllers.PayWithWallet)
	}

	// /favorites
	favorites := rg.Group("/favorites")
	{
		favorites.GET("", middleware.Protect(), middleware.AuthorizeUser(), controllers.GetFavorites)
		favorites.GET("/", middleware.Protect(), middleware.AuthorizeUser(), controllers.GetFavorites)
		favorites.POST("", middleware.Protect(), middleware.AuthorizeUser(), controllers.AddFavorite)
		favorites.POST("/", middleware.Protect(), middleware.AuthorizeUser(), controllers.AddFavorite)
		favorites.DELETE("/:driverId", middleware.Protect(), middleware.AuthorizeUser(), controllers.RemoveFavorite)
		favorites.GET("/check/:driverId", middleware.Protect(), middleware.AuthorizeUser(), controllers.CheckFavorite)
	}

	// /messages
	messages := rg.Group("/messages")
	{
		messages.POST("/conversations", middleware.Protect(), middleware.AuthorizeUserOrDriver(), controllers.GetOrCreateConversation)
		messages.GET("/conversations", middleware.Protect(), middleware.AuthorizeUserOrDriver(), controllers.GetConversations)
		messages.GET("/:conversationId", middleware.Protect(), middleware.AuthorizeUserOrDriver(), controllers.GetMessages)
		messages.POST("", middleware.Protect(), middleware.AuthorizeUserOrDriver(), controllers.SendMessage)
		messages.POST("/", middleware.Protect(), middleware.AuthorizeUserOrDriver(), controllers.SendMessage)
		messages.PUT("/:conversationId/read", middleware.Protect(), middleware.AuthorizeUserOrDriver(), controllers.MarkConversationRead)
	}

	// /notifications
	notifications := rg.Group("/notifications")
	{
		notifications.GET("", middleware.Protect(), middleware.AuthorizeUserOrDriver(), controllers.GetNotifications)
		notifications.GET("/", middleware.Protect(), middleware.AuthorizeUserOrDriver(), controllers.GetNotifications)
		notifications.PUT("/read-all", middleware.Protect(), middleware.AuthorizeUserOrDriver(), controllers.MarkAsRead)
		notifications.PUT("/:id/read", middleware.Protect(), middleware.AuthorizeUserOrDriver(), controllers.MarkOneAsRead)
	}

	// /2fa
	twoFA := rg.Group("/2fa")
	{
		twoFA.POST("/generate", middleware.Protect(), controllers.Generate2FA)
		twoFA.POST("/enable", middleware.Protect(), controllers.Enable2FA)
		twoFA.POST("/verify-login", middleware.TwoFactorLimiter(), controllers.Verify2FALogin)
	}

	// /wallet
	wallet := rg.Group("/wallet")
	{
		wallet.GET("", middleware.Protect(), controllers.GetWalletTransactions)
		wallet.GET("/", middleware.Protect(), controllers.GetWalletTransactions)
		wallet.POST("/order", middleware.Protect(), controllers.CreateWalletOrder)
		wallet.POST("/verify", middleware.Protect(), controllers.VerifyWalletPayment)
	}

	// /promos
	promos := rg.Group("/promos")
	{
		promos.GET("", middleware.Protect(), controllers.GetPromoCodes)
		promos.GET("/", middleware.Protect(), controllers.GetPromoCodes)
		promos.POST("/validate", middleware.Protect(), controllers.ValidatePromoCode)
		promos.POST("/create", middleware.Protect(), middleware.AuthorizeAdmin(), controllers.CreatePromoCode)
	}

	// /admin
	admin := rg.Group("/admin")
	{
		admin.GET("/stats", middleware.Protect(), middleware.AuthorizeAdmin(), controllers.GetDashboardStats)
		admin.GET("/metrics", middleware.Protect(), middleware.AuthorizeAdmin(), controllers.GetAdminMetrics)
		admin.GET("/heatmap", middleware.Protect(), middleware.AuthorizeAdmin(), controllers.GetAdminHeatmap)
		admin.GET("/drivers", middleware.Protect(), middleware.AuthorizeAdmin(), controllers.GetAllDrivers)
		admin.GET("/drivers/pending", middleware.Protect(), middleware.AuthorizeAdmin(), controllers.GetPendingDrivers)
		admin.GET("/drivers/:id", middleware.Protect(), middleware.AuthorizeAdmin(), controllers.GetDriverDetail)
		admin.PUT("/drivers/:id/verify", middleware.Protect(), middleware.AuthorizeAdmin(), controllers.VerifyDriver)
		admin.PUT("/drivers/:id/toggle-active", middleware.Protect(), middleware.AuthorizeAdmin(), controllers.ToggleDriverActive)
		admin.DELETE("/drivers/:id", middleware.Protect(), middleware.AuthorizeAdmin(), controllers.SoftDeleteDriver)
		admin.GET("/users", middleware.Protect(), middleware.AuthorizeAdmin(), controllers.GetAllUsers)
		admin.PUT("/users/:id/toggle-active", middleware.Protect(), middleware.AuthorizeAdmin(), controllers.ToggleUserActive)
		admin.DELETE("/users/:id", middleware.Protect(), middleware.AuthorizeAdmin(), controllers.SoftDeleteUser)
		admin.GET("/bookings", middleware.Protect(), middleware.AuthorizeAdmin(), controllers.GetAllBookings)
		admin.GET("/bookings/export", middleware.Protect(), middleware.AuthorizeAdmin(), controllers.ExportBookingsCSV)
		admin.GET("/audit-logs", middleware.Protect(), middleware.AuthorizeAdmin(), controllers.GetAuditLogs)
	}

	// /ai
	ai := rg.Group("/ai")
	{
		ai.GET("/recommend", controllers.RecommendDrivers)
		ai.POST("/chat", middleware.AIChatLimiter(), middleware.OptionalAuth(), controllers.Chat)
		ai.GET("/heatmap", middleware.Protect(), middleware.AuthorizeDriver(), controllers.GetHeatmap)
		ai.POST("/verify-kyc", middleware.Protect(), middleware.AuthorizeAdmin(), controllers.VerifyKyc)
		ai.GET("/match", middleware.Protect(), controllers.GetDriverMatch)
	}
}
