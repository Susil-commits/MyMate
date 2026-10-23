package config

import (
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port                       string
	AppEnv                     string
	MongoURI                   string
	JWTSecret                  string
	ClientURL                  string
	AllowedOrigins             []string
	RazorpayKeyID              string
	RazorpayKeySecret          string
	RazorpayWebhookSecret      string
	CloudinaryCloudName        string
	CloudinaryAPIKey           string
	CloudinaryAPISecret        string
	AdminCode                  string
	AdminEmail                 string
	SMTPHost                   string
	SMTPPort                   int
	SMTPUser                   string
	SMTPPass                   string
	SMTPFrom                   string
	GeminiAPIKey               string
	AIWeightDistance           float64
	AIWeightRating             float64
	AIWeightAcceptRate         float64
	AIWeightIdle               float64
	KafkaBrokers               []string
	KafkaClientID              string
	KafkaGroupID               string
	KafkaEnabled               bool
	KafkaSASLUsername          string
	KafkaSASLPassword          string
	KafkaSASLMechanism         string
	KafkaSSL                   bool
	KafkaCAPath                string
	RedisURL                   string
	DisableRedis               bool
	DriverWalletSplitPct       float64
}

var AppConfig *Config

func LoadConfig() *Config {
	// Load .env if present
	_ = godotenv.Load(".env")

	port := getEnv("PORT", "5000")
	mongoURI := getEnv("MONGO_URI", "")
	jwtSecret := getEnv("JWT_SECRET", "mymate_jwt_2026_key")
	clientURL := getEnv("CLIENT_URL", "http://localhost:5173")

	allowedOrigins := []string{}
	for _, o := range strings.Split(clientURL, ",") {
		trimmed := strings.TrimRight(strings.TrimSpace(o), "/")
		if trimmed != "" {
			allowedOrigins = append(allowedOrigins, trimmed)
		}
	}
	if len(allowedOrigins) == 0 {
		allowedOrigins = append(allowedOrigins, "http://localhost:5173")
	}

	smtpPort, _ := strconv.Atoi(getEnv("SMTP_PORT", "587"))
	distWeight, _ := strconv.ParseFloat(getEnv("AI_WEIGHT_DISTANCE", "2"), 64)
	ratingWeight, _ := strconv.ParseFloat(getEnv("AI_WEIGHT_RATING", "10"), 64)
	acceptWeight, _ := strconv.ParseFloat(getEnv("AI_WEIGHT_ACCEPT_RATE", "0.5"), 64)
	idleWeight, _ := strconv.ParseFloat(getEnv("AI_WEIGHT_IDLE", "1"), 64)

	kafkaBrokersRaw := getEnv("KAFKA_BROKERS", "localhost:9092")
	var kafkaBrokers []string
	for _, b := range strings.Split(kafkaBrokersRaw, ",") {
		trimmed := strings.TrimSpace(b)
		if trimmed != "" {
			kafkaBrokers = append(kafkaBrokers, trimmed)
		}
	}

	splitPct, err := strconv.ParseFloat(getEnv("DRIVER_WALLET_SPLIT_PERCENTAGE", "0.9"), 64)
	if err != nil || splitPct < 0 || splitPct > 1 {
		splitPct = 0.9
	}

	appEnv := getEnv("APP_ENV", "")
	if appEnv == "" {
		appEnv = getEnv("NODE_ENV", "development")
	}

	AppConfig = &Config{
		Port:                  port,
		AppEnv:                appEnv,
		MongoURI:              mongoURI,
		JWTSecret:             jwtSecret,
		ClientURL:             clientURL,
		AllowedOrigins:        allowedOrigins,
		RazorpayKeyID:         getEnv("RAZORPAY_KEY_ID", ""),
		RazorpayKeySecret:     getEnv("RAZORPAY_KEY_SECRET", ""),
		RazorpayWebhookSecret: getEnv("RAZORPAY_WEBHOOK_SECRET", ""),
		CloudinaryCloudName:   getEnv("CLOUDINARY_CLOUD_NAME", ""),
		CloudinaryAPIKey:      getEnv("CLOUDINARY_API_KEY", ""),
		CloudinaryAPISecret:   getEnv("CLOUDINARY_API_SECRET", ""),
		AdminCode:             getEnv("ADMIN_CODE", "admlogin8984"),
		AdminEmail:            getEnv("ADMIN_EMAIL", "nayaksushil298@gmail.com"),
		SMTPHost:              getEnv("SMTP_HOST", "smtp-relay.brevo.com"),
		SMTPPort:              smtpPort,
		SMTPUser:              getEnv("SMTP_USER", ""),
		SMTPPass:              getEnv("SMTP_PASS", ""),
		SMTPFrom:              getEnv("SMTP_FROM", "nayaksushil298@gmail.com"),
		GeminiAPIKey:          getEnv("GEMINI_API_KEY", ""),
		AIWeightDistance:      distWeight,
		AIWeightRating:        ratingWeight,
		AIWeightAcceptRate:    acceptWeight,
		AIWeightIdle:          idleWeight,
		KafkaBrokers:          kafkaBrokers,
		KafkaClientID:         getEnv("KAFKA_CLIENT_ID", "mymate-backend"),
		KafkaGroupID:          getEnv("KAFKA_GROUP_ID", "mymate-consumer-group"),
		KafkaEnabled:          getEnv("KAFKA_ENABLED", "true") == "true",
		KafkaSASLUsername:     getEnv("KAFKA_SASL_USERNAME", ""),
		KafkaSASLPassword:     getEnv("KAFKA_SASL_PASSWORD", ""),
		KafkaSASLMechanism:    getEnv("KAFKA_SASL_MECHANISM", "plain"),
		KafkaSSL:              getEnv("KAFKA_SSL", "false") == "true",
		KafkaCAPath:           getEnv("KAFKA_CA_PATH", "ca.pem"),
		RedisURL:              getEnv("REDIS_URL", "redis://localhost:6379"),
		DisableRedis:          getEnv("DISABLE_REDIS", "false") == "true",
		DriverWalletSplitPct:  splitPct,
	}

	if AppConfig.MongoURI == "" && AppConfig.AppEnv != "test" {
		log.Println("WARNING: MONGO_URI is not set in environment!")
	}

	return AppConfig
}

func getEnv(key, defaultVal string) string {
	val, exists := os.LookupEnv(key)
	if !exists || val == "" {
		return defaultVal
	}
	return val
}
