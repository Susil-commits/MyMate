package config

import (
	"crypto/tls"
	"fmt"
	"log"
	"net/smtp"
	"strings"
)

type EmailPayload struct {
	To      string
	Subject string
	HTML    string
	Text    string
}

func SendEmail(payload EmailPayload) error {
	cfg := AppConfig
	if cfg == nil || cfg.SMTPHost == "" || cfg.SMTPUser == "" {
		log.Printf("[Email Mock] Would send to: %s | Subject: %s", payload.To, payload.Subject)
		return nil
	}

	from := cfg.SMTPFrom
	if from == "" {
		from = cfg.SMTPUser
	}

	headers := make(map[string]string)
	headers["From"] = fmt.Sprintf("MyMate <%s>", from)
	headers["To"] = payload.To
	headers["Subject"] = payload.Subject
	headers["MIME-Version"] = "1.0"
	headers["Content-Type"] = "text/html; charset=UTF-8"

	message := ""
	for k, v := range headers {
		message += fmt.Sprintf("%s: %s\r\n", k, v)
	}
	message += "\r\n" + payload.HTML

	addr := fmt.Sprintf("%s:%d", cfg.SMTPHost, cfg.SMTPPort)
	auth := smtp.PlainAuth("", cfg.SMTPUser, cfg.SMTPPass, cfg.SMTPHost)

	// Attempt connection with TLS or STARTTLS
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("[Email Error] Panic sending email: %v", r)
			}
		}()

		var err error
		if cfg.SMTPPort == 465 {
			tlsconfig := &tls.Config{
				InsecureSkipVerify: false,
				ServerName:         cfg.SMTPHost,
			}
			conn, dialErr := tls.Dial("tcp", addr, tlsconfig)
			if dialErr != nil {
				log.Printf("[Email Error] TLS Dial failed: %v", dialErr)
				return
			}
			defer conn.Close()

			c, clientErr := smtp.NewClient(conn, cfg.SMTPHost)
			if clientErr != nil {
				log.Printf("[Email Error] Client creation failed: %v", clientErr)
				return
			}
			defer c.Quit()

			if auth != nil {
				if err = c.Auth(auth); err != nil {
					log.Printf("[Email Error] Auth failed: %v", err)
					return
				}
			}
			if err = c.Mail(from); err != nil {
				log.Printf("[Email Error] MAIL FROM failed: %v", err)
				return
			}
			if err = c.Rcpt(payload.To); err != nil {
				log.Printf("[Email Error] RCPT TO failed: %v", err)
				return
			}
			w, dataErr := c.Data()
			if dataErr != nil {
				log.Printf("[Email Error] DATA failed: %v", dataErr)
				return
			}
			_, _ = w.Write([]byte(message))
			_ = w.Close()
		} else {
			err = smtp.SendMail(addr, auth, from, []string{payload.To}, []byte(message))
		}

		if err != nil {
			log.Printf("[Email Warning] Failed to send email to %s: %v", payload.To, err)
		} else {
			log.Printf("[Email Sent] Successfully delivered to %s (Subject: %s)", payload.To, payload.Subject)
		}
	}()

	return nil
}

func SendBookingConfirmation(userName, userEmail, driverName, bookingID string) {
	html := fmt.Sprintf("<p>Hi %s, your booking (ID: %s) with %s has been confirmed.</p>", userName, bookingID, driverName)
	_ = SendEmail(EmailPayload{
		To:      userEmail,
		Subject: "Booking Confirmed - MyMate",
		HTML:    html,
	})
}

func SendBookingStatusUpdate(userName, userEmail, bookingID, status string) {
	html := fmt.Sprintf("<p>Hi %s, the status of your booking (ID: %s) has been updated to: <strong>%s</strong>.</p>", userName, bookingID, status)
	_ = SendEmail(EmailPayload{
		To:      userEmail,
		Subject: fmt.Sprintf("Booking Status Update - %s", strings.Title(status)),
		HTML:    html,
	})
}

func SendBookingStatusEmail(userEmail, userName, driverName, status, bookingID string) error {
	SendBookingStatusUpdate(userName, userEmail, bookingID, status)
	return nil
}

func SendPasswordResetEmail(email, resetToken string) {
	clientURL := "http://localhost:5173"
	if AppConfig != nil && AppConfig.ClientURL != "" {
		clientURL = strings.Split(AppConfig.ClientURL, ",")[0]
	}
	resetURL := fmt.Sprintf("%s/reset-password/%s", strings.TrimRight(clientURL, "/"), resetToken)
	html := fmt.Sprintf("<p>You requested a password reset. Please click <a href=\"%s\">here</a> to reset your password. If you didn't request this, ignore this email.</p>", resetURL)
	_ = SendEmail(EmailPayload{
		To:      email,
		Subject: "Password Reset - MyMate",
		HTML:    html,
	})
}

func SendVerificationEmail(email, token string) {
	clientURL := "http://localhost:5173"
	if AppConfig != nil && AppConfig.ClientURL != "" {
		clientURL = strings.Split(AppConfig.ClientURL, ",")[0]
	}
	verifyURL := fmt.Sprintf("%s/verify-email/%s", strings.TrimRight(clientURL, "/"), token)
	html := fmt.Sprintf("<p>Please click <a href=\"%s\">here</a> to verify your email address.</p>", verifyURL)
	_ = SendEmail(EmailPayload{
		To:      email,
		Subject: "Verify your Email - MyMate",
		HTML:    html,
	})
}

func SendKycStatusEmail(driverName, driverEmail, status string) {
	html := fmt.Sprintf("<p>Hi %s, your KYC verification status is now: <strong>%s</strong>.</p>", driverName, status)
	_ = SendEmail(EmailPayload{
		To:      driverEmail,
		Subject: fmt.Sprintf("KYC Status Update - %s", strings.Title(status)),
		HTML:    html,
	})
}
