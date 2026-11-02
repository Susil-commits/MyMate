# 🚀 MyMate Scratch-to-Production Deployment Guide

Step-by-step production runbook for deploying the **MyMate On-Demand Driver Platform** from source code to live production cloud infrastructure.

---

## 📑 Table of Contents

- [Deployment Architecture & Flow](#-deployment-architecture--flow)
- [Prerequisites & External Cloud Accounts](#-prerequisites--external-cloud-accounts)
- [Step 1: MongoDB Atlas Cluster Provisioning](#step-1-mongodb-atlas-cluster-provisioning)
- [Step 2: Seed Initial Database Records](#step-2-seed-initial-database-records)
- [Step 3: Deploy Golang Backend to Render](#step-3-deploy-golang-backend-to-render)
- [Step 4: Deploy React Frontend to Vercel](#step-4-deploy-react-frontend-to-vercel)
- [Step 5: External Services Configuration](#step-5-external-services-configuration)
- [Step 6: End-to-End Live Smoke Test Checklist](#step-6-end-to-end-live-smoke-test-checklist)
- [Troubleshooting & Common Production Pitfalls](#-troubleshooting--common-production-pitfalls)

---

## 🌐 Deployment Architecture & Flow

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                             SCRATCH-TO-PRODUCTION PIPELINE                             │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Git Repository    : Push verified code to main on GitHub                            │
│ 2. MongoDB Atlas     : Multi-AZ M0/M10 cluster with 2dsphere index & user credentials  │
│ 3. Database Seeding  : Execute cmd/seed/main.go to populate admin & verified drivers   │
│ 4. Backend (Render)  : Deploy Go binary via build.sh with health probe at /health       │
│ 5. Frontend (Vercel) : Deploy React 19 PWA via Vite build with edge caching            │
│ 6. Verification      : Smoke test auth, driver search, booking lifecycle & payments    │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Prerequisites & External Cloud Accounts

Before beginning, create free or production accounts with these providers:

| Provider | Purpose | Free Tier Available? |
|:---|:---|:---|
| [GitHub](https://github.com) | Source code repository and automated CI/CD | Yes |
| [MongoDB Atlas](https://cloud.mongodb.com) | Multi-AZ Managed Document & Geospatial Database | Yes (M0 Free Sandbox) |
| [Render](https://render.com) | Cloud Web Service hosting the Golang backend binary | Yes (Free / Starter) |
| [Vercel](https://vercel.com) | Global Edge CDN hosting the React 19 PWA frontend | Yes (Hobby Tier) |
| [Razorpay](https://razorpay.com) | Payment gateway for customer checkout & instant wallet splits | Yes (Test Mode) |
| [Google AI Studio](https://aistudio.google.com) | Gemini 2.5 Flash API key for semantic driver ranking & chatbot | Yes (Free quota) |
| [Brevo](https://brevo.com) (formerly Sendinblue) | Transactional SMTP email delivery for booking confirmations | Yes (300 emails/day) |
| [Cloudinary](https://cloudinary.com) | Cloud storage for driver license images and profile avatars | Yes |

---

## Step 1: MongoDB Atlas Cluster Provisioning

1. Log into your [MongoDB Atlas Dashboard](https://cloud.mongodb.com/).
2. Create a new cluster (e.g. `ClusterCoffee` on AWS or GCP).
3. **Configure Database User**:
   - Navigate to **Security** > **Database Access**.
   - Click **Add New Database User**.
   - Authentication Method: **Password**.
   - Username: `<your_db_username>` (e.g. `mymate_app_user`).
   - Password: Use a strong password.
   - *CRITICAL*: If your password contains special characters like `@`, `#`, or `/`, you **MUST** URL-encode them (e.g. `@` becomes `%40`, `#` becomes `%23`).
   - Role: `Read and write to any database`.
4. **Configure IP Access List**:
   - Navigate to **Security** > **Network Access**.
   - Click **Add IP Address**.
   - Select **Allow Access From Anywhere** (`0.0.0.0/0`).
5. **Get Connection String**:
   - Navigate to **Deployments** > **Database**.
   - Click **Connect** > **Drivers** (Go driver).
   - Connection string format:
     ```
     mongodb+srv://<username>:<password>@<your-cluster>.mongodb.net/mymate?retryWrites=true&w=majority
     ```
   - *CRITICAL*: Make sure `/mymate` is present in the URI path so documents are saved to the application database, not `test`.

---

## Step 2: Seed Initial Database Records

Before launching your frontend, seed the database with an administrator account, verified driver candidates, and sample bookings:

```bash
# From repository root
cd backend

# Create local .env with your MongoDB Atlas URI
cp .env.example .env
# Edit .env and paste your MONGO_URI and a random JWT_SECRET

# Run the database seeder
go run cmd/seed/main.go
```

**Expected Seeder Output**:
```
==> Connected to MongoDB Atlas
==> Dropped old seed collections (if any)
==> Created Admin User: admin@mymate.internal
==> Created 4 Verified Drivers in Mumbai & Navi Mumbai with 2dsphere coordinates
==> Created 3 Historical Bookings & Completed Driver Reviews
==> Database seeding completed successfully!
```

---

## Step 3: Deploy Golang Backend to Render

1. Log into the [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** > **Web Service**.
3. Connect your GitHub repository: `Susil-commits/MyMate`.
4. Configure the service settings:
   - **Name**: `mymate-backend`
   - **Region**: Singapore or Frankfurt (closest to your users)
   - **Branch**: `main`
   - **Root Directory**: *(Leave empty)*
   - **Environment**: `Go` (or `Docker` using root [`Dockerfile`](file:///c:/Users/nayak/OneDrive/Desktop/Projects/web/MyMate/Dockerfile))
   - **Build Command**: `bash backend/build.sh` (or `cd backend && go build -o server main.go`)
   - **Start Command**: `cd backend && ./server`
   - **Health Check Path**: `/health`
5. Configure Environment Variables in the **Environment** tab:

| Variable Name | Example Production Value | Purpose |
|:---|:---|:---|
| `MONGO_URI` | `mongodb+srv://<db_user>:<pw>@<cluster-host>/mymate?retryWrites=true&w=majority` | Primary MongoDB Atlas connection string |
| `APP_ENV` | `production` | Enables production security & HMAC CSRF checks |
| `PORT` | `5000` | HTTP port bound by Gin |
| `CLIENT_URL` | `https://my-mate-tawny.vercel.app` | Allowed CORS origin (comma-separated for multiples) |
| `JWT_SECRET` | `<generate-a-64-character-random-hex-string-here>` | Secret key used for signing JWT tokens |
| `ADMIN_EMAIL` | `admin@mymate.internal` | Root admin email |
| `ADMIN_CODE` | `<your-secure-admin-passkey>` | Security passkey required for admin verification |
| `RAZORPAY_KEY_ID` | `rzp_test_...` | Razorpay public key identifier |
| `RAZORPAY_KEY_SECRET` | `...` | Razorpay cryptographic secret for HMAC signatures |
| `GEMINI_API_KEY` | `AIzaSy...` | Google AI Studio API key |
| `BREVO_SMTP_USER` | `susil@example.com` | Brevo SMTP account user |
| `BREVO_SMTP_PASS` | `smtp-master-key` | Brevo SMTP password |
| `KAFKA_ENABLED` | `false` | Optional; set `true` when Kafka broker is connected |

6. Click **Create Web Service**.
7. Once deployed, verify in your browser:
   ```http
   GET https://mymate-965m.onrender.com/health
   ```
   **Expected Response**:
   ```json
   {
     "status": "ok",
     "uptime": 12.4,
     "timestamp": "2026-10-26T11:45:00Z"
   }
   ```

---

## Step 4: Deploy React Frontend to Vercel

1. Log into the [Vercel Dashboard](https://vercel.com/).
2. Click **Add New...** > **Project**.
3. Import the `MyMate` GitHub repository.
4. Configure Build and Output Settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Add Environment Variables:

| Variable Name | Production Value | Purpose |
|:---|:---|:---|
| `VITE_API_URL` | `https://mymate-965m.onrender.com/api` | Render backend URL (no trailing slash) |
| `VITE_RAZORPAY_KEY_ID` | `rzp_test_...` | Razorpay public key ID |

6. Click **Deploy**.
7. Vercel automatically builds and provisions your global CDN deployment at `https://my-mate-tawny.vercel.app`.

---

## Step 5: External Services Configuration

### 1. Razorpay Webhook Configuration
1. In the [Razorpay Dashboard](https://dashboard.razorpay.com/), go to **Settings** > **Webhooks**.
2. Click **Add New Webhook**:
   - **Webhook URL**: `https://mymate-965m.onrender.com/api/v1/payments/webhook`
   - **Secret**: Set a random secret and copy it to `RAZORPAY_WEBHOOK_SECRET` on Render.
   - **Active Events**: Check `payment.captured`, `order.paid`, and `refund.processed`.

### 2. Brevo Transactional Email Setup
1. In the [Brevo Dashboard](https://app.brevo.com/), go to **Transactional** > **Email** > **Configuration**.
2. Copy the SMTP Server (`smtp-relay.brevo.com`), Port (`587`), and generate an SMTP Master Key.
3. Configure `BREVO_SMTP_USER` and `BREVO_SMTP_PASS` on Render.

---

## Step 6: End-to-End Live Smoke Test Checklist

Execute this smoke test to ensure all systems are communicating properly:

- [ ] **Liveness & Readiness**:
  - Visit `https://mymate-965m.onrender.com/health` ➔ Returns `status: ok`.
  - Visit `https://mymate-965m.onrender.com/health/ready` ➔ Returns `mongodb: ok`.
- [ ] **Frontend Landing Page**:
  - Open `https://my-mate-tawny.vercel.app` ➔ Verified drivers counter loads dynamic data.
- [ ] **Driver Search**:
  - Click "Find a Driver" ➔ Seeded verified drivers in Mumbai display with coordinates and ratings.
- [ ] **Customer Authentication**:
  - Register a new test customer account ➔ Verify email screen appears.
- [ ] **Admin Authentication & Dashboard**:
  - Navigate to `/admin-login`.
  - Log in with `nayaksushil298@gmail.com`, password `Admin@12345`, admin code `admlogin8984`.
  - Verify that the Admin KPI dashboard displays active drivers, users, and booking counts.
- [ ] **Driver Partner Radar**:
  - Log in with one of the seeded driver accounts (`rajesh.driver@example.com` / `Driver@12345`).
  - Verify that the live dispatch radar connects to the WebSocket server without error.

---

## 🛠️ Troubleshooting & Common Production Pitfalls

### 1. MongoDB Authentication Failure (`bad auth : authentication failed`)
- **Cause**: Special characters in your MongoDB password (e.g. `@`, `#`, `$`, `/`) were not URL-encoded in the `MONGO_URI`.
- **Solution**: Replace `@` with `%40`, `#` with `%23`, etc., in your connection string.

### 2. CORS `403 Forbidden` on Cross-Origin Requests
- **Cause**: The `CLIENT_URL` environment variable on Render does not match the exact URL of your Vercel deployment.
- **Solution**: Ensure `CLIENT_URL` on Render is set to `https://my-mate-tawny.vercel.app` (do not include trailing slashes).

### 3. CSRF Validation Failure (`403 CSRF token mismatch`)
- **Cause**: Third-party cookie blocking or missing `X-XSRF-TOKEN` header on mutation calls.
- **Solution**: Verify that `withCredentials: true` is enabled in Axios and ensure the frontend issues a `GET /api/v1/auth/csrf-token` request upon page boot.

### 4. Render Cold Start Delays
- **Cause**: Free-tier Render web services spin down after 15 minutes of inactivity.
- **Solution**: The compiled Go binary starts in **under 15 milliseconds** once the container wakes up. For zero container sleep, upgrade to Render's $7/month Starter instance or configure a free external uptime ping (e.g. via UptimeRobot) pinging `/health` every 10 minutes.
