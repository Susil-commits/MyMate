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
