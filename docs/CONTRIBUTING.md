# 🤝 Contributing to MyMate

Thank you for your interest in contributing to **MyMate**! This document provides guidelines and workflows for contributing to our codebase.

---

## 📑 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Development Environment Setup](#development-environment-setup)
- [Branching & Workflow](#branching--workflow)
- [Coding Standards & Conventions](#coding-standards--conventions)
- [Testing & Quality Verification](#testing--quality-verification)
- [Submitting Pull Requests](#submitting-pull-requests)

---

## 📜 Code of Conduct

We are committed to providing a welcoming, inclusive, and harassment-free environment for all contributors. Please treat fellow contributors with respect and professionalism.

---

## 💻 Development Environment Setup

### Prerequisites
- **Golang**: `v1.24+` ([Download Go](https://go.dev/dl/))
- **Node.js**: `v20+` & `npm v10+` ([Download Node.js](https://nodejs.org/))
- **MongoDB**: Access to MongoDB Atlas or a local MongoDB community server running on port `27017`
- **Git**: For version control

### 1. Clone the Repository
```bash
git clone https://github.com/Susil-commits/MyMate.git
cd MyMate
```

### 2. Configure Backend
```bash
cd backend
cp .env.example .env
# Edit backend/.env to configure MONGO_URI and JWT_SECRET
go mod download
```

### 3. Configure Frontend
```bash
cd ../frontend
cp .env.example .env
npm install
```

---

## 🌿 Branching & Workflow

1. Always branch from `main`:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/your-feature-name
   # or fix/your-bugfix-name
   ```
2. Commit your changes with clear, semantic commit messages:
   - `feat(api): add driver endorsement filter endpoint`
   - `fix(booking): prevent duplicate booking state transitions`
   - `docs(readme): update deployment instructions`
   - `refactor(auth): simplify double-submit CSRF cookie validation`

---

## 📐 Coding Standards & Conventions

### Golang Backend (`backend/`)
- Follow official Go style guidelines: run `gofmt -s -w .` before committing.
- Run `go vet ./...` to detect dead code, shadowing, or formatting bugs.
- Handle all errors explicitly. Never ignore errors with `_ = err` unless explicitly documented.
- Protect shared memory structures with proper mutexes or channel communication; all changes must pass `go test -race ./...`.

### React Frontend (`frontend/`)
- Write modular React 19 functional components with TypeScript or JSX.
- Adhere to the established TailwindCSS v4 design token structure in `src/index.css`.
- Ensure responsive mobile-first layouts across all screens.
- Run `npm run lint` before committing to adhere to ESLint rules.

---

## 🧪 Testing & Quality Verification

Before opening a pull request, verify that all automated test gates pass locally:

```bash
# 1. Run Backend Unit & Race Tests
cd backend
go test -v -race ./...
go mod verify
go vet ./...

# 2. Run Frontend Build & Lint Checks
cd ../frontend
npm run lint
npm run build

# 3. Optional: Run E2E Playwright Tests
npx playwright test
```

---

## 🚀 Submitting Pull Requests

1. Push your branch to GitHub:
   ```bash
   git push origin feature/your-feature-name
   ```
2. Open a Pull Request targeting `main`.
3. Provide a clear summary of changes, problem statement, and testing steps.
4. Ensure all GitHub Actions CI checks (`backend-ci.yml`, `frontend-ci.yml`) pass.
5. A maintainer will review your pull request promptly.
