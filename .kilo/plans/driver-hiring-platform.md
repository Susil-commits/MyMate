# MyMate - Driver Hiring Platform (MERN)

## Overview
A MERN stack web application where users can hire drivers on a temporary or permanent basis, filtered by locality. Drivers register with their credentials, driving details, and nationality. Users browse, filter, review, and hire drivers.

---

## Tech Stack
- **Frontend:** React 19, Vite 8, Tailwind CSS v4, React Router v7, Axios
- **Backend:** Node.js, Express.js, MongoDB + Mongoose, JWT Auth, bcryptjs, express-validator
- **State:** React Context API (auth, booking)
- **File Upload:** multer (driver documents/license images)

---

## Project Structure

```
MyMate/
├── frontend/          (existing - will be rebuilt)
│   └── src/
│       ├── api/           axios instance + API helpers
│       ├── assets/         
│       ├── components/     shared UI components
│       ├── context/        AuthContext, BookingContext
│       ├── hooks/          custom hooks
│       ├── layouts/        MainLayout, AuthLayout, DriverLayout
│       ├── pages/          page-level components
│       └── utils/          helpers, constants
├── backend/           (new)
│   ├── config/        db.js, env config
│   ├── controllers/   auth, driver, booking, review, user
│   ├── middleware/     auth middleware, error handler, upload
│   ├── models/        User, Driver, Booking, Review
│   ├── routes/        API route definitions
│   ├── utils/         helpers, validators
│   ├── server.js      entry point
│   └── uploads/       driver document uploads
└── .env               MONGO_URI, JWT_SECRET, PORT
```

---

## Database Models

### 1. User (Customer)
| Field | Type | Notes |
|---|---|---|
| name | String | required |
| email | String | unique, required |
| password | String | hashed |
| phone | String | required |
| locality | String | city/area (for matching) |
| role | String | "user" (default) |
| createdAt | Date | timestamps |

### 2. Driver
| Field | Type | Notes |
|---|---|---|
| name | String | required |
| email | String | unique, required |
| password | String | hashed |
| phone | String | required |
| nationality | String | required |
| locality | String | required, used for search |
| licenseNumber | String | required, unique |
| licenseImage | String | file path |
| experienceYears | Number | required |
| vehicleTypes | [String] | ["Car", "SUV", "Van", "Truck"] |
| availability | String | "available" / "busy" / "offline" |
| hourlyRate | Number | for temporary hire |
| dailyRate | Number | for permanent/long-term |
| languages | [String] | spoken languages |
| bio | String | short description |
| documentsVerified | Boolean | admin verification |
| averageRating | Number | computed from reviews |
| totalReviews | Number | computed |
| isActive | Boolean | soft delete |
| createdAt | Date | timestamps |

### 3. Booking
| Field | Type | Notes |
|---|---|---|
| user | ObjectId | ref: User |
| driver | ObjectId | ref: Driver |
| hireType | String | "temporary" / "permanent" |
| status | String | "pending" / "accepted" / "ongoing" / "completed" / "cancelled" |
| startDate | Date | required |
| endDate | Date | nullable (permanent = indefinite) |
| pickupLocation | String | |
| dropLocation | String | |
| purpose | String | reason for hiring |
| totalAmount | Number | computed |
| paymentStatus | String | "pending" / "paid" |
| createdAt | Date | |

### 4. Review
| Field | Type | Notes |
|---|---|---|
| user | ObjectId | ref: User |
| driver | ObjectId | ref: Driver |
| booking | ObjectId | ref: Booking |
| rating | Number | 1-5 |
| comment | String | |
| createdAt | Date | |

### 5. Payment
| Field | Type | Notes |
|---|---|---|
| booking | ObjectId | ref: Booking |
| user | ObjectId | ref: User |
| driver | ObjectId | ref: Driver |
| amount | Number | total paid |
| currency | String | "usd" / "inr" |
| paymentMethod | String | "stripe" / "razorpay" |
| paymentIntentId | String | Stripe PaymentIntent ID or Razorpay Order ID |
| status | String | "pending" / "completed" / "failed" / "refunded" |
| paidAt | Date | |
| createdAt | Date | |

---

## API Routes

### Auth (`/api/auth`)
- `POST /user/register` — user registration
- `POST /user/login` — user login, returns JWT
- `POST /driver/register` — driver registration
- `POST /driver/login` — driver login, returns JWT
- `GET /me` — get current user/driver profile (protected)

### Drivers (`/api/drivers`)
- `GET /` — list drivers (query: locality, experience, rating, hireType, vehicleType, page, limit)
- `GET /:id` — get driver profile + reviews
- `PUT /profile` — update driver profile (driver-only)
- `GET /:id/reviews` — get reviews for a driver

### Bookings (`/api/bookings`)
- `POST /` — create booking request (user)
- `GET /` — get user's bookings or driver's bookings (based on role)
- `PUT /:id/status` — update booking status (accept/reject/complete)
- `GET /:id` — booking details

### Reviews (`/api/reviews`)
- `POST /` — submit review (user, requires completed booking)
- `GET /driver/:driverId` — get all reviews for driver
- `PUT /:id` — edit review
- `DELETE /:id` — delete review

### Payments (`/api/payments`)
- `POST /create-intent` — create Stripe PaymentIntent or Razorpay order
- `POST /confirm` — confirm payment after client-side completion
- `GET /booking/:bookingId` — get payment status for a booking

### Users (`/api/users`)
- `GET /profile` — get user profile
- `PUT /profile` — update profile
- `GET /bookings` — user's booking history

---

## Frontend Pages & Routes

| Route | Page | Access |
|---|---|---|
| `/` | Landing Page | Public |
| `/user/login` | User Login | Public |
| `/user/register` | User Register | Public |
| `/driver/login` | Driver Login | Public |
| `/driver/register` | Driver Register | Public |
| `/drivers` | Browse/Search Drivers | User |
| `/drivers/:id` | Driver Profile + Reviews + Book | User |
| `/bookings` | My Bookings (User) | User |
| `/bookings/:id` | Booking Details + Payment | User |
| `/driver/dashboard` | Driver Dashboard | Driver |
| `/driver/profile` | Edit Driver Profile | Driver |
| `/driver/bookings` | Driver Booking Requests | Driver |
| `/profile` | User Profile Settings | User |

---

## Component Tree (Key Components)

```
App
├── AuthProvider (context)
├── Routes
│   ├── PublicLayout
│   │   ├── LandingPage
│   │   ├── UserLoginPage
│   │   ├── UserRegisterPage
│   │   ├── DriverLoginPage
│   │   └── DriverRegisterPage
│   ├── UserLayout (protected - user)
│   │   ├── Navbar
│   │   ├── DriverSearchPage
│   │   │   ├── SearchFilters (locality, experience, rating, vehicle, hire type)
│   │   │   └── DriverCard[]
│   │   ├── DriverProfilePage
│   │   │   ├── DriverInfo
│   │   │   ├── BookingForm (modal with date picker, hire type, purpose, pickup/drop)
│   │   │   └── ReviewList + ReviewCard[]
│   │   ├── BookingsPage
│   │   │   └── BookingCard[]
│   │   ├── BookingDetailPage
│   │   │   ├── BookingStatusTracker
│   │   │   ├── PaymentSection (Stripe/Razorpay)
│   │   │   └── ReviewForm (shown after completion)
│   │   └── UserProfilePage
│   └── DriverLayout (protected - driver)
│       ├── DriverDashboard
│       ├── DriverProfileEdit
│       └── DriverBookingsPage
```

---

## Implementation Phases

### Phase 1: Backend Foundation
1. Initialize `backend/` with `npm init`, install dependencies
2. Set up Express server with CORS, JSON parsing, env config
3. Connect MongoDB with Mongoose
4. Create all 4 models (User, Driver, Booking, Review)
5. Implement JWT auth middleware
6. Build Auth routes & controllers (register/login for both roles)

### Phase 2: Backend APIs
1. Driver routes & controllers (CRUD, search with filters, pagination)
2. Booking routes & controllers (create, status updates, listing)
3. Review routes & controllers (CRUD, linked to completed bookings)
4. Payment routes & controllers (Stripe PaymentIntent creation, webhook/confirmation)
5. User profile routes
6. File upload middleware for driver license

### Phase 3: Frontend Foundation
1. Install frontend deps: react-router-dom, axios, react-icons
2. Set up Axios instance with base URL and JWT interceptor
3. Build AuthContext with login/register/logout + token persistence
4. Create route guards (ProtectedRoute for user vs driver roles)
5. Define all routes in App.jsx with React Router

### Phase 4: Frontend Pages
1. Landing page (hero, features, CTA, role selection — "I need a driver" / "I am a driver")
2. User Login & Register pages (email, password, name, phone, locality)
3. Driver Login & Register pages (same + license, experience, vehicle types, rates, nationality)
4. Driver Search page with filters (locality input, experience range, rating, vehicle type, hire type) + card grid
5. Driver Profile page (full details, reviews, "Book Now" button)
6. Booking flow modal (date picker, hire type selection, purpose, pickup/drop location inputs)
7. Payment page (Stripe Elements for card input, amount display from calculated rates)
8. User's Bookings page (list with status badges: pending/accepted/ongoing/completed)
9. Booking detail page with status tracker + payment section + review form (post-completion)
10. User profile/settings page
11. Driver Dashboard (stats: total bookings, earnings, average rating)
12. Driver Profile Edit form (all driver fields)
13. Driver's Booking Requests page (accept/reject incoming requests, manage ongoing)

### Phase 5: Polish & Features
1. Rating & review submission after booking completion
2. Average rating computation on driver model
3. Search/filter debouncing
4. Loading skeletons, error states, empty states
5. Toast notifications for actions
6. Responsive design throughout

---

## Key Dependencies

### Backend (`package.json`)
```json
{
  "dependencies": {
    "express": "^4.21.0",
    "mongoose": "^8.8.0",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express-validator": "^7.2.0",
    "multer": "^1.4.5-lts.1",
    "stripe": "^17.5.0"
  }
}
```

### Frontend (additions to existing)
```json
{
  "dependencies": {
    "react-router-dom": "^7.1.0",
    "axios": "^1.7.0",
    "react-icons": "^5.3.0",
    "react-hot-toast": "^2.4.1"
  }
}
```

---

## Key Design Decisions
- **Separate User/Driver models** rather than a single model with roles — they have fundamentally different fields
- **Separate auth pages** — `/user/login`, `/user/register`, `/driver/login`, `/driver/register` with dedicated forms
- **JWT with role claim** — `{ id, role: "user" | "driver" }` in token payload
- **Filtering by locality** uses regex partial match on driver's locality field (text-based, no maps API)
- **Booking flow**: User sends request → Driver accepts/rejects → Booking confirmed → Payment → Trip → Review
- **Rating** is computed on driver model (updated on each new review) to avoid expensive aggregations
- **Hire types**: "temporary" uses hourly rate, "permanent" uses daily rate, calculated on booking creation
- **Payments via Stripe**: Stripe PaymentIntent created server-side, confirmed client-side with Stripe Elements
- **File uploads** for license images stored locally in `backend/uploads/`, served as static files

---

## `.env` Configuration
```
MONGO_URI=mongodb://localhost:27017/mymate
JWT_SECRET=your_jwt_secret_here
PORT=5000
NODE_ENV=development
STRIPE_SECRET_KEY=sk_test_xxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxx
CLIENT_URL=http://localhost:5173
```