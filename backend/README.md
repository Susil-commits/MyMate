# 🚀 MyMate Golang Backend Engine

High-performance, enterprise-grade backend infrastructure for the MyMate On-Demand Driver Hiring Platform, written in **Golang 1.24** using the **Gin Gonic** web framework.

---

## 🏗️ Architectural Overview

The backend was migrated from Node.js/Express to Go to achieve:
1. **Ultra-Low Latency & High Concurrency**: Non-blocking I/O with native Go goroutines scaling across CPU cores without the overhead of the Node.js event loop.
2. **Minimal Memory Footprint**: Base memory footprint reduced from ~180MB down to **~20MB**.
3. **Compile-Time Safety**: Zero runtime reference errors or unexpected undefined states.
4. **Single Static Binary**: Compiled down to a single ~20MB Linux binary (`CGO_ENABLED=0`) with zero external runtime dependencies.
5. **Full API Backward Compatibility**: Retains 100% parity with all frontend requests across `/api/v1` and `/api` route prefixes.

---

## 📁 Package Directory Topology

```
backend/
├── cmd/
│   └── seed/
│       └── main.go           # Database seeder (Admin, 4 verified drivers, 3 bookings)
├── config/
│   ├── config.go             # Environment variable loader with defaults
│   ├── db.go                 # MongoDB Go driver connection pool & ping health check
│   └── kafka.go              # Kafka SASL/TLS producer & topic setup
├── controllers/
│   ├── admin_controller.go   # Admin analytics, KYC reviews, user moderation, audit logs
│   ├── ai_controller.go      # Gemini 2.5 Flash chatbot & driver recommendation
│   ├── audit_controller.go   # Immutable audit log queries
│   ├── auth_controller.go    # Register, login, logout, refresh, profile, CSRF tokens
│   ├── booking_controller.go # Booking creation, accept, start, complete, cancel, status
│   ├── driver_controller.go  # Driver registration, availability, location, search, stats
│   ├── favorite_controller.go# User bookmarking & favorite drivers management
│   ├── message_controller.go # Chat conversation & direct messaging persistence
│   ├── notification_controller.go # User & driver in-app notifications
│   ├── payment_controller.go # Razorpay order creation & HMAC-SHA256 webhook handler
│   ├── promo_controller.go   # Promotional voucher creation and validation
│   ├── review_controller.go  # Driver ratings and customer reviews
│   ├── two_factor_controller.go # TOTP 2FA setup, QR code generation & verification
│   └── wallet_controller.go  # Driver wallet ledger, balance, commission split, payouts
├── middleware/
│   ├── auth.go               # JWT authentication guard & RBAC (Customer, Driver, Admin)
│   ├── cors.go               # Strict origin whitelisting & CORS headers
│   ├── csrf.go               # HMAC-SHA256 double-submit cookie CSRF validation
│   ├── idempotency.go        # Payment and booking idempotency protection
│   ├── rate_limiter.go       # Tiered IP-based rate limiting
│   └── recovery.go           # Panic recovery middleware returning 500 JSON
├── models/
│   ├── admin.go              # Admin account model
│   ├── audit.go              # System audit log record model
│   ├── booking.go            # Booking state machine model
│   ├── conversation.go       # Chat conversation model
│   ├── driver.go             # Driver profile, endorsements & geospatial location model
│   ├── favorite.go           # Driver favorite bookmark model
│   ├── message.go            # Direct chat message model
│   ├── notification.go       # In-app notification alert model
│   ├── payment.go            # Razorpay transaction model
│   ├── promo.go              # Promotional discount coupon model
│   ├── review.go             # Customer feedback & rating model
│   ├── user.go               # Customer account model
│   └── wallet.go             # Driver earnings & transaction ledger model
├── routes/
│   └── routes.go             # Gin engine setup, middleware chain & dual route binding
├── services/
│   ├── ai_service.go         # Gemini AI contextual re-ranking & chat client
│   ├── cache.go              # In-memory TTL cache for driver queries and stats
│   ├── cron.go               # Scheduled jobs (hourly stale booking cancellation)
│   ├── driver_matching.go    # Pure mathematical weighted driver ranking engine
│   ├── kyc_service.go        # Driver license OCR extraction and verification
│   └── pricing_engine.go     # Dynamic hourly/daily pricing & surge calculation
├── socket/
│   └── socket.go             # Gorilla WebSocket connection pool, rooms & dispatch hub
├── utils/
│   ├── calendar.go           # Booking calendar and schedule helpers
│   ├── errors.go             # Custom error abstractions
│   ├── response.go           # Uniform JSON response envelope `{success, data, message}`
│   └── token.go              # JWT creation, cookie extraction & password hashing
├── build.sh                  # Universal build script (auto-installs Go in Node runtimes)
├── go.mod                    # Go 1.24 module definitions
├── go.sum                    # Dependency checksums
└── main.go                   # Application entrypoint & HTTP server lifecycle
```

---

## 🛠️ Environment Configuration

Create a `.env` file in `backend/` (or set environment variables on your cloud provider):

```env
# Application Core
PORT=5000
APP_ENV=development                   # development | production | test
CLIENT_URL=http://localhost:5173       # Comma-separated allowed frontend origins

# Persistence (MongoDB Atlas)
MONGO_URI=mongodb+srv://<user>:<password>@clustercoffee.hn2pcni.mongodb.net/mymate?retryWrites=true&w=majority

# Authentication & Security
JWT_SECRET=super_secret_jwt_random_key_here
ADMIN_CODE=admlogin8984
ADMIN_EMAIL=nayaksushil298@gmail.com

# Fintech (Razorpay)
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret

# AI & Contextual Intelligence
GEMINI_API_KEY=your_gemini_api_key

# Event Streaming (Apache Kafka - Optional for local dev)
KAFKA_BROKERS=localhost:9092
KAFKA_ENABLED=false                    # Set true when Kafka cluster is connected
```

---

## 🚀 Local Development Commands

### 1. Run the Development Server
```bash
go run main.go
```
The server will bind to `http://localhost:5000` with hot database connection verification.

### 2. Seed Initial Test Data
```bash
go run cmd/seed/main.go
```
This populates MongoDB with:
- **Admin**: `nayaksushil298@gmail.com`
- **4 Active Drivers**: Verified driving partners in Mumbai & Navi Mumbai with sample ratings and coordinates.
- **3 Completed Bookings**: Generates revenue metrics and completed trip statistics for the dashboard.

### 3. Run Automated Tests
```bash
# Run all unit and integration tests with data race detection
go test -v -race ./...

# Run a specific package's tests (e.g. routes or middleware)
go test -v ./routes
go test -v ./middleware
```

### 4. Build Production Binary
```bash
# Compile optimized static binary with stripped debug symbols
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o server main.go
```

---

## 🔒 Security Architecture

1. **Authentication**: Dual token extraction. Checks `jwt` HTTP-only cookie first; falls back to `Authorization: Bearer <token>` for programmatic API consumers.
2. **Double-Submit CSRF**: In production, mutation requests (`POST`, `PUT`, `DELETE`, `PATCH`) require an `X-XSRF-TOKEN` header matching the HMAC-signed `xsrf_token` cookie.
3. **Fail-Closed CORS**: Requests from unlisted origins receive an immediate `403 Forbidden` response.
4. **Rate Limiting**: Tiered IP token bucket protecting public endpoints from credential stuffing and scraping attacks.
5. **Database Safety**: MongoDB parameters are passed via BSON structured documents, eliminating NoSQL injection vectors.

---

## 🌐 Health & Monitoring Endpoints

| Endpoint | Method | Response | Purpose |
|:---|:---|:---|:---|
| `/health` | `GET` | `{"status":"ok","uptime":...}` | Liveness probe for Render/Kubernetes |
| `/health/ready` | `GET` | `{"status":"ready","database":"connected"}` | Readiness probe verifying 5s MongoDB ping |
| `/api/csrf-token` | `GET` | `{"csrfToken":"..."}` | Issue CSRF token for frontend forms |
| `/api/public/stats` | `GET` | `{"success":true,"data":{...}}` | Public platform KPI counters |
