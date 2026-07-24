# MyMate - Local Driver Hiring Platform

MyMate is a modern web application designed to connect users with verified local drivers for temporary or long-term hiring.

## Key Features
- **Role-Based Authentication**: Secure access for both Users (customers) and Drivers.
- **Locality-Based Search**: Find drivers nearby with advanced filtering (experience, rating, vehicle type, hourly/daily rate).
- **Secure Authentication**: Uses `httpOnly` secure cookies for sessions, preventing XSS and securing tokens.
- **Real-Time Communication**: WebSocket-powered live messaging between users and drivers.
- **Booking Management**: Seamlessly book drivers, track booking statuses, and manage payments.
- **Admin Dashboard**: Comprehensive dashboard for admins to verify KYC and monitor platform statistics.
- **Progressive Web App (PWA)**: Installable, offline-capable, and optimized for mobile devices with a 90+ Lighthouse score.
- **High-Performance UI**: Modern and premium design using React, TailwindCSS, and Framer Motion for animations.

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
