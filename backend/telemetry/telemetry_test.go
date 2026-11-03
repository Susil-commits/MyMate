package telemetry_test

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	dto "github.com/prometheus/client_model/go"

	"mymate-backend/telemetry"
)

func TestStructuredLogger_AttributesAndJsonFormat(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Intercept slog output into an in-memory buffer
	logBuffer := new(bytes.Buffer)
	originalLogger := telemetry.Logger
	telemetry.Logger = slog.New(slog.NewJSONHandler(logBuffer, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	}))
	defer func() {
		telemetry.Logger = originalLogger
	}()

	r := gin.New()
	r.Use(telemetry.StructuredLogger())
	r.GET("/api/v1/test-telemetry", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "telemetry_ok"})
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/test-telemetry", nil)
	req.Header.Set("X-Correlation-Id", "corr-test-12345")
	req.Header.Set("User-Agent", "Go-Test-Agent/1.0")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got %d", w.Code)
	}

	logOutput := strings.TrimSpace(logBuffer.String())
	if logOutput == "" {
		t.Fatalf("Expected structured log line in buffer, but buffer is empty")
	}

	// Verify the log line is valid JSON with required observability attributes
	var logRecord map[string]interface{}
	if err := json.Unmarshal([]byte(logOutput), &logRecord); err != nil {
		t.Fatalf("Failed to parse log record as JSON: %v. Raw: %s", err, logOutput)
	}

	if logRecord["correlationId"] != "corr-test-12345" {
		t.Errorf("Expected correlationId 'corr-test-12345', got %v", logRecord["correlationId"])
	}
	if logRecord["method"] != "GET" {
		t.Errorf("Expected method 'GET', got %v", logRecord["method"])
	}
	if logRecord["path"] != "/api/v1/test-telemetry" {
		t.Errorf("Expected path '/api/v1/test-telemetry', got %v", logRecord["path"])
	}
	if logRecord["status"] != float64(200) {
		t.Errorf("Expected status 200, got %v", logRecord["status"])
	}
	if logRecord["level"] != "INFO" {
		t.Errorf("Expected level 'INFO' for 200 OK, got %v", logRecord["level"])
	}
	if _, ok := logRecord["durationMs"]; !ok {
		t.Errorf("Expected durationMs attribute in structured log")
	}
}

// Table-driven test verifying log levels for various HTTP response status codes
func TestStructuredLogger_LogLevelThresholds(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name          string
		statusCode    int
		expectedLevel string
	}{
		{"200 OK outputs INFO", http.StatusOK, "INFO"},
		{"201 Created outputs INFO", http.StatusCreated, "INFO"},
		{"400 Bad Request outputs WARN", http.StatusBadRequest, "WARN"},
		{"404 Not Found outputs WARN", http.StatusNotFound, "WARN"},
		{"429 Too Many Requests outputs WARN", http.StatusTooManyRequests, "WARN"},
		{"500 Internal Server Error outputs ERROR", http.StatusInternalServerError, "ERROR"},
		{"503 Service Unavailable outputs ERROR", http.StatusServiceUnavailable, "ERROR"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			logBuffer := new(bytes.Buffer)
			originalLogger := telemetry.Logger
			telemetry.Logger = slog.New(slog.NewJSONHandler(logBuffer, &slog.HandlerOptions{
				Level: slog.LevelDebug,
			}))
			defer func() {
				telemetry.Logger = originalLogger
			}()

			r := gin.New()
			r.Use(telemetry.StructuredLogger())
			r.GET("/status-test", func(c *gin.Context) {
				c.Status(tt.statusCode)
			})

			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/status-test", nil)
			r.ServeHTTP(w, req)

			logLine := strings.TrimSpace(logBuffer.String())
			var record map[string]interface{}
			if err := json.Unmarshal([]byte(logLine), &record); err != nil {
				t.Fatalf("Failed to decode JSON: %v", err)
			}

			if record["level"] != tt.expectedLevel {
				t.Errorf("Status %d: expected level %q, got %q", tt.statusCode, tt.expectedLevel, record["level"])
			}
		})
	}
}

func TestPrometheusMiddleware_MetricsTracking(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := gin.New()
	r.Use(telemetry.PrometheusMiddleware())
	r.GET("/api/v1/test-metric-endpoint", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/test-metric-endpoint", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got %d", w.Code)
	}

	// Verify Prometheus counter for this path was registered
	metricCounter := telemetry.HttpRequestsTotal.WithLabelValues("GET", "/api/v1/test-metric-endpoint", "200")
	var m dto.Metric
	if err := metricCounter.Write(&m); err != nil {
		t.Fatalf("Failed to read counter metric: %v", err)
	}

	if m.Counter == nil || *m.Counter.Value < 1 {
		t.Errorf("Expected HttpRequestsTotal to be at least 1, got %v", m.Counter.GetValue())
	}
}

func TestActiveWebSocketsGauge(t *testing.T) {
	initialMetric := &dto.Metric{}
	_ = telemetry.ActiveWebSockets.Write(initialMetric)
	initialVal := 0.0
	if initialMetric.Gauge != nil {
		initialVal = initialMetric.Gauge.GetValue()
	}

	telemetry.ActiveWebSockets.Inc()
	incMetric := &dto.Metric{}
	_ = telemetry.ActiveWebSockets.Write(incMetric)
	if incMetric.Gauge.GetValue() != initialVal+1 {
		t.Errorf("Expected ActiveWebSockets to increment by 1, got %v", incMetric.Gauge.GetValue())
	}

	telemetry.ActiveWebSockets.Dec()
	decMetric := &dto.Metric{}
	_ = telemetry.ActiveWebSockets.Write(decMetric)
	if decMetric.Gauge.GetValue() != initialVal {
		t.Errorf("Expected ActiveWebSockets to decrement back to %v, got %v", initialVal, decMetric.Gauge.GetValue())
	}
}

func TestPrometheusMiddleware_SkipsScrapeEndpoint(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := gin.New()
	r.Use(telemetry.PrometheusMiddleware())
	r.GET("/metrics", func(c *gin.Context) {
		c.String(http.StatusOK, "# prometheus text output")
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for /metrics, got %d", w.Code)
	}

	// Check that /metrics route is NOT incremented in HttpRequestsTotal
	metricCounter := telemetry.HttpRequestsTotal.WithLabelValues("GET", "/metrics", "200")
	var m dto.Metric
	_ = metricCounter.Write(&m)
	if m.Counter != nil && m.Counter.GetValue() > 0 {
		t.Errorf("Expected /metrics request to be skipped by Prometheus middleware, but got counter value %v", m.Counter.GetValue())
	}
}

