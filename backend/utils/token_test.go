package utils_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"

	"mymate-backend/config"
	"mymate-backend/utils"
)

func TestTokenGenerationAndVerification(t *testing.T) {
	config.AppConfig = &config.Config{
		JWTSecret: "test_secret_for_jwt_validation_12345",
	}

	testID := bson.NewObjectID()
	role := "driver"
	tokenVersion := 2

	tokenStr, err := utils.GenerateToken(testID, role, tokenVersion)
	if err != nil {
		t.Fatalf("GenerateToken failed: %v", err)
	}
	if tokenStr == "" {
		t.Fatalf("Expected non-empty token string")
	}

	claims, err := utils.VerifyToken(tokenStr)
	if err != nil {
		t.Fatalf("VerifyToken failed: %v", err)
	}

	if claims.ID != testID.Hex() {
		t.Errorf("Expected ID %s, got %s", testID.Hex(), claims.ID)
	}
	if claims.Role != role {
		t.Errorf("Expected role %s, got %s", role, claims.Role)
	}
	if claims.TV != tokenVersion {
		t.Errorf("Expected tokenVersion %d, got %d", tokenVersion, claims.TV)
	}
}

func TestVerifyInvalidToken(t *testing.T) {
	config.AppConfig = &config.Config{
		JWTSecret: "test_secret_for_jwt_validation_12345",
	}

	_, err := utils.VerifyToken("invalid.jwt.token")
	if err == nil {
		t.Errorf("Expected error verifying invalid token, got nil")
	}
}

func TestPasswordHashing(t *testing.T) {
	password := "SecretPassword123!"

	hash, err := utils.HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword failed: %v", err)
	}
	if hash == password {
		t.Fatalf("Hash should not be equal to raw password")
	}

	if !utils.ComparePassword(hash, password) {
		t.Errorf("ComparePassword failed for correct password")
	}

	if utils.ComparePassword(hash, "WrongPassword") {
		t.Errorf("ComparePassword should return false for incorrect password")
	}
}

func TestCookieHandling(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)

	testToken := "sample.jwt.token"
	utils.SetTokenCookie(c, testToken)

	cookies := w.Result().Cookies()
	var tokenCookie *http.Cookie
	for _, cookie := range cookies {
		if cookie.Name == "token" {
			tokenCookie = cookie
			break
		}
	}

	if tokenCookie == nil {
		t.Fatalf("Expected token cookie to be set")
	}
	if tokenCookie.Value != testToken {
		t.Errorf("Expected cookie value %s, got %s", testToken, tokenCookie.Value)
	}
	if !tokenCookie.HttpOnly {
		t.Errorf("Expected HttpOnly to be true")
	}

	// Test clear cookie
	wClear := httptest.NewRecorder()
	cClear, _ := gin.CreateTestContext(wClear)
	cClear.Request = httptest.NewRequest(http.MethodPost, "/logout", nil)

	utils.ClearTokenCookie(cClear)
	clearCookies := wClear.Result().Cookies()
	for _, cookie := range clearCookies {
		if cookie.Name == "token" {
			if cookie.MaxAge != -1 {
				t.Errorf("Expected MaxAge -1 for cleared cookie, got %d", cookie.MaxAge)
			}
		}
	}
}
