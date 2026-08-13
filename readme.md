# 🚗 MyMate — Local Driver Hiring Platform

[![React 19](https://img.shields.io/badge/Frontend-React%2019%20%7C%20Vite%20%7C%20TailwindCSS%20v4-blue?style=flat-square)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/Backend-Node.js%20%7C%20TypeScript%20%7C%20Express-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Database](https://img.shields.io/badge/Database-MongoDB%20Atlas%20%7C%20Redis-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Event Streaming](https://img.shields.io/badge/Event%20Streaming-Apache%20Kafka-231F20?style=flat-square&logo=apachekafka&logoColor=white)](https://kafka.apache.org/)
[![AI & ML](https://img.shields.io/badge/AI-Google%20Gemini%20%7C%20Tesseract.js-8E75B2?style=flat-square)](https://ai.google.dev/)
[![Payments](https://img.shields.io/badge/Payments-Razorpay-02042B?style=flat-square&logo=razorpay&logoColor=white)](https://razorpay.com/)
[![GraphQL](https://img.shields.io/badge/API-REST%20%7C%20GraphQL%20%7C%20Swagger-E10098?style=flat-square&logo=graphql&logoColor=white)](https://graphql.org/)

**MyMate** is an enterprise-grade, full-stack on-demand and contract driver hiring platform. It seamlessly connects customers with verified, professional local drivers for hourly trips, daily commutes, outstation journeys, and long-term contracts. 

The platform is engineered with a **hybrid distributed architecture**: ultra-low latency real-time communication via **Socket.io & Redis**, coupled with a durable, fault-tolerant **Apache Kafka event-driven messaging layer** for persistent background tasks, audit logging, and transactional workflows.

---

## 🏛️ System Architecture

### 1. High-Level Distributed Architecture
```mermaid
flowchart TB
    subgraph ClientLayer["🖥️ Client Layer (Frontend PWA)"]
        CustomerApp["Customer Portal & PWA\n(React 19 + Vite + Tailwind v4)"]
        DriverApp["Driver Dashboard & PWA\n(Live Dispatch & State Machine)"]
        AdminApp["Admin Management Portal\n(KYC Review & Analytics)"]
    end

    subgraph Gateway["🚪 API Gateway & Server Layer"]
        ExpressApp["Node.js / Express Server (TypeScript)"]
        GraphQL["GraphQL Server (/graphql)"]
        SocketIO["Socket.io WebSocket Server"]
        AuthMiddleware["JWT & 2FA Auth Guard"]
    end

    subgraph DataLayer["💾 Data & Cache Infrastructure"]
        MongoDB[("MongoDB Atlas\n(2dsphere Geospatial & Text Indexes)")]
        RedisDB[("Redis In-Memory Store\n(Socket Mesh & Rate Limiting)")]
        BullMQ["BullMQ Job Queues"]
    end

    subgraph EventStream["⚡ Event Streaming Backbone"]
        KafkaBroker["Apache Kafka Cluster\n(Durable Asynchronous Event Log)"]
    end

    subgraph ExternalServices["🌐 Third-Party Integrations"]
        Gemini["Google Gemini 2.5 Flash (AI Chat & Ranking)"]
        Razorpay["Razorpay Gateway (Checkout & Webhooks)"]
        Cloudinary["Cloudinary CDN (Documents & Avatars)"]
        Brevo["Brevo SMTP (Transactional Emails)"]
        Tesseract["Tesseract.js (KYC OCR Engine)"]
    end

    CustomerApp & DriverApp & AdminApp -->|REST / GraphQL| ExpressApp
    CustomerApp & DriverApp -->|WebSockets (WSS)| SocketIO
    ExpressApp --> AuthMiddleware
    AuthMiddleware --> MongoDB & GraphQL
    ExpressApp --> RedisDB
    RedisDB -.-> SocketIO
    RedisDB --> BullMQ
    ExpressApp -->|Publish Domain Events| KafkaBroker
    ExpressApp --> Gemini & Razorpay & Cloudinary & Tesseract & Brevo
```

---

### 2. Dual-Stream Event & Notification Architecture
MyMate deliberately separates instant ephemeral UI updates from durable business side-effects:

```mermaid
sequenceDiagram
    autonumber
    actor Customer as 👤 Customer
    participant API as 🚪 API Gateway (Express)
    participant DB as 💾 MongoDB Atlas
    participant Socket as ⚡ Socket.io Mesh (Redis)
    participant Kafka as 📨 Apache Kafka
    participant Consumer as ⚙️ Specialized Consumers
    actor Driver as 🚗 Assigned Driver

    Customer->>API: POST /api/v1/bookings (Create Booking)
    API->>DB: Save Booking Record (status: "pending")
    API-->>Customer: 201 Created (Booking Details)

    par Real-Time Ephemeral Stream (Instant UI Push)
        API->>Socket: eventBus.emit("BOOKING_CREATED")
        Socket->>Driver: Socket push: "new_notification" (Audio + Modal Alert)
    and Durable Asynchronous Stream (Kafka Event Log)
        API->>Kafka: publishKafkaEvent("mymate.booking.created")
        Kafka->>Consumer: Consume with offset commit
        Consumer->>DB: Persist in-app Notification records
        Consumer->>Consumer: Dispatch Brevo confirmation email
    end
```

---

### 3. AI Driver Matchmaking & Scoring Engine
```mermaid
flowchart TD
    Start(["📍 User Requests Driver\n(Coords, Vehicle Type, Time)"]) --> Query["🐚 Impure Shell: MongoDB 2dsphere Query\n(Find drivers within radius)"]
    Query --> LoadData["Load Driver Stats (Rating, Trips, Acceptance Rate, Idle Time)"]
    
    LoadData --> ScoringEngine["🧠 Pure Functional Scoring Engine"]
    
    subgraph ScoringEngine["Deterministic Weighted Calculation"]
        S1["Haversine Distance Score (Weight: AI_WEIGHT_DISTANCE)"]
        S2["Driver Rating Score (Weight: AI_WEIGHT_RATING)"]
        S3["Acceptance Rate Score (Weight: AI_WEIGHT_ACCEPT_RATE)"]
        S4["Idle Time Factor Score (Weight: AI_WEIGHT_IDLE)"]
        S1 & S2 & S3 & S4 --> Composite["Compute Weighted Composite Score"]
    end

    Composite --> AICheck{"🤖 Gemini AI Available?"}
    AICheck -- Yes --> GeminiReRank["AI Contextual Re-ranking\n(Vehicle fit, customer preferences, ride history)"]
    AICheck -- Fallback / No --> HeuristicRank["Sort by Composite Score DESC"]

    GeminiReRank --> Output(["Top Ranked Driver Candidates Returned"])
    HeuristicRank --> Output
```

---

## ✨ Complete Feature & Implementation Matrix

### 1. 🚗 Booking & Trip Lifecycle Management
- **Flexible Hire Types**:
  - **Hourly / On-Demand**: Quick point-to-point rides.
  - **Daily**: Full-day dedicated personal driver.
  - **Outstation**: Inter-city multi-day journeys.
  - **Recurring / Contract**: Scheduled weekly or monthly driver subscriptions.
- **Robust State Machine**: Strict status transitions (`pending` → `accepted` → `in_progress` → `completed` / `cancelled`).
- **Dynamic Pricing Engine**: Computes base fare, duration, distance multipliers, vehicle class surcharges, and promo code discounts.
- **Intelligent Cancellation Policies**: Enforces cancellation reason tracking and penalty rules based on trip state.
- **Interactive Routing & Geocoding**: Interactive pickup/drop location picker with OpenStreetMap & Leaflet.

### 2. 👥 Multi-Role User Ecosystem
- **Customer Portal**:
  - Search drivers with real-time filters (rating, vehicle capability, experience, distance).
  - One-click booking with live driver tracking on interactive maps.
  - In-app direct messaging with assigned drivers.
  - Bookmark favorite drivers for quick re-hiring.
  - Multi-criteria rating & review system after trip completion.
- **Driver Portal**:
  - Live dispatch radar with instant audio-visual ride acceptance prompts.
  - Status management (`online` / `offline` toggle, live GPS broadcast).
  - Trip execution controls (Start Trip, Complete Trip, Navigate).
  - Earnings overview, trip history, and driver digital wallet.
- **Admin Management Portal**:
  - Comprehensive dashboard with platform metrics (revenue, total bookings, active drivers).
  - User and Driver lifecycle moderation (activate, suspend, verify).
  - KYC document verification suite with OCR assistance and approval/rejection workflows.
  - Promo code management engine (percentage/fixed discounts, expiry, usage limits).
  - Full audit logging for security-sensitive administrative operations.

### 3. 🤖 AI & Computer Vision Capabilities
- **Google Gemini 2.5 Flash Customer Support AI (`/api/v1/ai/chat`)**:
  - Multi-turn conversational support assistant with memory and markdown rendering.
  - Circuit-breaker protected via **Opossum** for high availability and graceful degradation.
- **AI Driver Matchmaking (`/api/v1/ai/match` & `/api/v1/ai/recommend`)**:
  - Hybrid engine combining a deterministic pure functional scoring model with Gemini AI contextual re-ranking.
- **Automated Driving License OCR Verification (`/api/v1/ai/verify-kyc`)**:
  - **Tesseract.js** OCR pipeline extracting alphanumeric details from driver licenses.
  - Regex-based format validation against Indian Driving License standards with confidence scoring.
- **Geospatial Demand Heatmap (`/api/v1/ai/heatmap`)**:
  - MongoDB `2dsphere` geospatial aggregation identifying high-density booking pickup zones to help drivers reposition efficiently.

### 4. ⚡ Apache Kafka Event-Driven Messaging Layer
MyMate uses **Apache Kafka** (`kafkajs`) to guarantee high-throughput, non-blocking asynchronous event processing:

| Topic Name | Message Key | Payload Summary | Processing Consumer & Side-Effects |
|---|---|---|---|
| `mymate.booking.created` | `bookingId` | Booking ID, Customer details, Driver ID, Hire type | `bookingConsumer`: Persists in-app notifications, dispatches Brevo confirmation emails. |
| `mymate.booking.status_changed` | `bookingId` | Booking ID, previous status, new status, timestamps | `bookingConsumer`: Updates user/driver notification feeds and triggers status alerts. |
| `mymate.payment.completed` | `bookingId` / `orderId` | Booking ID, total amount, driver payout, payment method | `paymentConsumer`: Credits driver wallet, writes immutable audit ledger entries, generates invoice. |
| `mymate.driver.kyc_status` | `driverId` | Driver ID, status (`approved` / `rejected`), review notes | `kycConsumer`: Synchronizes driver live permissions, sends status update emails via SMTP. |

- **Resilient Kafka Producer**: Singleton instance with auto-reconnection, exponential backoff, and JSON serialization.
- **Consumer Groups**: Independent consumer groups (`mymate-consumer-group-booking`, `mymate-consumer-group-payment`, `mymate-consumer-group-kyc`) ensuring horizontal scalability and zero message loss.
- **Dynamic Topic Provisioning**: Automatically provisions required topics on cluster boot with graceful fallback when Kafka is disabled in local test modes (`KAFKA_ENABLED=false`).

### 5. 💳 Payments, Wallets & Financial Engine
- **Razorpay Payment Gateway**: Secure order creation, checkout modal, HMAC-SHA256 signature verification, and webhook handling.
- **Digital Driver Wallet**: Real-time balance accrual upon ride completion, comprehensive transaction history, and payout withdrawal management.
- **Automated PDF Invoicing**: Generates downloadable PDF ride receipts on the fly using **PDFKit**.

### 6. 💬 Real-Time Communication & WebSockets
- **Socket.io + Redis Adapter**: Scalable WebSocket mesh enabling cross-server communication and socket rooms.
- **Live Location Broadcasting**: High-frequency driver GPS coordinate streaming to customer map interfaces.
- **Direct In-App Messaging**: Instant customer-driver chat rooms with unread counters and message persistence.
- **Push Notification Center**: Real-time alert badges, sound effects, and notification history.

### 7. 🔒 Security, Authentication & Guardrails
- **Two-Factor Authentication (2FA)**: Time-based One-Time Password (TOTP) via Authenticator apps (Google Authenticator, Authy) with QR code setup and recovery codes.
- **JWT Authentication & RBAC**: HTTP-only secure cookie tokens, token refresh flows, and role-based route guards (`user`, `driver`, `admin`).
- **Defense in Depth**:
  - **Helmet**: Secures HTTP response headers.
  - **CORS**: Strict domain whitelisting with credential support.
  - **Rate Limiting**: Multi-tiered rate limiting (Auth, Payment, and General API) backed by Redis.
  - **Data Sanitization**: MongoDB query injection protection (`express-mongo-sanitize`), XSS cleaning, and HTTP Parameter Pollution (`hpp`) guards.
- **Fault Tolerance**: Circuit breaker pattern (`opossum`) guarding external AI and third-party API dependencies.

### 8. 📱 Progressive Web App (PWA) & Modern UI/UX
- **React 19 & Vite**: Blazing fast rendering and optimized bundle chunking.
- **TailwindCSS v4**: Modern design system with fluid typography, glassmorphism, and seamless Dark/Light mode toggle.
- **Framer Motion**: Smooth page transitions, skeleton loaders, animated modals, and micro-interactions.
- **PWA Ready**: Offline caching, installable web application shell, and service worker updates via `vite-plugin-pwa`.

### 9. 📊 Observability, APIs & Developer Tools
- **Dual API Architecture**: Comprehensive RESTful API (`/api/v1`) plus Apollo Server **GraphQL** endpoint (`/graphql`).
- **Interactive Swagger Documentation**: Live API explorer available at `/api-docs`.
- **Prometheus Metrics**: System health, request durations, and throughput metrics exported at `/metrics`.
- **Structured Logging**: Production Winston logger with Morgan request tracking.

---

## 🛠️ Technology Stack

```
├── Frontend
│   ├── Framework: React 19 + Vite 8
│   ├── Styling: TailwindCSS v4 + Framer Motion
│   ├── Mapping: Leaflet + React-Leaflet + OpenStreetMap
│   ├── Real-Time: Socket.io-client
│   ├── Forms & Validation: React Hook Form + Zod
│   └── PWA: vite-plugin-pwa + Service Workers
│
├── Backend API
│   ├── Runtime: Node.js (ES Modules) + TypeScript
│   ├── Framework: Express 4
│   ├── GraphQL: Apollo Server (@apollo/server)
│   ├── Authentication: JWT + OTPLib (2FA) + bcryptjs
│   └── Documentation: Swagger UI + swagger-jsdoc
│
├── Distributed Systems & Storage
│   ├── Database: MongoDB Atlas (Mongoose 8) + 2dsphere Geospatial
│   ├── Cache & Socket Adapter: Redis (ioredis)
│   ├── Event Streaming: Apache Kafka (kafkajs)
│   └── Background Workers: BullMQ + Node-Cron
│
├── AI, OCR & Third-Party Services
│   ├── AI Assistant & Ranking: Google Gemini API (@google/genai)
│   ├── Document OCR: Tesseract.js
│   ├── Payments: Razorpay SDK
│   ├── Media Storage: Cloudinary
│   ├── Transactional Email: Brevo SMTP (Nodemailer)
│   └── PDF Generation: PDFKit
│
└── Quality & Observability
    ├── Testing: Jest + ts-jest + Supertest + Vitest
    ├── Metrics: prom-client (Prometheus)
    ├── Circuit Breaker: Opossum
    └── Logging: Winston + Morgan
```

---

## 📂 Project Directory Structure

```
MyMate/
├── backend/
│   ├── config/              # Database, Redis, Kafka, Morgan & Swagger configs
│   ├── controllers/         # REST API route controllers
│   ├── events/              # EventBus listeners and MongoDB change streams
│   ├── graphql/             # Apollo GraphQL type definitions & resolvers
│   ├── kafka/               # Kafka producers, consumer workers & topic registry
│   │   ├── consumers/       # Booking, Payment, and KYC event consumers
│   │   ├── producer.ts      # Resilient event publisher
│   │   └── topics.ts        # Strongly typed topic constants
│   ├── middleware/          # Auth, RBAC, RateLimit, XSS & Error handlers
│   ├── models/              # Mongoose schemas & data models
│   ├── routes/              # Express API route declarations (/api/v1)
│   ├── services/            # Pure scoring engine & KYC OCR services
│   ├── tests/               # Unit, integration & Kafka test suites
│   ├── utils/               # Socket.io, Cron, CircuitBreaker, PricingEngine
│   └── server.ts            # Application bootstrap & lifecycle orchestrator
│
├── frontend/
│   ├── src/
│   │   ├── api/             # Axios API client & interceptors
│   │   ├── components/      # Reusable UI widgets, Modals, Maps & Chatbot
│   │   ├── context/         # Auth, Theme, Socket & Notification contexts
│   │   ├── hooks/           # Custom React hooks (Geolocation, debounce, etc.)
│   │   ├── pages/           # Customer, Driver & Admin page views
│   │   ├── layouts/         # Navigation bars, Footers & Protected Shells
│   │   └── index.css        # TailwindCSS v4 design tokens & theme classes
│   ├── vite.config.js       # Vite configuration with PWA plugin
│   └── package.json
│
└── readme.md                # Project documentation
```

---

## ⚙️ Environment Configuration

Create a `.env` file in the `backend/` directory:

```env
# =================================================================
# Server & Database Configuration
# =================================================================
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/mymate?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_jwt_key_here

# =================================================================
# Redis Configuration (Cache & Socket Mesh)
# =================================================================
REDIS_URL=redis://default:password@your-redis-host:6379

# =================================================================
# Apache Kafka (Cloud Brokers: Aiven, Confluent, Upstash, or Local)
# =================================================================
KAFKA_BROKERS=your-kafka-broker.aivencloud.com:13575
KAFKA_CLIENT_ID=mymate-backend
KAFKA_GROUP_ID=mymate-consumer-group
KAFKA_ENABLED=true
KAFKA_SASL_USERNAME=avnadmin
KAFKA_SASL_PASSWORD=your_sasl_password
KAFKA_SASL_MECHANISM=plain
KAFKA_SSL=true
KAFKA_CA_PATH=ca.pem
# KAFKA_CA_CERT="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"

# =================================================================
# AI & Heuristic Matchmaking Weights
# =================================================================
GEMINI_API_KEY=your_gemini_api_key
AI_WEIGHT_DISTANCE=2.0
AI_WEIGHT_RATING=10.0
AI_WEIGHT_ACCEPT_RATE=0.5
AI_WEIGHT_IDLE=1.0

# =================================================================
# Payments & Media Storage
# =================================================================
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# =================================================================
# Transactional Email (Brevo / SMTP)
# =================================================================
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your_smtp_login
SMTP_PASS=your_smtp_password
SMTP_FROM=support@mymate.com
```

---

## 🚀 Quickstart & Development Guide

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **MongoDB**: Local MongoDB or MongoDB Atlas instance
- **Redis**: Local Redis instance or cloud host (Upstash/Aiven)
- **Apache Kafka** *(Optional in dev)*: Cloud broker (Aiven/Confluent) or toggle `KAFKA_ENABLED=false`

---

### 1. Clone & Install Dependencies

```bash
# Clone the repository
git clone https://github.com/Susil-commits/MyMate.git
cd MyMate

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

---

### 2. Run in Development Mode

```bash
# Start Backend (runs with TSX live watcher & env loader)
cd backend
npm run dev

# In a separate terminal, start Frontend (Vite)
cd frontend
npm run dev
```

- **Frontend App**: `http://localhost:5173`
- **Backend API**: `http://localhost:5000`
- **Swagger Documentation**: `http://localhost:5000/api-docs`
- **GraphQL Playground**: `http://localhost:5000/graphql`
- **Prometheus Metrics**: `http://localhost:5000/metrics`
- **System Health Check**: `http://localhost:5000/health`

---

### 3. Running Test Suites

```bash
# Run backend unit, integration, and Kafka mock tests
cd backend
npm test

# Run frontend tests
cd frontend
npm run test
```

---

### 4. Production Build

```bash
# Backend type check & build
cd backend
npm run build

# Frontend production bundle
cd frontend
npm run build
```

---

## 📄 License & Attribution

Distributed under the **MIT License**. Built with modern open-source web technologies, distributed event streaming, and AI intelligence.
