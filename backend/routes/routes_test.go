package routes_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"mymate-backend/config"
	"mymate-backend/routes"
)

func setupTestEngine() *gin.Engine {
	gin.SetMode(gin.TestMode)
	config.AppConfig = &config.Config{
		JWTSecret:      "test_jwt_secret_for_routes_testing_12345",
		AllowedOrigins: []string{"http://localhost:5173"},
		AppEnv:         "test",
		DisableRedis:   true,
	}

	r := gin.New()
	routes.SetupRoutes(r)
	return r
}

func TestHealthEndpoint(t *testing.T) {
	r := setupTestEngine()

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200 for /health, got %d", w.Code)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("Failed to parse JSON response: %v", err)
	}

	if body["status"] != "ok" {
		t.Errorf("Expected status 'ok', got %v", body["status"])
	}
	if body["timestamp"] == nil || body["timestamp"] == "" {
		t.Errorf("Expected non-empty timestamp")
	}
}

func TestHealthReadyEndpoint(t *testing.T) {
	r := setupTestEngine()

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/health/ready", nil)
	r.ServeHTTP(w, req)

	// In test mode without DB connection, readiness returns 503 with dependency report
	if w.Code != http.StatusOK && w.Code != http.StatusServiceUnavailable {
		t.Fatalf("Expected status 200 or 503 for /health/ready, got %d", w.Code)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("Failed to parse JSON response: %v", err)
	}

	if body["dependencies"] == nil {
		t.Errorf("Expected dependencies object in /health/ready response")
	}
}

func TestCsrfTokenEndpoints(t *testing.T) {
	r := setupTestEngine()

	endpoints := []string{"/api/v1/auth/csrf-token", "/api/auth/csrf-token"}

	for _, endpoint := range endpoints {
		t.Run(endpoint, func(t *testing.T) {
			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, endpoint, nil)
			r.ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Fatalf("Expected 200 OK for %s, got %d", endpoint, w.Code)
			}

			var body map[string]string
			if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
				t.Fatalf("Failed to parse JSON response: %v", err)
			}

			if body["csrfToken"] == "" {
				t.Errorf("Expected non-empty csrfToken in response for %s", endpoint)
			}

			var xsrfCookieFound bool
			for _, cookie := range w.Result().Cookies() {
				if cookie.Name == "XSRF-TOKEN" {
					xsrfCookieFound = true
					break
				}
			}
			if !xsrfCookieFound {
				t.Errorf("Expected XSRF-TOKEN cookie to be set for %s", endpoint)
			}
		})
	}
}

func TestNotFoundRoute(t *testing.T) {
	r := setupTestEngine()

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/non-existent-api-path", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("Expected 404 for unknown route, got %d", w.Code)
	}
}

func TestPublicDriverStatsEndpoint(t *testing.T) {
	r := setupTestEngine()

	endpoints := []string{"/api/v1/drivers/stats", "/api/drivers/stats"}
	for _, ep := range endpoints {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, ep, nil)
		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK for %s, got %d", ep, w.Code)
		}

		var stats map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &stats); err != nil {
			t.Fatalf("Failed to parse stats json: %v", err)
		}

		if _, ok := stats["driverCount"]; !ok {
			t.Errorf("Expected driverCount field in %s", ep)
		}
		if _, ok := stats["tripCount"]; !ok {
			t.Errorf("Expected tripCount field in %s", ep)
		}
	}
}
