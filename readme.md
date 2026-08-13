# MyMate - Local Driver Hiring Platform

## 📖 Overview
MyMate is a modern web application designed to seamlessly connect users with verified local drivers for temporary or long-term hiring. It prioritizes security, real-time tracking, and intelligent driver matching to deliver a premium user experience.

## 🤖 AI System Architecture & Capabilities
MyMate features a fully configured, production-ready AI ecosystem powered by Google Gemini 2.5 Flash, Tesseract.js OCR, and functional pure-core heuristic engines:

1. **Multi-Turn AI Chatbot (`/api/v1/ai/chat`)**
   - Built with Google Gemini (`@google/genai`) and Opossum Circuit Breakers.
   - Client-side history context replay for multi-turn conversation memory.
   - Interactive widget with quick-reply chips, markdown rendering, unread message badges, and dark mode support.

2. **AI-Powered & Pure-Core Driver Matching (`/api/v1/ai/recommend` & `/api/v1/ai/match`)**
   - **Gemini Matchmaking**: Dynamically analyzes ratings, experience, vehicle types, and Haversine distance to recommend top matching drivers.
   - **Pure Functional Core Engine**: Impure-shell/pure-core architecture separating DB reads from deterministic driver scoring logic. Configurable weights via environment variables (`AI_WEIGHT_DISTANCE`, `AI_WEIGHT_RATING`, etc.).

3. **Automated KYC License Verification (`/api/v1/ai/verify-kyc`)**
   - Tesseract.js OCR processing pipeline for driving license verification.
   - Pattern matching against Indian driving license formats with confidence scoring, document quality flags, and automated admin approval recommendations.

4. **Live Demand Heatmaps (`/api/v1/ai/heatmap`)**
   - MongoDB geospatial aggregation pipeline generating live driver hotspots based on actual booking pickup coordinates.

## 🏗️ Architecture & System Design
MyMate is built using a highly scalable, observable, and resilient distributed architecture. 

### Core Design Patterns
- **Pure Core / Impure Shell**: The driver-matching scoring logic is completely decoupled from I/O operations (database access, time). This ensures that business logic is 100% pure and highly testable, with I/O handled in a separate shell function.
- **API Evolution**: Features a robust GraphQL (Apollo Server) endpoint alongside a versioned `/api/v1` REST interface to optimize data fetching.

### Enterprise Features
- **Scalability & Caching**: Utilizes Redis connection pooling, global route caching, and distributed rate limiting to reduce database load.
- **Resilience**: Implements circuit breakers (Opossum) for external API calls to prevent cascading failures, alongside Redis-backed idempotency keys to eliminate duplicate transactions.
- **Asynchronous Processing**: Heavy I/O operations, such as email dispatching, are decoupled using BullMQ job queues and Node.js EventEmitters.
- **Advanced Querying**: Features MongoDB `2dsphere` geographic indexing for location-based queries and weighted `$text` inverted indexes for fast text searches. Administrative analytics are offloaded to read replicas.
- **Real-Time State Management**: Frontend synchronization is handled via MongoDB Change Streams and Socket.io with a Redis adapter for multi-server broadcasting.
- **Observability**: Integrated Prometheus metrics, a Bull-Board queue dashboard, Swagger interactive documentation, and comprehensive deep health checks.

## ✨ Key Features
- **Advanced Driver Matching**: AI Gemini ranking paired with pure-core heuristic scoring (Rating + Experience + Haversine Proximity) instantly pairs users with the best drivers.
- **Real-Time Tracking & Routing**: Live location tracking and dynamic routing maps powered by WebSockets and Leaflet Routing Machine.
- **Automated KYC OCR**: Instant AI-powered Driving License verification using Tesseract.js with regex format validation.
- **Comprehensive Booking System**: Supports recurring bookings, multi-stop trips, and dynamic surge pricing.
- **Live Demand Heatmaps**: Visualizes live booking hotspots from MongoDB coordinates to help drivers optimize earnings.
- **Integrated Financials**: Features a digital wallet (Razorpay), dynamic promo codes, and downloadable PDF invoices.
- **Interactive AI Assistant**: Floating multi-turn AI support widget powered by Google Gemini with quick-reply prompts and markdown support.
- **Platform Security & Integrity**: Two-Factor Authentication (2FA), secure role-based access, and an automated fraud detection system that auto-suspends suspicious accounts.
- **Modern User Experience**: A Progressive Web App (PWA) with top-tier Lighthouse scores, dark/light mode toggling, and elegant micro-animations via Framer Motion.

## 🛠️ Technology Stack
- **Frontend**: React (Vite), TailwindCSS, Framer Motion, Socket.io-client
- **Backend**: Node.js, Express, MongoDB (Mongoose), Socket.io, Redis, GraphQL (Apollo Server)
- **AI & ML**: Google Gemini API (`@google/genai`), Tesseract.js OCR, Opossum Circuit Breaker
- **Infrastructure**: BullMQ, Prometheus, Swagger UI, Bull-Board

## 🚀 Getting Started

### Prerequisites
- Node.js (v16+)
- MongoDB
- Redis (Optional, for caching & queues)

### Setup & Run
1. **Clone the repository.**
2. **Install dependencies:** Navigate to both the `backend` and `frontend` directories and install dependencies using your preferred package manager.
3. **Environment Configuration:** Set up your environment variables securely in `backend/.env`. Ensure the following configurations are provided:
   - `MONGO_URI`, `JWT_SECRET`
   - `GEMINI_API_KEY` (Get a free key from [Google AI Studio](https://aistudio.google.com/app/apikey))
   - AI Weights: `AI_WEIGHT_DISTANCE`, `AI_WEIGHT_RATING`, `AI_WEIGHT_ACCEPT_RATE`, `AI_WEIGHT_IDLE`
   - Third-party Integrations (Razorpay, Cloudinary, Email SMTP)
4. **Start the application:** Run the development servers for both the frontend and backend to launch the application locally.

---
*Built with modern web technologies for reliability, performance, and AI-driven intelligence.*
