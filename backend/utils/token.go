package utils

import (
	"errors"
	"net/http"
	"time"

	"mymate-backend/config"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/v2/bson"
	"golang.org/x/crypto/bcrypt"
)

type JWTClaims struct {
	ID   string `json:"id"`
	Role string `json:"role"`
	TV   int    `json:"tv"`
	jwt.RegisteredClaims
}

const AuthCookieMaxAge = 7 * 24 * 3600 // 7 days in seconds

func GenerateToken(id bson.ObjectID, role string, tokenVersion int) (string, error) {
	cfg := config.AppConfig
	secret := []byte(cfg.JWTSecret)

	claims := JWTClaims{
		ID:   id.Hex(),
		Role: role,
		TV:   tokenVersion,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(secret)
}

func VerifyToken(tokenString string) (*JWTClaims, error) {
	cfg := config.AppConfig
	secret := []byte(cfg.JWTSecret)

	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return secret, nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*JWTClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token")
}

func SetTokenCookie(c *gin.Context, token string) {
	isProd := config.AppConfig.AppEnv == "production"
	sameSite := http.SameSiteLaxMode
	if isProd {
		sameSite = http.SameSiteNoneMode
	}

	c.SetSameSite(sameSite)
	c.SetCookie(
		"token",
		token,
		AuthCookieMaxAge,
		"/",
		"",
		isProd,
		true, // HttpOnly
	)
}

func SetAuthCookie(c *gin.Context, token string) {
	SetTokenCookie(c, token)
}

func ClearTokenCookie(c *gin.Context) {
	isProd := config.AppConfig.AppEnv == "production"
	sameSite := http.SameSiteLaxMode
	if isProd {
		sameSite = http.SameSiteNoneMode
	}

	c.SetSameSite(sameSite)
	c.SetCookie(
		"token",
		"",
		-1,
		"/",
		"",
		isProd,
		true,
	)
}

func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

func ComparePassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}
