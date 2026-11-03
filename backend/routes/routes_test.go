package routes_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
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

func TestPrometheusMetricsEndpoint(t *testing.T) {
	r := setupTestEngine()

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for /metrics, got %d", w.Code)
	}

	bodyStr := w.Body.String()
	if !strings.Contains(bodyStr, "mymate_http_requests_total") && !strings.Contains(bodyStr, "go_goroutines") {
		t.Errorf("Expected Prometheus metrics output to contain go or mymate metrics")
	}
}

func TestDriversRadarEndpoint_Validation(t *testing.T) {
	r := setupTestEngine()

	// Table-driven coordinate boundary and query validation scenarios
	scenarios := []struct {
		name         string
		queryString  string
		expectedCode int
	}{
		{
			name:         "Missing all parameters",
			queryString:  "",
			expectedCode: http.StatusBadRequest,
		},
		{
			name:         "Missing lng parameter",
			queryString:  "?lat=28.4595",
			expectedCode: http.StatusBadRequest,
		},
		{
			name:         "Missing lat parameter",
			queryString:  "?lng=77.0266",
			expectedCode: http.StatusBadRequest,
		},
		{
			name:         "Latitude greater than 90 deg north pole",
			queryString:  "?lat=90.0001&lng=77.0266",
			expectedCode: http.StatusBadRequest,
		},
		{
			name:         "Latitude less than -90 deg south pole",
			queryString:  "?lat=-90.0001&lng=77.0266",
			expectedCode: http.StatusBadRequest,
		},
		{
			name:         "Longitude greater than 180 deg antimeridian",
			queryString:  "?lat=28.4595&lng=180.0001",
			expectedCode: http.StatusBadRequest,
		},
		{
			name:         "Longitude less than -180 deg antimeridian",
			queryString:  "?lat=28.4595&lng=-180.0001",
			expectedCode: http.StatusBadRequest,
		},
		{
			name:         "Non-numeric latitude string",
			queryString:  "?lat=invalid_lat&lng=77.0266",
			expectedCode: http.StatusBadRequest,
		},
		{
			name:         "Valid coordinates with default radius",
			queryString:  "?lat=28.4595&lng=77.0266",
			expectedCode: http.StatusOK,
		},
		{
			name:         "Valid coordinates with custom radius 15km",
			queryString:  "?lat=28.4595&lng=77.0266&radius=15",
			expectedCode: http.StatusOK,
		},
		{
			name:         "Valid coordinates with max clamped radius 100km",
			queryString:  "?lat=19.0760&lng=72.8777&radius=100",
			expectedCode: http.StatusOK,
		},
	}

	for _, tt := range scenarios {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/api/v1/drivers/radar"+tt.queryString, nil)
			r.ServeHTTP(w, req)

			if w.Code != tt.expectedCode {
				t.Errorf("Scenario %q failed: expected status %d, got %d", tt.name, tt.expectedCode, w.Code)
			}

			if tt.expectedCode == http.StatusOK {
				var resp map[string]interface{}
				if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
					t.Fatalf("Failed to parse response JSON: %v", err)
				}
				if _, ok := resp["center"]; !ok {
					t.Errorf("Expected 'center' in radar response")
				}
				if _, ok := resp["radiusKm"]; !ok {
					t.Errorf("Expected 'radiusKm' in radar response")
				}
			}
		})
	}
}
