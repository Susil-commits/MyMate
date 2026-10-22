package controllers

import (
	"context"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"mymate-backend/config"
	"mymate-backend/middleware"
	"mymate-backend/models"
	"mymate-backend/utils"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
)

type RegisterInput struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	Gender   string `json:"gender"`
	Phone    string `json:"phone"`
}

type LoginInput struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type AdminLoginInput struct {
	Email     string `json:"email" binding:"required,email"`
	Password  string `json:"password" binding:"required"`
	AdminCode string `json:"adminCode"`
}

type ForgotPasswordInput struct {
	Email string `json:"email" binding:"required,email"`
	Role  string `json:"role" binding:"required"`
}

type ResetPasswordInput struct {
	Token    string `json:"token" binding:"required"`
	Password string `json:"password" binding:"required,min=6"`
	Role     string `json:"role" binding:"required"`
}

type VerifyEmailInput struct {
	Token string `json:"token" binding:"required"`
	Role  string `json:"role" binding:"required"`
}

// POST /api/v1/auth/user/register
func UserRegister(c *gin.Context) {
	var input RegisterInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Valid email, gender, phone and password (min 6 chars) required"})
		return
	}

	email := strings.ToLower(strings.TrimSpace(input.Email))
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Check if email exists
	count, _ := config.DB.Collection("users").CountDocuments(ctx, bson.D{{Key: "email", Value: email}})
	if count > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Email already registered"})
		return
	}

	hashedPassword, err := models.HashPassword(input.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Password encryption failed"})
		return
	}

	rawToken, hashedToken := models.GenerateCryptoToken()
	expire := time.Now().Add(24 * time.Hour)

	user := models.User{
		Email:                   email,
		Password:                hashedPassword,
		Gender:                  input.Gender,
		Phone:                   input.Phone,
		ProfileCompleted:        false,
		IsActive:                true,
		TokenVersion:            0,
		IsEmailVerified:         false,
		EmailVerificationToken:  hashedToken,
		EmailVerificationExpire: &expire,
		Role:                    "user",
		WalletBalance:           0,
		CreatedAt:               time.Now(),
		UpdatedAt:               time.Now(),
	}

	_, err = config.DB.Collection("users").InsertOne(ctx, user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to create user"})
		return
	}

	config.SendVerificationEmail(email, rawToken)

	c.JSON(http.StatusCreated, gin.H{"message": "Account created. Please verify your email."})
}

// POST /api/v1/auth/user/login
func UserLogin(c *gin.Context) {
	var input LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Email and password are required"})
		return
	}

	email := strings.ToLower(strings.TrimSpace(input.Email))
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var user models.User
	err := config.DB.Collection("users").FindOne(ctx, bson.D{{Key: "email", Value: email}}).Decode(&user)
	if err != nil || !user.ComparePassword(input.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Invalid email or password"})
		return
	}

	if !user.IsActive {
		c.JSON(http.StatusForbidden, gin.H{"message": "Your account has been deactivated. Contact support."})
		return
	}

	if user.IsTwoFactorEnabled {
		c.JSON(http.StatusOK, gin.H{"requires2FA": true, "role": "user", "email": user.Email})
		return
	}

	token, err := utils.GenerateToken(user.ID, "user", user.TokenVersion)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to generate session token"})
		return
	}

	utils.SetTokenCookie(c, token)
	c.JSON(http.StatusOK, gin.H{
		"role":                   "user",
		"user":                   user,
		"needsProfileCompletion": !user.ProfileCompleted,
	})
}

// PUT /api/v1/auth/user/complete-profile
func CompleteUserProfile(c *gin.Context) {
	var body struct {
		Name     string `json:"name" binding:"required"`
		Locality string `json:"locality" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Name and locality are required"})
		return
	}

	user, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Unauthorized"})
		return
	}
	u := user.(*models.User)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	update := bson.D{
		{Key: "$set", Value: bson.D{
			{Key: "name", Value: body.Name},
			{Key: "locality", Value: body.Locality},
			{Key: "profileCompleted", Value: true},
			{Key: "updatedAt", Value: time.Now()},
		}},
	}

	_, err := config.DB.Collection("users").UpdateOne(ctx, bson.D{{Key: "_id", Value: u.ID}}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to update profile"})
		return
	}

	u.Name = body.Name
	u.Locality = body.Locality
	u.ProfileCompleted = true

	c.JSON(http.StatusOK, gin.H{"user": u})
}

// POST /api/v1/auth/driver/register
func DriverRegister(c *gin.Context) {
	var input RegisterInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Valid email, gender, phone and password (min 6 chars) required"})
		return
	}

	email := strings.ToLower(strings.TrimSpace(input.Email))
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	count, _ := config.DB.Collection("drivers").CountDocuments(ctx, bson.D{{Key: "email", Value: email}})
	if count > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Email already registered"})
		return
	}

	hashedPassword, err := models.HashPassword(input.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Password encryption failed"})
		return
	}

	rawToken, hashedToken := models.GenerateCryptoToken()
	expire := time.Now().Add(24 * time.Hour)

	driver := models.Driver{
		Email:                   email,
		Password:                hashedPassword,
		Gender:                  input.Gender,
		Phone:                   input.Phone,
		ProfileCompleted:        false,
		KycStatus:               "pending",
		IsActive:                false,
		Availability:            "offline",
		TokenVersion:            0,
		IsEmailVerified:         false,
		EmailVerificationToken:  hashedToken,
		EmailVerificationExpire: &expire,
		Role:                    "driver",
		Location: models.GeoPoint{
			Type:        "Point",
			Coordinates: []float64{0, 0},
		},
		WalletBalance: 0,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	_, err = config.DB.Collection("drivers").InsertOne(ctx, driver)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to create driver account"})
		return
	}

	config.SendVerificationEmail(email, rawToken)

	c.JSON(http.StatusCreated, gin.H{"message": "Driver account created. Please verify your email."})
}

// POST /api/v1/auth/driver/login
func DriverLogin(c *gin.Context) {
	var input LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Email and password are required"})
		return
	}

	email := strings.ToLower(strings.TrimSpace(input.Email))
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var driver models.Driver
	err := config.DB.Collection("drivers").FindOne(ctx, bson.D{{Key: "email", Value: email}}).Decode(&driver)
	if err != nil || !driver.ComparePassword(input.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Invalid email or password"})
		return
	}

	if driver.IsTwoFactorEnabled {
		c.JSON(http.StatusOK, gin.H{"requires2FA": true, "role": "driver", "email": driver.Email})
		return
	}

	token, err := utils.GenerateToken(driver.ID, "driver", driver.TokenVersion)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to generate session token"})
		return
	}

	utils.SetTokenCookie(c, token)
	c.JSON(http.StatusOK, gin.H{
		"role":                   "driver",
		"driver":                 driver,
		"needsProfileCompletion": !driver.ProfileCompleted,
	})
}

// PUT /api/v1/auth/driver/complete-profile
func CompleteDriverProfile(c *gin.Context) {
	driverObj, exists := c.Get("driver")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Unauthorized"})
		return
	}
	driver := driverObj.(*models.Driver)

	name := c.PostForm("name")
	nationality := c.PostForm("nationality")
	locality := c.PostForm("locality")
	licenseNumber := c.PostForm("licenseNumber")
	experienceYears := utils.ParseIntDefault(c.PostForm("experienceYears"), 0)
	hourlyRate := utils.ParseIntDefault(c.PostForm("hourlyRate"), 0)
	dailyRate := utils.ParseIntDefault(c.PostForm("dailyRate"), 0)
	bio := c.PostForm("bio")
	languagesRaw := c.PostForm("languages")
	vehicleTypesRaw := c.PostFormArray("vehicleTypes")
	if len(vehicleTypesRaw) == 0 && c.PostForm("vehicleTypes") != "" {
		vehicleTypesRaw = strings.Split(c.PostForm("vehicleTypes"), ",")
	}

	var languages []string
	for _, l := range strings.Split(languagesRaw, ",") {
		trimmed := strings.TrimSpace(l)
		if trimmed != "" {
			languages = append(languages, trimmed)
		}
	}

	var vehicleTypes []string
	for _, v := range vehicleTypesRaw {
		trimmed := strings.TrimSpace(v)
		if trimmed != "" {
			vehicleTypes = append(vehicleTypes, trimmed)
		}
	}

	licenseImg := driver.LicenseImage
	file, err := c.FormFile("licenseImage")
	if err == nil && file != nil {
		_ = os.MkdirAll("uploads/mymate/licenses", 0755)
		ext := filepath.Ext(file.Filename)
		if ext == "" {
			ext = ".jpg"
		}
		filename := filepath.Join("uploads/mymate/licenses", driver.ID.Hex()+"-"+file.Filename)
		if saveErr := c.SaveUploadedFile(file, filename); saveErr == nil {
			licenseImg = models.ImageRef{
				URL:      "/" + filepath.ToSlash(filename),
				PublicID: "",
			}
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	update := bson.D{
		{Key: "$set", Value: bson.D{
			{Key: "name", Value: name},
			{Key: "nationality", Value: nationality},
			{Key: "locality", Value: locality},
			{Key: "licenseNumber", Value: licenseNumber},
			{Key: "licenseImage", Value: licenseImg},
			{Key: "experienceYears", Value: float64(experienceYears)},
			{Key: "hourlyRate", Value: float64(hourlyRate)},
			{Key: "dailyRate", Value: float64(dailyRate)},
			{Key: "languages", Value: languages},
			{Key: "vehicleTypes", Value: vehicleTypes},
			{Key: "bio", Value: bio},
			{Key: "profileCompleted", Value: true},
			{Key: "kycStatus", Value: "pending"},
			{Key: "updatedAt", Value: time.Now()},
		}},
	}

	_, err = config.DB.Collection("drivers").UpdateOne(ctx, bson.D{{Key: "_id", Value: driver.ID}}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to update driver profile"})
		return
	}

	driver.Name = name
	driver.Nationality = nationality
	driver.Locality = locality
	driver.LicenseNumber = licenseNumber
	driver.LicenseImage = licenseImg
	driver.ExperienceYears = float64(experienceYears)
	driver.HourlyRate = float64(hourlyRate)
	driver.DailyRate = float64(dailyRate)
	driver.Languages = languages
	driver.VehicleTypes = vehicleTypes
	driver.Bio = bio
	driver.ProfileCompleted = true
	driver.KycStatus = "pending"

	c.JSON(http.StatusOK, gin.H{"driver": models.SanitizeDriver(driver, true)})
}

// POST /api/v1/auth/admin/login
func AdminLogin(c *gin.Context) {
	var input AdminLoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Email and password are required"})
		return
	}

	email := strings.ToLower(strings.TrimSpace(input.Email))
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var admin models.Admin
	err := config.DB.Collection("admins").FindOne(ctx, bson.D{{Key: "email", Value: email}}).Decode(&admin)

	// If no admin in DB, create initial admin if password matches or matches ADMIN_CODE
	if err != nil {
		if input.Password == config.AppConfig.AdminCode || input.AdminCode == config.AppConfig.AdminCode {
			hashed, _ := models.HashPassword(input.Password)
			admin = models.Admin{
				Email:     email,
				Password:  hashed,
				Role:      "admin",
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			}
			res, insertErr := config.DB.Collection("admins").InsertOne(ctx, admin)
			if insertErr == nil {
				admin.ID = res.InsertedID.(bson.ObjectID)
			}
		} else {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "Invalid email or password"})
			return
		}
	} else if !admin.ComparePassword(input.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Invalid email or password"})
		return
	}

	now := time.Now()
	_, _ = config.DB.Collection("admins").UpdateOne(ctx, bson.D{{Key: "_id", Value: admin.ID}}, bson.D{{Key: "$set", Value: bson.D{{Key: "lastLoginAt", Value: now}}}})

	token, _ := utils.GenerateToken(admin.ID, "admin", 0)
	utils.SetTokenCookie(c, token)

	c.JSON(http.StatusOK, gin.H{"role": "admin", "admin": admin})
}

// GET /api/v1/auth/me
func GetMe(c *gin.Context) {
	role, exists := c.Get("userRole")
	if !exists {
		c.JSON(http.StatusOK, gin.H{"user": nil, "role": nil})
		return
	}

	if role == "user" {
		u, _ := c.Get("user")
		c.JSON(http.StatusOK, gin.H{"user": u, "role": "user"})
	} else if role == "driver" {
		d, _ := c.Get("driver")
		c.JSON(http.StatusOK, gin.H{"user": d, "role": "driver"})
	} else if role == "admin" {
		a, _ := c.Get("admin")
		c.JSON(http.StatusOK, gin.H{"user": a, "role": "admin"})
	} else {
		c.JSON(http.StatusOK, gin.H{"user": nil, "role": nil})
	}
}

// POST /api/v1/auth/forgot-password
func ForgotPassword(c *gin.Context) {
	var input ForgotPasswordInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "If an account exists, a reset link has been sent"})
		return
	}

	email := strings.ToLower(strings.TrimSpace(input.Email))
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	collection := "users"
	if input.Role == "driver" {
		collection = "drivers"
	}

	rawToken, hashedToken := models.GenerateCryptoToken()
	expire := time.Now().Add(1 * time.Hour)

	update := bson.D{
		{Key: "$set", Value: bson.D{
			{Key: "resetPasswordToken", Value: hashedToken},
			{Key: "resetPasswordExpire", Value: expire},
		}},
	}

	res, err := config.DB.Collection(collection).UpdateOne(ctx, bson.D{{Key: "email", Value: email}}, update)
	if err == nil && res.MatchedCount > 0 {
		config.SendPasswordResetEmail(email, rawToken)
	}

	c.JSON(http.StatusOK, gin.H{"message": "If an account exists, a reset link has been sent"})
}

// POST /api/v1/auth/reset-password
func ResetPassword(c *gin.Context) {
	var input ResetPasswordInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Token, role, and new password are required"})
		return
	}

	hashedToken := models.HashToken(input.Token)
	collection := "users"
	if input.Role == "driver" {
		collection = "drivers"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	hashedPassword, err := models.HashPassword(input.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Encryption error"})
		return
	}

	filter := bson.D{
		{Key: "resetPasswordToken", Value: hashedToken},
		{Key: "resetPasswordExpire", Value: bson.D{{Key: "$gt", Value: time.Now()}}},
	}

	update := bson.D{
		{Key: "$set", Value: bson.D{
			{Key: "password", Value: hashedPassword},
			{Key: "updatedAt", Value: time.Now()},
		}},
		{Key: "$unset", Value: bson.D{
			{Key: "resetPasswordToken", Value: ""},
			{Key: "resetPasswordExpire", Value: ""},
		}},
		{Key: "$inc", Value: bson.D{
			{Key: "tokenVersion", Value: 1},
		}},
	}

	var updatedDoc struct {
		ID           bson.ObjectID `bson:"_id"`
		TokenVersion int           `bson:"tokenVersion"`
	}
	res := config.DB.Collection(collection).FindOneAndUpdate(ctx, filter, update)
	if res.Err() != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid or expired reset token"})
		return
	}
	_ = res.Decode(&updatedDoc)

	newToken, _ := utils.GenerateToken(updatedDoc.ID, input.Role, updatedDoc.TokenVersion)
	utils.SetTokenCookie(c, newToken)

	c.JSON(http.StatusOK, gin.H{"role": input.Role})
}

// POST /api/v1/auth/verify-email
func VerifyEmail(c *gin.Context) {
	var input VerifyEmailInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Token and role are required"})
		return
	}

	hashedToken := models.HashToken(input.Token)
	collection := "users"
	if input.Role == "driver" {
		collection = "drivers"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.D{
		{Key: "emailVerificationToken", Value: hashedToken},
		{Key: "emailVerificationExpire", Value: bson.D{{Key: "$gt", Value: time.Now()}}},
	}

	update := bson.D{
		{Key: "$set", Value: bson.D{
			{Key: "isEmailVerified", Value: true},
			{Key: "updatedAt", Value: time.Now()},
		}},
		{Key: "$unset", Value: bson.D{
			{Key: "emailVerificationToken", Value: ""},
			{Key: "emailVerificationExpire", Value: ""},
		}},
	}

	res, err := config.DB.Collection(collection).UpdateOne(ctx, filter, update)
	if err != nil || res.MatchedCount == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid or expired verification token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Email verified successfully"})
}

// POST /api/v1/auth/resend-verification
func ResendVerification(c *gin.Context) {
	var input struct {
		Email string `json:"email" binding:"required,email"`
		Role  string `json:"role" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "If the email exists and is unverified, a new link has been sent"})
		return
	}

	email := strings.ToLower(strings.TrimSpace(input.Email))
	collection := "users"
	if input.Role == "driver" {
		collection = "drivers"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	rawToken, hashedToken := models.GenerateCryptoToken()
	expire := time.Now().Add(24 * time.Hour)

	filter := bson.D{
		{Key: "email", Value: email},
		{Key: "isEmailVerified", Value: false},
	}
	update := bson.D{
		{Key: "$set", Value: bson.D{
			{Key: "emailVerificationToken", Value: hashedToken},
			{Key: "emailVerificationExpire", Value: expire},
		}},
	}

	res, err := config.DB.Collection(collection).UpdateOne(ctx, filter, update)
	if err == nil && res.MatchedCount > 0 {
		config.SendVerificationEmail(email, rawToken)
	}

	c.JSON(http.StatusOK, gin.H{"message": "If the email exists and is unverified, a new link has been sent"})
}

// GET /api/v1/auth/csrf-token
func GetCsrfToken(c *gin.Context) {
	token, err := c.Cookie("XSRF-TOKEN")
	if err != nil || token == "" || !middleware.VerifyCsrfToken(token) {
		token = middleware.GenerateCsrfToken()
		isProd := config.AppConfig.AppEnv == "production"
		sameSite := http.SameSiteLaxMode
		if isProd {
			sameSite = http.SameSiteNoneMode
		}
		c.SetSameSite(sameSite)
		c.SetCookie("XSRF-TOKEN", token, 7*24*3600, "/", "", isProd, false)
	}
	c.JSON(http.StatusOK, gin.H{"csrfToken": token})
}

// POST /api/v1/auth/logout
func Logout(c *gin.Context) {
	utils.ClearTokenCookie(c)
	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}

// POST /api/v1/auth/logout-all
func LogoutAll(c *gin.Context) {
	role, _ := c.Get("userRole")
	userID, exists := c.Get("userID")

	if exists && role != "admin" {
		collection := "users"
		if role == "driver" {
			collection = "drivers"
		}
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		_, _ = config.DB.Collection(collection).UpdateOne(ctx,
			bson.D{{Key: "_id", Value: userID}},
			bson.D{{Key: "$inc", Value: bson.D{{Key: "tokenVersion", Value: 1}}}},
		)
	}

	utils.ClearTokenCookie(c)
	c.JSON(http.StatusOK, gin.H{"message": "Logged out from all sessions successfully"})
}
