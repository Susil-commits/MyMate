# MyMate - Local Driver Hiring Platform

## 📖 Overview
MyMate is a modern web application designed to seamlessly connect users with verified local drivers for temporary or long-term hiring. It prioritizes security, real-time tracking, and intelligent driver matching to deliver a premium user experience.

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
- **Advanced Driver Matching**: AI heuristic scoring (Rating + Experience + Proximity) instantly pairs users with the best drivers.
- **Real-Time Tracking & Routing**: Live location tracking and dynamic routing maps powered by WebSockets and Leaflet Routing Machine.
- **Automated KYC**: Instant AI-powered Driving License verification using Tesseract.js.
- **Comprehensive Booking System**: Supports recurring bookings, multi-stop trips, and dynamic surge pricing.
- **Demand Heatmaps**: Visualizes live booking hotspots to help drivers optimize their earnings.
- **Integrated Financials**: Features a digital wallet (Razorpay), dynamic promo codes, and downloadable PDF invoices.
- **AI Chatbot Support**: Floating AI assistant powered by Google Gemini for user guidance.
- **Platform Security & Integrity**: Two-Factor Authentication (2FA), secure role-based access, and an automated fraud detection system that auto-suspends suspicious accounts.
- **Modern User Experience**: A Progressive Web App (PWA) with top-tier Lighthouse scores, dark/light mode toggling, and elegant micro-animations via Framer Motion.

## 🛠️ Technology Stack
- **Frontend**: React (Vite), TailwindCSS, Framer Motion, Socket.io-client
- **Backend**: Node.js, Express, MongoDB (Mongoose), Socket.io, Redis, GraphQL (Apollo Server)
- **Infrastructure**: BullMQ, Prometheus

## 🚀 Getting Started

### Prerequisites
- Node.js (v16+)
- MongoDB
- Redis (Optional, for caching & queues)

### Setup & Run
1. **Clone the repository.**
2. **Install dependencies:** Navigate to both the `backend` and `frontend` directories and install dependencies using your preferred package manager.
3. **Environment Configuration:** Set up your environment variables securely. Ensure the following configurations are provided:
   - Database URIs (MongoDB, Redis)
   - Security Keys (JWT Secrets)
   - Third-party Integrations (Email SMTP, Payment Gateway Keys)
   - Application URLs
4. **Start the application:** Run the development servers for both the frontend and backend to launch the application locally.

---
*Built with modern web technologies for reliability and performance.*
