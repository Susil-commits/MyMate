package config

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"log"
	"os"
	"time"

	"github.com/segmentio/kafka-go"
	"github.com/segmentio/kafka-go/sasl/plain"
)

const (
	TopicBookingCreated       = "mymate.booking.created"
	TopicBookingStatusChanged = "mymate.booking.status_changed"
	TopicPaymentCompleted     = "mymate.payment.completed"
	TopicDriverKycStatus      = "mymate.driver.kyc_status"
)

var (
	kafkaWriter *kafka.Writer
	kafkaReader *kafka.Reader
	kafkaActive bool
)

func InitKafka() {
	cfg := AppConfig
	if cfg == nil || !cfg.KafkaEnabled || len(cfg.KafkaBrokers) == 0 {
		log.Println("[Kafka] Kafka messaging disabled via configuration.")
		return
	}

	var dialer *kafka.Dialer

	var tlsConfig *tls.Config
	if cfg.KafkaSSL {
		tlsConfig = &tls.Config{
			InsecureSkipVerify: false,
		}
		if cfg.KafkaCAPath != "" {
			caCert, err := os.ReadFile(cfg.KafkaCAPath)
			if err == nil {
				caCertPool := x509.NewCertPool()
				caCertPool.AppendCertsFromPEM(caCert)
				tlsConfig.RootCAs = caCertPool
			} else {
				log.Printf("[Kafka Warning] Could not load CA file %s: %v", cfg.KafkaCAPath, err)
			}
		}
	}

	dialer = &kafka.Dialer{
		Timeout:   10 * time.Second,
		DualStack: true,
		TLS:       tlsConfig,
	}

	if cfg.KafkaSASLUsername != "" && cfg.KafkaSASLPassword != "" {
		dialer.SASLMechanism = plain.Mechanism{
			Username: cfg.KafkaSASLUsername,
			Password: cfg.KafkaSASLPassword,
		}
	}

	kafkaWriter = &kafka.Writer{
		Addr:         kafka.TCP(cfg.KafkaBrokers...),
		Balancer:     &kafka.LeastBytes{},
		Transport:    &kafka.Transport{
			Dial: dialer.DialFunc,
			TLS:  tlsConfig,
			SASL: dialer.SASLMechanism,
		},
		BatchTimeout: 10 * time.Millisecond,
		Async:        true,
	}

	kafkaActive = true
	log.Printf("[Kafka] Producer initialized for brokers: %v", cfg.KafkaBrokers)
}

func PublishKafkaEvent(topic, key string, payload interface{}) {
	if !kafkaActive || kafkaWriter == nil {
		return
	}

	bytes, err := json.Marshal(payload)
	if err != nil {
		log.Printf("[Kafka Error] Marshal failed for topic %s: %v", topic, err)
		return
	}

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		err := kafkaWriter.WriteMessages(ctx, kafka.Message{
			Topic: topic,
			Key:   []byte(key),
			Value: bytes,
			Time:  time.Now(),
		})
		if err != nil {
			log.Printf("[Kafka Warning] Failed to publish event to %s: %v", topic, err)
		} else {
			log.Printf("[Kafka Event Published] Topic: %s | Key: %s", topic, key)
		}
	}()
}

func PublishKafkaMessage(topic, key string, payload interface{}) error {
	PublishKafkaEvent(topic, key, payload)
	return nil
}

func IsKafkaConnected() bool {
	return kafkaActive && kafkaWriter != nil
}

func StopKafka() {
	if kafkaWriter != nil {
		_ = kafkaWriter.Close()
	}
	if kafkaReader != nil {
		_ = kafkaReader.Close()
	}
}
