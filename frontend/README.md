# 📱 MyMate Frontend Application

High-performance, progressive web application (PWA) and client portal for the **MyMate On-Demand & Contract Driver Hiring Platform**. Built with **React 19**, **Vite 8**, **TailwindCSS v4**, **Leaflet Maps**, and **WebSocket** real-time dispatch feeds.

---

## 📑 Table of Contents

- [Architectural Overview](#-architectural-overview)
- [Key Features & User Portals](#-key-features--user-portals)
- [Page Catalog](#-page-catalog)
- [Component Architecture](#-component-architecture)
- [State Management & Context Providers](#-state-management--context-providers)
- [Geospatial & Mapping Integration](#-geospatial--mapping-integration)
- [Network & Security Architecture](#-network--security-architecture)
- [Environment Configuration](#-environment-configuration)
- [Local Development & Build Commands](#-local-development--build-commands)
- [Testing & Quality Assurance](#-testing--quality-assurance)
- [Production Deployment (Vercel)](#-production-deployment-vercel)

---

## 🏛️ Architectural Overview

The frontend is architected as an offline-capable, responsive Progressive Web App (PWA) with sub-second page transitions, dynamic route-level code splitting, and real-time state synchronization:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 FRONTEND ARCHITECTURE                                  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ⚛️ UI Framework      : React 19 + TypeScript / JSX with Strict Type Checking            │
│ ⚡ Build Tool         : Vite 8 with Hot Module Replacement (HMR) & ESBuild bundling    │
│ 🎨 Styling           : TailwindCSS v4 with CSS Variable design tokens & Dark Mode      │
│ 🗺️ Mapping           : Leaflet 1.9 + React-Leaflet + OpenStreetMap Tile Layers         │
│ 🔌 Real-Time Comms   : Socket.io-client with automatic reconnect & room subscriptions  │
│ 🌐 API Layer         : Axios Client with HMAC CSRF Injection & Dual Token Auth Bearer  │
│ 🎭 Animations        : Framer Motion + Lucide React icon suite                         │
│ 🛡️ PWA Caching       : Service Worker precaching via Vite PWA Plugin                   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🌟 Key Features & User Portals

The application provides three tailored experiences based on user roles (`user`, `driver`, `admin`):

### 1. 👤 Customer Experience (`user`)
- **Instant Driver Discovery**: Filter verified drivers by vehicle transmission type (Manual, Automatic, Commercial), rating, and distance.
- **Geospatial Route Booking**: Interactive Leaflet pickup/drop pin selection with real-time distance and estimated fare calculation.
- **Live Ride Radar**: Real-time GPS movement tracking of the assigned driver on a Leaflet map.
- **In-App Messaging**: Instant WebSocket chat with the assigned driver.
- **Digital Payments**: Native Razorpay checkout modal supporting UPI, Credit/Debit cards, and Net Banking.
- **Calendar & Invoices**: Direct one-click `.ics` calendar appointment download and dynamic PDF booking receipts.

### 2. 🚗 Driver Partner Portal (`driver`)
- **Real-Time Dispatch Radar**: Audio-visual booking offer alerts with an acceptance countdown timer.
- **Ride State Machine**: Seamless lifecycle progression (`pending` → `accepted` → `ongoing` → `completed`).
- **Driver Wallet**: Instant 90% fare commission accrual upon ride completion, transaction ledger, and payout requests.
- **Pickup Heatmap**: Geospatial density visualization displaying customer pickup demand clusters.
- **Profile & Vehicle Management**: Vehicle endorsements, license document upload, and hourly/daily availability toggles.

### 3. 🛡️ Enterprise Admin Console (`admin`)
- **KYC Document Verification**: Side-by-side inspection of driver's license documents with OCR automated validation and approve/reject actions.
- **Platform Analytics**: Dynamic revenue counters, driver utilization, active bookings, and customer satisfaction KPIs.
- **User & Driver Moderation**: Real-time account activation, suspension, and soft-deletion controls.
- **Promotional Engine**: Management of promotional discount codes (flat and percentage discounts, validity periods, usage caps).
- **Audit Logs & Export**: Immutable administrative event logging and CSV booking data export.

---

## 📄 Page Catalog

All application pages reside in [`src/pages/`](file:///c:/Users/nayak/OneDrive/Desktop/Projects/web/MyMate/frontend/src/pages):

| Page Component | Route Path | Access Level | Description |
|:---|:---|:---|:---|
| `LandingPage.tsx` | `/` | Public | Hero showcase, live platform statistics counter, service offerings, and testimonials. |
| `UserLoginPage.tsx` | `/login` | Public (Guest) | Customer login with email/password, CSRF token handling, and 2FA challenge flow. |
| `UserRegisterPage.tsx` | `/register` | Public (Guest) | Customer registration with real-time validation and email verification prompt. |
| `DriverLoginPage.tsx` | `/driver-login` | Public (Guest) | Driver partner login with availability status restoration. |
| `DriverRegisterPage.tsx` | `/driver-register` | Public (Guest) | Multi-step driver partner onboarding with vehicle endorsements and license uploads. |
| `AdminLoginPage.tsx` | `/admin-login` | Public (Guest) | Secured admin login requiring administrator security credentials. |
| `DriverSearchPage.tsx` | `/drivers` | Public / User | Geospatial driver search, vehicle type filters, rating sort, and instant booking modal. |
| `DriverProfilePage.tsx` | `/drivers/:id` | Public / User | Full public profile of a driver, verified badge, reviews, and booking button. |
| `BookingsPage.tsx` | `/bookings` | Protected (User) | Customer booking history, status filters, ride cancellation, and invoice download. |
| `BookingDetailPage.tsx` | `/bookings/:id` | Protected (User/Driver) | Live booking command center with route map, real-time driver tracking, and chat. |
| `DriverDashboard.tsx` | `/driver-dashboard` | Protected (Driver) | Driver dispatch radar, incoming ride alerts, live trip controls, and earnings summary. |
| `DriverBookingsPage.tsx` | `/driver/bookings` | Protected (Driver) | Complete trip history for drivers with fare breakdowns and customer feedback. |
| `DriverProfileEdit.tsx` | `/driver/profile` | Protected (Driver) | Edit driver rates, service radius, vehicle transmission types, and bio. |
| `WalletPage.tsx` | `/wallet` | Protected (Driver/User) | Balance overview, credit/debit transaction history, and fund withdrawal. |
| `FavoritesPage.tsx` | `/favorites` | Protected (User) | Bookmarked favorite drivers for direct 1-click re-booking. |
| `MessagesPage.tsx` | `/messages` | Protected (All) | Real-time chat messaging interface with conversation list and read receipts. |
| `UserProfilePage.tsx` | `/profile` | Protected (User) | Customer profile management, phone number, address, and password change. |
| `VerifyEmailPage.tsx` | `/verify-email` | Public | Email verification landing screen processing verification tokens. |
| `ForgotPasswordPage.tsx` | `/forgot-password` | Public | Self-service password recovery email request form. |
| `ResetPasswordPage.tsx` | `/reset-password` | Public | Secure password reset form with token validation. |
| `AdminDashboard.tsx` | `/admin` | Protected (Admin) | Enterprise KPI counters, revenue analytics, real-time charts, and recent activity. |
| `AdminDriversPage.tsx` | `/admin/drivers` | Protected (Admin) | Driver verification queue, KYC license document inspection, and status management. |
| `AdminUsersPage.tsx` | `/admin/users` | Protected (Admin) | Customer accounts list, status toggle (active/suspended), and profile view. |
| `AdminBookingsPage.tsx` | `/admin/bookings` | Protected (Admin) | Global platform bookings table, CSV export, and manual status override. |
| `NotFoundPage.tsx` | `*` | Public | Fallback 404 screen with contextual navigation shortcuts. |

---

## 🧩 Component Architecture

Reusable UI and domain components in [`src/components/`](file:///c:/Users/nayak/OneDrive/Desktop/Projects/web/MyMate/frontend/src/components):

- **`MapSelector.tsx`**: Interactive Leaflet map allowing users to click or drag markers to pick pickup and dropoff locations, calculating distance automatically.
- **`LiveLocationMap.tsx`**: Real-time geospatial tracking component showing customer pickup, dropoff, and live driver GPS position with custom vehicle markers.
- **`HeatmapDisplay.tsx`**: Geospatial pickup density layer visualizing high-demand zones for drivers.
- **`AIChatbotWidget.tsx`**: Floating AI assistant powered by Google Gemini 2.5 Flash providing ride recommendations, FAQ answers, and booking assistance.
- **`ProtectedRoute.tsx` & `OptionalRoute.tsx`**: Route wrapper enforcing authentication tokens and role authorization (`user`, `driver`, `admin`).
- **`TwoFactorSettings.tsx`**: In-app TOTP 2FA enrollment component displaying QR codes and 6-digit verification code input.
- **`DriverQuickViewModal.tsx`**: Slide-over modal displaying driver details, ratings, vehicle endorsements, and quick-booking form.
- **`NotificationBell.tsx`**: Header dropdown notification center with unread counters and click-to-view navigation.
- **`ErrorBoundary.tsx`**: React Error Boundary intercepting runtime render faults with graceful recovery actions.
- **`WindowedPagination.tsx`**: Accessible pagination component for long data tables (bookings, users, drivers).
- **`SkeletonLoader.tsx`**: Shimmering content placeholder components for smooth loading states.
- **`ThemeToggle.tsx`**: One-click Dark / Light mode toggle persisting user preference to `localStorage`.

---

## 🔄 State Management & Context Providers

Global state is organized cleanly via React Contexts located in [`src/context/`](file:///c:/Users/nayak/OneDrive/Desktop/Projects/web/MyMate/frontend/src/context):

```
                   ┌─────────────────────────────────────────┐
                   │               App.tsx                   │
                   └──────────────────┬──────────────────────┘
                                      │
            ┌─────────────────────────┼─────────────────────────┐
            ▼                         ▼                         ▼
   ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
   │   AuthContext   │       │  ThemeContext   │       │  SocketContext  │
   ├─────────────────┤       ├─────────────────┤       ├─────────────────┤
   │ Current User    │       │ Dark / Light    │       │ Socket Client   │
   │ Role (U/D/A)    │       │ CSS Token Sync  │       │ Room Join/Leave │
   │ Login / Logout  │       │ LocalStorage    │       │ Connection Stat │
   └─────────────────┘       └─────────────────┘       └─────────────────┘
                                      │
                                      ▼
                             ┌─────────────────┐
                             │NotificationCtx  │
                             ├─────────────────┤
                             │ In-App Alerts   │
                             │ Unread Counter  │
                             │ Audio Pings     │
                             └─────────────────┘
```

1. **`AuthContext`**: Manages authenticated user state, JWT cookie / token lifecycle, login, registration, and logout across the application.
2. **`ThemeContext`**: Controls dark/light mode toggling, applying the `.dark` class to `document.documentElement` and persisting preferences.
3. **`SocketContext`**: Maintains a singleton WebSocket connection to the backend, automatically joining user-specific rooms (`user_<id>`, `driver_<id>`) on authentication.
4. **`NotificationContext`**: Handles real-time in-app notification toasts, audio notification pings, and unread badges.

---

## 🗺️ Geospatial & Mapping Integration

MyMate leverages **OpenStreetMap** and **Leaflet** without requiring costly proprietary map API keys:
- **Leaflet Setup**: Custom icon initialization in [`src/leaflet-setup.js`](file:///c:/Users/nayak/OneDrive/Desktop/Projects/web/MyMate/frontend/src/leaflet-setup.js) fixing default marker icon bundling bugs in Vite.
- **Reverse Geocoding**: Translates lat/lng coordinates into human-readable street addresses using Nominatim OSM Open APIs.
- **Haversine Distance**: Calculates exact straight-line and route distance between coordinates in kilometers to feed the backend pricing engine.

---

## 🔒 Network & Security Architecture

The Axios client in [`src/api/axios.js`](file:///c:/Users/nayak/OneDrive/Desktop/Projects/web/MyMate/frontend/src/api/axios.js) is pre-configured with enterprise security defaults:
1. **Credentials Support**: `withCredentials: true` ensures authentication cookies (`jwt`, `xsrf_token`) are sent with every cross-origin request.
2. **Double-Submit CSRF**: Automatically reads the `xsrf_token` cookie and injects the `X-XSRF-TOKEN` header on all mutating HTTP requests (`POST`, `PUT`, `DELETE`, `PATCH`).
3. **Bearer Token Fallback**: Reads stored JWT tokens from `localStorage` and appends `Authorization: Bearer <token>` as a fallback for browsers blocking third-party cookies.
4. **Distributed Tracing**: Generates a unique client-side `X-Correlation-Id` for every request to enable end-to-end trace correlation with backend logs.
5. **Unauthorized Interceptor**: Automatically catches `401 Unauthorized` responses and clears stale sessions, redirecting users to the appropriate login portal.

---

## ⚙️ Environment Configuration

Create a `.env` file in `frontend/` (see `.env.example`):

```env
# Backend API Base URL (Do NOT include a trailing slash)
VITE_API_URL=http://localhost:5000/api

# Razorpay Public Key ID (Test or Live)
VITE_RAZORPAY_KEY_ID=rzp_test_your_razorpay_key_id
```

For production deployment on Vercel:
```env
VITE_API_URL=https://mymate-965m.onrender.com/api
VITE_RAZORPAY_KEY_ID=rzp_test_your_razorpay_key_id
```

---

## 🚀 Local Development & Build Commands

```bash
# Navigate to the frontend directory
cd frontend

# Install all npm dependencies
npm install

# Start Vite local development server with HMR
npm run dev
# The application opens at: http://localhost:5173

# Run ESLint linter check
npm run lint

# Build production bundle with Vite PWA precache generation
npm run build
# Compiled static assets are output to: frontend/dist/

# Preview production build locally
npm run preview
```

---

## 🧪 Testing & Quality Assurance

MyMate frontend includes end-to-end integration tests using **Playwright**:

```bash
# Install Playwright browsers (first-time setup)
npx playwright install --with-deps

# Run all Playwright E2E tests
npx playwright test

# Run tests in UI mode (Interactive visual runner)
npx playwright test --ui

# View HTML test execution report
npx playwright show-report
```

---

## 🌐 Production Deployment (Vercel)

The frontend is optimized for deployment on **Vercel Edge Network**:

1. **Import Project**: In the [Vercel Dashboard](https://vercel.com/), select **Add New Project** and import the `MyMate` repository.
2. **Build Settings**:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. **Environment Variables**:
   | Variable | Production Value |
   |:---|:---|
   | `VITE_API_URL` | `https://mymate-965m.onrender.com/api` |
   | `VITE_RAZORPAY_KEY_ID` | `rzp_test_...` |
4. **SPA Client Routing**: Configured via [`vercel.json`](file:///c:/Users/nayak/OneDrive/Desktop/Projects/web/MyMate/frontend/vercel.json) rewrite rule `{"source": "/(.*)", "destination": "/index.html"}` to ensure direct deep-linking functions flawlessly.
