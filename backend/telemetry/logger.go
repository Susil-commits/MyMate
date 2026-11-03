package telemetry

import (
	"log/slog"
	"os"
	"time"

	"github.com/gin-gonic/gin"
)

var Logger *slog.Logger

func init() {
	opts := &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}
	Logger = slog.New(slog.NewJSONHandler(os.Stdout, opts))
	slog.SetDefault(Logger)
}

// StructuredLogger intercepts every incoming HTTP request and outputs a structured JSON log
func StructuredLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		duration := time.Since(start)

		status := c.Writer.Status()
		path := c.Request.URL.Path
		method := c.Request.Method
		clientIP := c.ClientIP()
		userAgent := c.Request.UserAgent()
		correlationID := c.GetString("correlationId")
		if correlationID == "" {
			correlationID = c.GetHeader("X-Correlation-Id")
		}

		var userID string
		if uid, exists := c.Get("userId"); exists {
			userID = uid.(string)
		}

		attrs := []slog.Attr{
			slog.String("correlationId", correlationID),
			slog.String("method", method),
			slog.String("path", path),
			slog.Int("status", status),
			slog.Float64("durationMs", float64(duration.Microseconds())/1000.0),
			slog.String("clientIp", clientIP),
			slog.String("userAgent", userAgent),
		}
		if userID != "" {
			attrs = append(attrs, slog.String("userId", userID))
		}

		msg := "HTTP request completed"
		if len(c.Errors) > 0 {
			attrs = append(attrs, slog.String("error", c.Errors.String()))
		}

		switch {
		case status >= 500:
			Logger.LogAttrs(c.Request.Context(), slog.LevelError, msg, attrs...)
		case status >= 400:
			Logger.LogAttrs(c.Request.Context(), slog.LevelWarn, msg, attrs...)
		default:
			Logger.LogAttrs(c.Request.Context(), slog.LevelInfo, msg, attrs...)
		}
	}
}

// Helper application logging methods
func LogInfo(msg string, args ...any) {
	if Logger != nil {
		Logger.Info(msg, args...)
	}
}

func LogWarn(msg string, args ...any) {
	if Logger != nil {
		Logger.Warn(msg, args...)
	}
}

func LogError(msg string, err error, args ...any) {
	if Logger != nil {
		allArgs := append([]any{"error", err}, args...)
		Logger.Error(msg, allArgs...)
	}
}
