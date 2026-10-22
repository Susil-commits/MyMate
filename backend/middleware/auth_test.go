package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"mymate-backend/config"
	"mymate-backend/middleware"
)

func TestProtect_MissingToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	config.AppConfig = &config.Config{
		JWTSecret: "test_secret_for_auth_testing",
	}

	r := gin.New()
	r.Use(middleware.Protect())
	r.GET("/protected", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "success"})
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401 Unauthorized for missing token, got %d", w.Code)
	}
}

func TestProtect_InvalidToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	config.AppConfig = &config.Config{
		JWTSecret: "test_secret_for_auth_testing",
	}

	r := gin.New()
	r.Use(middleware.Protect())
	r.GET("/protected", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "success"})
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer invalid.jwt.signature")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401 Unauthorized for invalid token, got %d", w.Code)
	}
}

func TestRoleAuthorizers(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name       string
		role       string
		authorizer gin.HandlerFunc
		wantStatus int
	}{
		{
			name:       "Driver accessing Driver endpoint",
			role:       "driver",
			authorizer: middleware.AuthorizeDriver(),
			wantStatus: http.StatusOK,
		},
		{
			name:       "User accessing Driver endpoint",
			role:       "user",
			authorizer: middleware.AuthorizeDriver(),
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "Admin accessing Admin endpoint",
			role:       "admin",
			authorizer: middleware.AuthorizeAdmin(),
			wantStatus: http.StatusOK,
		},
		{
			name:       "Driver accessing Admin endpoint",
			role:       "driver",
			authorizer: middleware.AuthorizeAdmin(),
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "User accessing UserOrDriver endpoint",
			role:       "user",
			authorizer: middleware.AuthorizeUserOrDriver(),
			wantStatus: http.StatusOK,
		},
		{
			name:       "Driver accessing UserOrDriver endpoint",
			role:       "driver",
			authorizer: middleware.AuthorizeUserOrDriver(),
			wantStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := gin.New()
			// Mock Protect setting the role
			r.Use(func(c *gin.Context) {
				c.Set("userRole", tt.role)
				c.Next()
			})
			r.Use(tt.authorizer)
			r.GET("/resource", func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"status": "granted"})
			})

			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/resource", nil)
			r.ServeHTTP(w, req)

			if w.Code != tt.wantStatus {
				t.Errorf("%s: got status %d, want %d", tt.name, w.Code, tt.wantStatus)
			}
		})
	}
}

func TestOptionalAuth_AllowsUnauthenticated(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(middleware.OptionalAuth())
	r.GET("/public-with-optional-user", func(c *gin.Context) {
		role, _ := c.Get("userRole")
		c.JSON(http.StatusOK, gin.H{"userRole": role})
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/public-with-optional-user", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("OptionalAuth should allow unauthenticated access, got status %d", w.Code)
	}
}
