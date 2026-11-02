# 🔌 MyMate REST & WebSocket API Specification

Comprehensive technical specification for the **MyMate Backend API Gateway**, powered by **Golang 1.24 (Gin)**.

---

## 📑 Table of Contents

- [Gateway Architecture & Conventions](#-gateway-architecture--conventions)
- [Authentication & Security](#-authentication--security)
- [Uniform Response Envelope](#-uniform-response-envelope)
- [Status Codes & Error Handling](#-status-codes--error-handling)
- [Authentication & Identity Endpoints (`/auth`)](#-authentication--identity-endpoints-auth)
- [Customer Management Endpoints (`/users`)](#-customer-management-endpoints-users)
- [Driver Discovery & Profile Endpoints (`/drivers`)](#-driver-discovery--profile-endpoints-drivers)
- [Booking Lifecycle Endpoints (`/bookings`)](#-booking-lifecycle-endpoints-bookings)
- [Payments & Fintech Endpoints (`/payments`)](#-payments--fintech-endpoints-payments)
- [Driver Reviews & Ratings (`/reviews`)](#-driver-reviews--ratings-reviews)
- [Driver Bookmarks (`/favorites`)](#-driver-bookmarks-favorites)
- [In-App Messaging & Conversations (`/messages`)](#-in-app-messaging--conversations-messages)
- [In-App Notifications (`/notifications`)](#-in-app-notifications-notifications)
- [Two-Factor Security (`/2fa`)](#-two-factor-security-2fa)
- [Driver & User Wallet (`/wallet`)](#-driver--user-wallet-wallet)
- [Promotional Discount Codes (`/promos`)](#-promotional-discount-codes-promos)
- [Enterprise Admin Governance (`/admin`)](#-enterprise-admin-governance-admin)
- [AI Intelligence & Contextual Re-Ranking (`/ai`)](#-ai-intelligence--contextual-re-ranking-ai)
- [Real-Time WebSocket Protocol](#-real-time-websocket-protocol)

---

## 🏛️ Gateway Architecture & Conventions

### Dual Route Surface
To guarantee 100% backward compatibility with legacy frontends and microservices, the API exposes identical handlers across two prefixes:
- **v1 Primary**: `/api/v1/*`
- **Legacy Compatibility**: `/api/*`

All request payloads, parameters, and responses are identical across both prefixes.

### Protocol Headers
| Header | Type | Description |
|:---|:---|:---|
| `Content-Type` | String | Must be `application/json` for mutation requests (`POST`, `PUT`, `PATCH`). |
| `Authorization` | String | Bearer token format: `Bearer <jwt_token>` (used if HTTP-only cookie is absent). |
| `X-XSRF-TOKEN` | String | HMAC-SHA256 CSRF verification token matching the `xsrf_token` cookie. |
| `X-Correlation-Id` | String | Distributed tracing identifier propagated across all downstream logs and Kafka events. |
| `Idempotency-Key` | String | Optional UUID for payment and booking requests to guarantee at-most-once processing. |

---

## 🔒 Authentication & Security

### Dual Token Verification Strategy
1. **HTTP-Only Cookie (Primary)**: The server sets a `jwt` cookie with `HttpOnly`, `SameSite=None`, and `Secure` attributes upon successful login.
2. **Bearer Token (Fallback)**: Native mobile clients or third-party integrations can pass `Authorization: Bearer <jwt>`.

### Role-Based Access Control (RBAC)
Endpoints are guarded by middleware requiring specific claims inside the JWT token:
- `user`: Standard customer booking rides.
- `driver`: Verified driving partner accepting dispatches.
- `admin`: Platform administrator managing KYC, users, and financial records.

### Double-Submit HMAC CSRF Protection
All non-GET requests require a valid CSRF token. To obtain a token:
```http
GET /api/v1/auth/csrf-token
```
Response:
```json
{
  "csrfToken": "4e18b871c8de817b1160352ad14ef267595305fce93fbe0a184511d73a7f8059"
}
```
Clients must include this value in the `X-XSRF-TOKEN` request header for subsequent `POST`, `PUT`, and `DELETE` calls.

---

## 📦 Uniform Response Envelope

All API endpoints return JSON conforming to the standardized envelope:

### Success Response Envelope
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}
```

### Error Response Envelope
```json
{
  "success": false,
  "error": "Descriptive error message",
  "code": "RESOURCE_NOT_FOUND"
}
```

---

## 🚦 Status Codes & Error Handling

| Code | Status | Meaning |
|:---|:---|:---|
| `200` | OK | Request succeeded; returned payload in `data`. |
| `201` | Created | Resource successfully created (e.g. booking, user registration). |
| `400` | Bad Request | Validation failed; missing required fields or invalid format. |
| `401` | Unauthorized | Missing, expired, or cryptographically invalid JWT token. |
| `403` | Forbidden | Insufficient RBAC role or failed HMAC CSRF verification. |
| `404` | Not Found | Target resource ID does not exist. |
| `409` | Conflict | Duplicate resource (e.g., email address already registered). |
| `429` | Too Many Requests | Rate limit threshold exceeded. Wait before retrying. |
| `500` | Internal Server Error | Handled panic or unexpected server fault with correlation trace. |

---

## 🔑 Authentication & Identity Endpoints (`/auth`)

### 1. Register Customer
```http
POST /api/v1/auth/user/register
```
**Request Body**:
```json
{
  "name": "Alex Johnson",
  "email": "alex@example.com",
  "password": "SecurePassword123!",
  "phone": "+919876543210"
}
```
**Response (`201 Created`)**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "671ca102948b849201948a11",
      "name": "Alex Johnson",
      "email": "alex@example.com",
      "role": "user",
      "isEmailVerified": false
    },
    "token": "eyJhbGciOiJIUzI1NiIsIn..."
  },
  "message": "User registered successfully"
}
```

### 2. Customer Login
```http
POST /api/v1/auth/user/login
```
**Request Body**:
```json
{
  "email": "alex@example.com",
  "password": "SecurePassword123!"
}
```
**Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "671ca102948b849201948a11",
      "name": "Alex Johnson",
      "email": "alex@example.com",
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIsIn..."
  }
}
```
*(If 2FA is enabled on the account, returns `{ "twoFactorRequired": true, "tempToken": "..." }`)*

### 3. Register Driver Partner
```http
POST /api/v1/auth/driver/register
```
**Request Body**:
```json
{
  "name": "Rajesh Sharma",
  "email": "rajesh.driver@example.com",
  "password": "DriverSecret123!",
  "phone": "+919123456780",
  "licenseNumber": "MH04-2021-0098471",
  "experience": 8,
  "vehicleTypes": ["Manual", "Automatic", "Commercial"],
  "hourlyRate": 150
}
```
**Response (`201 Created`)**:
```json
{
  "success": true,
  "data": {
    "driver": {
      "id": "671ca124948b849201948a12",
      "name": "Rajesh Sharma",
      "email": "rajesh.driver@example.com",
      "role": "driver",
      "isVerified": false,
      "kycStatus": "pending"
    },
    "token": "eyJhbGciOiJIUzI1NiIsIn..."
  }
}
```

### 4. Admin Login
```http
POST /api/v1/auth/admin/login
```
**Request Body**:
```json
{
  "email": "admin@mymate.com",
  "password": "AdminPassword123!",
  "adminCode": "admlogin8984"
}
```
**Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "admin": {
      "id": "671ca155948b849201948a13",
      "email": "admin@mymate.com",
      "role": "admin"
    },
    "token": "eyJhbGciOiJIUzI1NiIsIn..."
  }
}
```

### 5. Get Authenticated User Context (`/me`)
```http
GET /api/v1/auth/me
```
*Headers: `Authorization: Bearer <jwt>` or session cookie.*  
**Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "671ca102948b849201948a11",
      "name": "Alex Johnson",
      "email": "alex@example.com",
      "role": "user",
      "twoFactorEnabled": false
    }
  }
}
```

### 6. Logout
```http
POST /api/v1/auth/logout
```
Clears the `jwt` and `xsrf_token` cookies.

---

## 🚗 Driver Discovery & Profile Endpoints (`/drivers`)

### 1. Geospatial Driver Search
```http
GET /api/v1/drivers?lat=19.0760&lng=72.8777&radius=15&vehicleType=Automatic&sort=rating
```
**Query Parameters**:
- `lat` (float, optional): User latitude for geospatial proximity query.
- `lng` (float, optional): User longitude.
- `radius` (float, optional): Search radius in kilometers (default: 10km).
- `vehicleType` (string, optional): Filter by `Manual`, `Automatic`, or `Commercial`.
- `sort` (string, optional): Sort by `rating`, `distance`, `price_asc`, `price_desc`.
- `page` / `limit` (int, optional): Pagination parameters.

**Response (`200 OK`)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "671ca124948b849201948a12",
      "name": "Rajesh Sharma",
      "rating": 4.9,
      "totalTrips": 240,
      "experienceYears": 8,
      "vehicleTypes": ["Manual", "Automatic"],
      "hourlyRate": 150,
      "dailyRate": 1200,
      "isVerified": true,
      "isAvailable": true,
      "distanceKm": 2.4,
      "location": {
        "type": "Point",
        "coordinates": [72.8850, 19.0820]
      }
    }
  ],
  "total": 14,
  "page": 1
}
```

### 2. Get Driver Details
```http
GET /api/v1/drivers/:id
```
Returns full driver public profile, completed trip counts, verified badges, and recent customer reviews.

### 3. Update Driver Profile & Availability
```http
PUT /api/v1/drivers/profile
```
*Auth: Driver Only*  
**Request Body**:
```json
{
  "isAvailable": true,
  "hourlyRate": 160,
  "dailyRate": 1300,
  "currentLocation": {
    "type": "Point",
    "coordinates": [72.8850, 19.0820]
  }
}
```

---

## 📅 Booking Lifecycle Endpoints (`/bookings`)

### 1. Create a New Booking
```http
POST /api/v1/bookings
```
*Auth: Customer Only | Idempotent*  
**Request Body**:
```json
{
  "driverId": "671ca124948b849201948a12",
  "hireType": "hourly",
  "hours": 4,
  "pickupLocation": {
    "address": "Bandra Kurla Complex, Mumbai",
    "coordinates": [72.8656, 19.0667]
  },
  "dropLocation": {
    "address": "Chhatrapati Shivaji Maharaj International Airport (BOM)",
    "coordinates": [72.8744, 19.0896]
  },
  "startTime": "2026-10-27T10:00:00Z",
  "vehicleType": "Automatic",
  "notes": "Please arrive 10 minutes early."
}
```
**Response (`201 Created`)**:
```json
{
  "success": true,
  "data": {
    "booking": {
      "id": "671cb290884b849201948b99",
      "userId": "671ca102948b849201948a11",
      "driverId": "671ca124948b849201948a12",
      "status": "pending",
      "paymentStatus": "pending",
      "baseFare": 600,
      "platformFee": 50,
      "tax": 32.5,
      "totalAmount": 682.5,
      "createdAt": "2026-10-26T11:45:00Z"
    }
  },
  "message": "Booking request created successfully"
}
```

### 2. Transition Booking Status
```http
PUT /api/v1/bookings/:id/status
```
*Auth: Customer or Driver | Idempotent*  
**Request Body**:
```json
{
  "status": "accepted"
}
```
**Allowed State Machine Transitions**:
- `pending` → `accepted` (by Driver)
- `pending` → `cancelled` (by Customer or Driver)
- `accepted` → `ongoing` (by Driver when pickup begins)
- `ongoing` → `completed` (by Driver when trip finishes)
- `ongoing` → `cancelled` (Emergency cancellation with penalty calculation)

### 3. Download Calendar Invite (`.ics`)
```http
GET /api/v1/bookings/:id/calendar.ics
```
Returns a standard iCalendar MIME stream (`text/calendar`) importing the ride schedule into Google Calendar, Apple Calendar, or Microsoft Outlook.

### 4. Download PDF Invoice Receipt
```http
GET /api/v1/bookings/:id/invoice.pdf
```
Returns a generated PDF tax invoice receipt (`application/pdf`) with platform GST registration, driver breakdown, and payment transaction references.

---

## 💳 Payments & Fintech Endpoints (`/payments`)

### 1. Create Razorpay Payment Order
```http
POST /api/v1/payments/create-order
```
*Auth: Customer Only*  
**Request Body**:
```json
{
  "bookingId": "671cb290884b849201948b99"
}
```
**Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "orderId": "order_ODZ89849281729",
    "amount": 68250,
    "currency": "INR",
    "keyId": "rzp_test_xxxxxxxx"
  }
}
```

### 2. Verify Razorpay Payment Signature
```http
POST /api/v1/payments/verify
```
*Auth: Customer Only*  
**Request Body**:
```json
{
  "bookingId": "671cb290884b849201948b99",
  "razorpayOrderId": "order_ODZ89849281729",
  "razorpayPaymentId": "pay_ODZ89849281730",
  "razorpaySignature": "4a719d9b6e8284..."
}
```
*Validates cryptographic HMAC-SHA256 signature against `RAZORPAY_KEY_SECRET`. Upon success, sets `paymentStatus = "paid"` and emits `mymate.payment.completed` event to Kafka.*

### 3. Razorpay Server Webhook
```http
POST /api/v1/payments/webhook
```
*Unauthenticated webhook endpoint with internal HMAC signature verification header `X-Razorpay-Signature`.*

---

## 🤖 AI Intelligence & Contextual Re-Ranking (`/ai`)

### 1. Semantic Driver Recommendation (Gemini 2.5 Flash)
```http
GET /api/v1/ai/recommend?lat=19.0760&lng=72.8777&vehicleType=Automatic&hireType=outstation
```
Evaluates candidate drivers using pure functional mathematical scores combined with Gemini AI semantic reasoning to prioritize drivers best suited for long highway journeys or specific luxury vehicle transmissions.

### 2. Interactive AI Assistant Chatbot
```http
POST /api/v1/ai/chat
```
**Request Body**:
```json
{
  "message": "I need a driver with experience driving automatic SUVs for a 2-day trip to Lonavala.",
  "conversationHistory": []
}
```
**Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "reply": "I can certainly help you arrange an experienced driver for your SUV trip to Lonavala! For outstation trips, we recommend drivers with 5+ years of highway experience and Automatic endorsement. Here are top recommended drivers near you..."
  }
}
```

### 3. Automated KYC Document OCR Verification
```http
POST /api/v1/ai/verify-kyc
```
*Auth: Admin Only*  
Passes driving license document image URLs to the Gemini Multimodal Vision API to automatically extract license number, expiry date, driver name, and state vehicle authority endorsements.

---

## ⚡ Real-Time WebSocket Protocol

MyMate uses a unified **Gorilla WebSocket / Socket.io Hub** mounted at `/socket.io/`.

### Client Handshake
```javascript
import { io } from 'socket.io-client';

const socket = io('https://mymate-965m.onrender.com', {
  path: '/socket.io/',
  withCredentials: true,
  transports: ['websocket']
});
```

### Channel & Room Topologies
- `driver_pool`: Global room where all verified, available drivers receive instantaneous ride offers.
- `user_<userId>`: Private channel for user-specific booking alerts and driver responses.
- `driver_<driverId>`: Private channel for direct driver dispatches and payout notifications.
- `booking_<bookingId>`: Shared room between passenger and driver for live GPS tracking and direct trip chat.

### Core WebSocket Events

| Event Name | Direction | Payload Schema | Description |
|:---|:---|:---|:---|
| `BOOKING_CREATED` | Server ➔ `driver_pool` | `{ bookingId, pickup, fare, vehicleType, expiresAt }` | Triggers audio-visual dispatch alert with 45s countdown. |
| `BOOKING_ACCEPTED` | Server ➔ `user_<id>` | `{ bookingId, driverId, driverName, etaMinutes }` | Notifies customer that driver has accepted. |
| `LOCATION_UPDATE` | Driver ➔ Server ➔ `booking_<id>` | `{ bookingId, lat, lng, bearing, speed }` | High-frequency GPS ping for live map interpolation. |
| `CHAT_MESSAGE` | Bidirectional | `{ bookingId, senderId, text, timestamp }` | Direct in-trip passenger/driver chat message. |
| `BOOKING_STATUS` | Server ➔ Room | `{ bookingId, status, timestamp }` | State changes (`ongoing`, `completed`, `cancelled`). |
