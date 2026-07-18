# MyMate - Driver Hiring Platform 🚗

MyMate is a comprehensive MERN-stack application that connects users with professional drivers. Whether you need a driver for a few hours (temporary hire) or on a permanent basis, MyMate provides a seamless platform for finding, booking, and reviewing drivers based on locality and experience.

## ✨ Key Features

### For Users
- **Browse & Filter:** Search for drivers by locality, experience, rating, and vehicle types.
- **Booking Flow:** Request drivers for temporary (hourly) or permanent (daily) needs.
- **Secure Payments:** Integrated Razorpay checkout for fast, reliable payments.
- **Reviews & Ratings:** Leave reviews for drivers after completing a trip.
- **Real-time Chat:** Communicate directly with drivers regarding your booking.

### For Drivers
- **Profile Management:** Set your hourly/daily rates, vehicle expertise, and experience.
- **Booking Management:** Accept or reject incoming booking requests.
- **Earnings & Dashboard:** Track completed jobs, total earnings, and average ratings.
- **Real-time Notifications:** Get notified instantly of new booking requests.

---

## 🛠️ Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS v4, React Router v7, Socket.io-client
- **Backend:** Node.js, Express, MongoDB (Mongoose), Socket.io, Cloudinary (Image Uploads)
- **Authentication:** JWT (JSON Web Tokens), bcryptjs
- **Payments:** Razorpay API

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [MongoDB](https://www.mongodb.com/) (Local or Atlas)
- [Razorpay Account](https://razorpay.com/) (For API Keys)
- [Cloudinary Account](https://cloudinary.com/) (For Image Uploads)

### 1. Clone & Install Dependencies
```bash
git clone <repository-url>
cd MyMate

# Install root, backend, and frontend dependencies concurrently
npm run install:all
```

### 2. Environment Variables

Create a `.env` file in the `backend/` directory:
```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_super_secret_jwt_string
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
ADMIN_CODE=your_admin_secret_code
```

Create a `.env` file in the `frontend/` directory:
```env
VITE_API_URL=http://localhost:5000/api
VITE_RAZORPAY_KEY_ID=your_razorpay_key_id
```

### 3. Run Locally

You can run both frontend and backend concurrently from the root folder:

```bash
npm run dev
```

- **Frontend:** `http://localhost:5173`
- **Backend:** `http://localhost:5000`

---

## 🌍 Production Deployment

### Backend (e.g., Render)
1. Set the Build Command to `npm run build` and Start Command to `npm start`.
2. Add all backend environment variables from your local `.env`.
3. Set `NODE_ENV=production`.
4. Ensure `CLIENT_URL` points to your deployed frontend (e.g., `https://my-mate.vercel.app`).

### Frontend (e.g., Vercel)
1. Deploy the `frontend/` directory.
2. Set `VITE_API_URL` to your deployed backend URL (e.g., `https://api.mymate.com/api`).
3. Set `VITE_RAZORPAY_KEY_ID`.
