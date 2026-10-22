package controllers

import (
	"context"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"mymate-backend/config"
	"mymate-backend/models"
	"mymate-backend/utils"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
)

// GET /api/v1/users/profile
func GetUserProfile(c *gin.Context) {
	user, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Unauthorized"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"user": user})
}

// PUT /api/v1/users/profile
func UpdateUserProfile(c *gin.Context) {
	userObj, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Unauthorized"})
		return
	}
	user := userObj.(*models.User)

	name := c.PostForm("name")
	phone := c.PostForm("phone")
	locality := c.PostForm("locality")

	avatar := user.Avatar
	file, err := c.FormFile("avatar")
	if err == nil && file != nil {
		_ = os.MkdirAll("uploads/mymate/avatars", 0755)
		filename := filepath.Join("uploads/mymate/avatars", user.ID.Hex()+"-"+file.Filename)
		if saveErr := c.SaveUploadedFile(file, filename); saveErr == nil {
			avatar = models.ImageRef{
				URL:      "/" + filepath.ToSlash(filename),
				PublicID: "",
			}
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	updateDoc := bson.D{
		{Key: "updatedAt", Value: time.Now()},
	}
	if name != "" {
		updateDoc = append(updateDoc, bson.E{Key: "name", Value: name})
		user.Name = name
	}
	if phone != "" {
		updateDoc = append(updateDoc, bson.E{Key: "phone", Value: phone})
		user.Phone = phone
	}
	if locality != "" {
		updateDoc = append(updateDoc, bson.E{Key: "locality", Value: locality})
		user.Locality = locality
	}
	if avatar.URL != "" {
		updateDoc = append(updateDoc, bson.E{Key: "avatar", Value: avatar})
		user.Avatar = avatar
	}

	_, err = config.DB.Collection("users").UpdateOne(ctx,
		bson.D{{Key: "_id", Value: user.ID}},
		bson.D{{Key: "$set", Value: updateDoc}},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to update profile"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": user})
}

// PUT /api/v1/users/change-password
func ChangePassword(c *gin.Context) {
	var body struct {
		CurrentPassword string `json:"currentPassword" binding:"required"`
		NewPassword     string `json:"newPassword" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Current password and new password (min 6 chars) required"})
		return
	}

	role, _ := c.Get("userRole")
	userID, _ := c.Get("userID")

	collection := "users"
	if role == "driver" {
		collection = "drivers"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var account struct {
		ID           bson.ObjectID `bson:"_id"`
		Password     string        `bson:"password"`
		TokenVersion int           `bson:"tokenVersion"`
	}

	err := config.DB.Collection(collection).FindOne(ctx, bson.D{{Key: "_id", Value: userID}}).Decode(&account)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Account not found"})
		return
	}

	userModel := models.User{Password: account.Password}
	if !userModel.ComparePassword(body.CurrentPassword) {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Current password is incorrect"})
		return
	}

	hashedNewPassword, err := models.HashPassword(body.NewPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to encrypt password"})
		return
	}

	newTokenVersion := account.TokenVersion + 1
	_, err = config.DB.Collection(collection).UpdateOne(ctx,
		bson.D{{Key: "_id", Value: userID}},
		bson.D{
			{Key: "$set", Value: bson.D{
				{Key: "password", Value: hashedNewPassword},
				{Key: "tokenVersion", Value: newTokenVersion},
				{Key: "updatedAt", Value: time.Now()},
			}},
		},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to update password"})
		return
	}

	token, _ := utils.GenerateToken(account.ID, role.(string), newTokenVersion)
	utils.SetTokenCookie(c, token)

	c.JSON(http.StatusOK, gin.H{
		"token":   token,
		"message": "Password changed successfully",
	})
}
