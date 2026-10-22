package controllers

import (
	"context"
	"encoding/base64"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pquerna/otp/totp"
	"github.com/skip2/go-qrcode"
	"go.mongodb.org/mongo-driver/v2/bson"

	"mymate-backend/config"
	"mymate-backend/models"
	"mymate-backend/utils"
)

type enable2FAReq struct {
	Token string `json:"token" binding:"required"`
}

type verify2FALoginReq struct {
	Email string `json:"email" binding:"required,email"`
	Token string `json:"token" binding:"required"`
	Role  string `json:"role" binding:"required"`
}

// POST /api/v1/2fa/generate
func Generate2FA(c *gin.Context) {
	userID, _ := c.Get("userId")
	userOID, _ := userID.(bson.ObjectID)
	roleVal, _ := c.Get("userRole")
	userRole, _ := roleVal.(string)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var email string
	collName := "users"
	if userRole == "driver" {
		collName = "drivers"
		var d models.Driver
		if err := config.GetCollection(collName).FindOne(ctx, bson.M{"_id": userOID}).Decode(&d); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Driver not found"})
			return
		}
		email = d.Email
	} else {
		var u models.User
		if err := config.GetCollection(collName).FindOne(ctx, bson.M{"_id": userOID}).Decode(&u); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "User not found"})
			return
		}
		email = u.Email
	}

	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "MyMate",
		AccountName: email,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to generate 2FA secret"})
		return
	}

	secret := key.Secret()

	// Update user/driver document with secret
	_, _ = config.GetCollection(collName).UpdateOne(ctx,
		bson.M{"_id": userOID},
		bson.M{"$set": bson.M{"twoFactorSecret": secret, "updatedAt": time.Now()}},
	)

	// Generate QR code PNG
	pngBytes, err := qrcode.Encode(key.URL(), qrcode.Medium, 256)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to generate QR code"})
		return
	}

	qrCodeDataURL := "data:image/png;base64," + base64.StdEncoding.EncodeToString(pngBytes)

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"qrCodeUrl": qrCodeDataURL,
		"secret":    secret,
	})
}

// POST /api/v1/2fa/enable
func Enable2FA(c *gin.Context) {
	var req enable2FAReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Token is required"})
		return
	}

	userID, _ := c.Get("userId")
	userOID, _ := userID.(bson.ObjectID)
	roleVal, _ := c.Get("userRole")
	userRole, _ := roleVal.(string)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collName := "users"
	var secret string
	if userRole == "driver" {
		collName = "drivers"
		var d models.Driver
		if err := config.GetCollection(collName).FindOne(ctx, bson.M{"_id": userOID}).Decode(&d); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Driver not found"})
			return
		}
		secret = d.TwoFactorSecret
	} else {
		var u models.User
		if err := config.GetCollection(collName).FindOne(ctx, bson.M{"_id": userOID}).Decode(&u); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "User not found"})
			return
		}
		secret = u.TwoFactorSecret
	}

	if secret == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "2FA is not initialized"})
		return
	}

	valid := totp.Validate(req.Token, secret)
	if !valid {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid 2FA token"})
		return
	}

	_, _ = config.GetCollection(collName).UpdateOne(ctx,
		bson.M{"_id": userOID},
		bson.M{"$set": bson.M{"isTwoFactorEnabled": true, "updatedAt": time.Now()}},
	)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Two-Factor Authentication enabled successfully",
	})
}

// POST /api/v1/2fa/verify-login
func Verify2FALogin(c *gin.Context) {
	var req verify2FALoginReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Email, token, and role are required"})
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if req.Role == "driver" {
		var driver models.Driver
		err := config.GetCollection("drivers").FindOne(ctx, bson.M{"email": req.Email}).Decode(&driver)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Driver not found"})
			return
		}
		if !driver.IsTwoFactorEnabled || driver.TwoFactorSecret == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "2FA is not enabled for this user"})
			return
		}

		if !totp.Validate(req.Token, driver.TwoFactorSecret) {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid 2FA token"})
			return
		}

		token, err := utils.GenerateToken(driver.ID, "driver", driver.TokenVersion)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to create token"})
			return
		}

		utils.SetAuthCookie(c, token)
		driver.Password = ""
		driver.TwoFactorSecret = ""

		c.JSON(http.StatusOK, gin.H{
			"role":                   "driver",
			"driver":                 driver,
			"needsProfileCompletion": !driver.ProfileCompleted,
		})
		return
	}

	if req.Role == "user" {
		var user models.User
		err := config.GetCollection("users").FindOne(ctx, bson.M{"email": req.Email}).Decode(&user)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "User not found"})
			return
		}
		if !user.IsTwoFactorEnabled || user.TwoFactorSecret == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "2FA is not enabled for this user"})
			return
		}

		if !totp.Validate(req.Token, user.TwoFactorSecret) {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid 2FA token"})
			return
		}

		token, err := utils.GenerateToken(user.ID, "user", user.TokenVersion)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to create token"})
			return
		}

		utils.SetAuthCookie(c, token)
		user.Password = ""
		user.TwoFactorSecret = ""

		c.JSON(http.StatusOK, gin.H{
			"role":                   "user",
			"user":                   user,
			"needsProfileCompletion": !user.ProfileCompleted,
		})
		return
	}

	c.JSON(http.StatusBadRequest, gin.H{"message": fmt.Sprintf("Invalid role: %s", req.Role)})
}
