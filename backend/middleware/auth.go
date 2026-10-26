package middleware

import (
	"context"
	"net/http"
	"strings"
	"time"

	"mymate-backend/config"
	"mymate-backend/models"
	"mymate-backend/utils"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
)

func Protect() gin.HandlerFunc {
	return func(c *gin.Context) {
		token, _ := c.Cookie("token")
		if token == "" {
			authHeader := c.GetHeader("Authorization")
			if strings.HasPrefix(authHeader, "Bearer ") {
				token = strings.TrimPrefix(authHeader, "Bearer ")
			}
		}

		if token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "Not authorized, no token"})
			return
		}

		claims, err := utils.VerifyToken(token)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "Not authorized, token invalid"})
			return
		}

		objID, err := bson.ObjectIDFromHex(claims.ID)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "Invalid token subject"})
			return
		}

		if config.DB == nil {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"message": "Database is not connected"})
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		if claims.Role == "user" {
			var user models.User
			err := config.DB.Collection("users").FindOne(ctx, bson.D{{Key: "_id", Value: objID}}).Decode(&user)
			if err != nil {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "User not found"})
				return
			}
			if claims.TV != user.TokenVersion {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "Session expired. Please log in again."})
				return
			}
			if user.DeletedAt != nil {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "Your account has been deleted"})
				return
			}
			if !user.IsActive {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"message": "Your account has been deactivated"})
				return
			}

			c.Set("user", &user)
			c.Set("userRole", "user")
			c.Set("userID", user.ID)
			c.Set("userId", user.ID)
		} else if claims.Role == "driver" {
			var driver models.Driver
			err := config.DB.Collection("drivers").FindOne(ctx, bson.D{{Key: "_id", Value: objID}}).Decode(&driver)
			if err != nil {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "Driver not found"})
				return
			}
			if claims.TV != driver.TokenVersion {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "Session expired. Please log in again."})
				return
			}
			if driver.DeletedAt != nil {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "Your account has been deleted"})
				return
			}
			if driver.KycStatus == "approved" && !driver.IsActive {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"message": "Your account has been deactivated"})
				return
			}

			c.Set("driver", &driver)
			c.Set("userRole", "driver")
			c.Set("userID", driver.ID)
			c.Set("userId", driver.ID)
		} else if claims.Role == "admin" {
			var admin models.Admin
			err := config.DB.Collection("admins").FindOne(ctx, bson.D{{Key: "_id", Value: objID}}).Decode(&admin)
			if err != nil {
				// Allow fallback to static admin token if configured
				admin = models.Admin{ID: objID, Role: "admin"}
			}
			c.Set("admin", &admin)
			c.Set("userRole", "admin")
			c.Set("userID", objID)
			c.Set("userId", objID)
		} else {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "Unknown role"})
			return
		}

		c.Next()
	}
}

func AuthorizeUser() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get("userRole")
		if role != "user" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"message": "Access denied. Users only."})
			return
		}
		c.Next()
	}
}

func AuthorizeDriver() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get("userRole")
		if role != "driver" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"message": "Access denied. Drivers only."})
			return
		}
		c.Next()
	}
}

func AuthorizeAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get("userRole")
		if role != "admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"message": "Access denied. Admins only."})
			return
		}
		c.Next()
	}
}

func AuthorizeUserOrDriver() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get("userRole")
		if role != "user" && role != "driver" && role != "admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"message": "Access denied."})
			return
		}
		c.Next()
	}
}

func OptionalAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		token, _ := c.Cookie("token")
		if token == "" {
			authHeader := c.GetHeader("Authorization")
			if strings.HasPrefix(authHeader, "Bearer ") {
				token = strings.TrimPrefix(authHeader, "Bearer ")
			}
		}

		if token == "" {
			c.Next()
			return
		}

		claims, err := utils.VerifyToken(token)
		if err == nil {
			if config.DB == nil {
				c.Next()
				return
			}
			objID, err := bson.ObjectIDFromHex(claims.ID)
			if err == nil {
				ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
				defer cancel()

				if claims.Role == "user" {
					var user models.User
					if err := config.DB.Collection("users").FindOne(ctx, bson.D{{Key: "_id", Value: objID}}).Decode(&user); err == nil {
						c.Set("user", &user)
						c.Set("userRole", "user")
						c.Set("userID", user.ID)
						c.Set("userId", user.ID)
					}
				} else if claims.Role == "driver" {
					var driver models.Driver
					if err := config.DB.Collection("drivers").FindOne(ctx, bson.D{{Key: "_id", Value: objID}}).Decode(&driver); err == nil {
						c.Set("driver", &driver)
						c.Set("userRole", "driver")
						c.Set("userID", driver.ID)
						c.Set("userId", driver.ID)
					}
				} else if claims.Role == "admin" {
					c.Set("admin", &models.Admin{ID: objID, Role: "admin"})
					c.Set("userRole", "admin")
					c.Set("userID", objID)
					c.Set("userId", objID)
				}
			}
		}

		c.Next()
	}
}
