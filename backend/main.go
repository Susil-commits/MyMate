package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"

	"mymate-backend/config"
	"mymate-backend/routes"
	"mymate-backend/socket"
	"mymate-backend/utils"
)

func main() {
	log.Println("Starting MyMate Golang Backend...")

	// 1. Load configuration from environment / .env
	cfg := config.LoadConfig()

	if cfg.MongoURI == "" && cfg.AppEnv != "test" {
		log.Fatalf("FATAL ERROR: MONGO_URI is not set in environment variables")
	}

	// 2. Connect to MongoDB
	if _, err := config.ConnectDB(); err != nil {
		log.Printf("⚠️  [MongoDB Warning] Failed to connect to MongoDB: %v", err)
		log.Printf("⚠️  [MongoDB Hint] If authentication failed, please verify username/password in .env or Atlas IP access list.")
	}
	defer func() {
		if config.DB != nil {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			_ = config.DB.Client().Disconnect(ctx)
		}
	}()

	// 3. Connect to Redis
	config.ConnectRedis(cfg.RedisURL, cfg.DisableRedis)

	// 4. Initialize Kafka Producer
	config.InitKafka()
	defer config.StopKafka()

	// 5. Initialize Socket.IO Server
	socket.InitSocket()

	// 6. Start Cron Jobs (e.g. auto-cancelling stale pending bookings)
	utils.StartCronJobs()

	// 7. Setup Gin HTTP Engine
	if cfg.AppEnv == "production" {
		gin.SetMode(gin.ReleaseMode)
	} else {
		gin.SetMode(gin.DebugMode)
	}

	r := gin.New()
	r.Use(gin.Logger())

	// Mount all routes, middleware, and handlers
	routes.SetupRoutes(r)

	port := cfg.Port
	if port == "" {
		port = "5000"
	}

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      r,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// 8. Run server in background goroutine
	go func() {
		log.Printf("Server running on port %s (env: %s)", port, cfg.AppEnv)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server ListenAndServe error: %v", err)
		}
	}()

	// 9. Graceful shutdown listening for SIGINT or SIGTERM
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit
	log.Printf("Received signal %s, initiating graceful shutdown...", sig)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited successfully.")
}
