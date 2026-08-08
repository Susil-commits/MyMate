# MyMate - Local Driver Hiring Platform

MyMate is a modern web application designed to connect users with verified local drivers for temporary or long-term hiring.

## Key Features
- **Security & Accounts**: Two-Factor Authentication (2FA), Secure Role-Based Access, Profile Avatars, and User/Driver specific dashboards.
- **Advanced Booking System**: Recurring Bookings, Multi-Stop Trips, Surge Pricing, and seamless Booking Management.
- **Smart Driver Matching**: AI heuristic scoring (Rating + Experience + Proximity) to instantly find the best drivers.
- **Automated KYC (OCR)**: Tesseract.js integration for instant AI-powered Driving License verification.
- **AI Chatbot Support**: Floating AI assistant powered by Google Gemini to help users navigate the app and understand pricing.
- **Interactive Routing & Live Tracking**: WebSocket-powered live location tracking with dynamic routing maps (Leaflet Routing Machine).
- **Demand Heatmaps**: Live booking hotspots visualized on a Heatmap to help drivers maximize earnings.
- **Financials & Exporting**: Digital Wallet (Razorpay), dynamic Promo Codes, downloadable PDF Invoices, and `.ics` Calendar sync.
- **Real-Time Communication**: Socket.io-powered live messaging between users and drivers.
- **Platform Integrity**: Node-cron automated Fraud Detection system (auto-suspends excessive cancellations).
- **Dark/Light Mode**: Full system-wide theme toggling integrated tightly with TailwindCSS.
- **Progressive Web App (PWA)**: Installable, offline-capable, and completely optimized for mobile devices with top-tier Lighthouse scores.
- **High-Performance UI**: Modern, premium design using React, TailwindCSS, and Framer Motion for elegant micro-animations.

## Architecture Highlights
- **Pure Core / Impure Shell Pattern**: The driver-matching scoring logic is completely decoupled from I/O (Database access, Time). The business logic (`scoreDriver` and `rankDrivers` in `backend/utils/driverScoring.ts`) is 100% pure. All I/O stays in a separate "shell" function (`driverMatchingService.ts`) that handles fetching drivers and config before delegating to the pure functions. This separation dramatically improves testability and correctness. A standalone Haskell Proof of Concept exploring this pattern further is available in `/fp-poc`.

## Enterprise System Design Upgrades
Over five iterative phases, the MyMate backend was overhauled from a monolithic REST server into a highly scalable, observable, and resilient distributed architecture:
- **Scalability & Caching**: Shifted load away from MongoDB by implementing **Redis Connection Pooling**, global route caching (`redisClient.get/setEx`), and distributed rate limiting (`RedisStore`).
- **Resilience & Safety**: Integrated **Opossum Circuit Breakers** around external API calls (Google Gemini) to prevent catastrophic cascading failures, and implemented **Idempotency Keys** using Redis to completely eliminate duplicate charges on network retries.
- **Asynchronous Processing**: Decoupled heavy I/O operations (like email dispatching) using **BullMQ** job queues and the internal Node.js `EventEmitter` (EventBus pattern).
- **Advanced Data & Search**: Upgraded geographic queries using native MongoDB `2dsphere` indexes, implemented weighted `$text` inverted indexes for lightning-fast text searches, and shifted heavy admin analytics to **MongoDB Read Replicas** (`secondaryPreferred`) to maximize throughput.
- **Real-Time State**: Synchronized the frontend effortlessly via **MongoDB Change Streams** combined with **Socket.io + Redis Adapter** for horziontal multi-server broadcasting.
- **API Evolution**: Built a robust **GraphQL (Apollo Server)** endpoint alongside the versioned `/api/v1` REST interface to solve frontend over-fetching.
- **Observability**: Added enterprise monitoring via **Prometheus Metrics** (`prom-client`), an interactive **Bull-Board Queue Dashboard**, auto-generated **Swagger Interactive Documentation**, and comprehensive **Deep Health Checks** that actively ping both Redis and MongoDB.

## Tech Stack
- **Frontend**: React (Vite), TailwindCSS, Framer Motion, Socket.io-client, React Router.
- **Backend**: Node.js, Express, MongoDB (Mongoose), Socket.io, JSON Web Tokens (JWT).
- **Performance**: Optimized builds with chunking, compression, and PWA capabilities.

## Getting Started

### Prerequisites
- Node.js (v16+)
- MongoDB (running locally or remote)

### Installation
1. Clone the repository
2. Install backend dependencies: `cd backend && npm install`
3. Install frontend dependencies: `cd frontend && npm install`

### Environment Variables
Configure the following in `backend/.env`:
```
PORT=5000
MONGODB_URI=your_mongo_db_uri
JWT_SECRET=your_jwt_secret
NODE_ENV=production
FRONTEND_URL=http://localhost:5173

# Email Configurations (For Auth & Booking Status)
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_pass
EMAIL_FROM="noreply@mymate.com"

# Payment Configurations (For Wallet & Bookings)
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
```

Configure the following in `frontend/.env`:
```
VITE_API_URL=http://localhost:5000/api
```

### Running the App
1. Start the backend: `cd backend && npm run dev`
2. Start the frontend: `cd frontend && npm run dev`

## Production Build
To prepare for production:
```bash
cd frontend
npm run build
```
This generates an optimized static bundle in the `dist` directory.

## License
MIT
