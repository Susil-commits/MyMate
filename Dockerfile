# Multi-stage Dockerfile for MyMate Golang Backend
FROM golang:1.24-alpine AS builder

WORKDIR /app

# Install git and certificates
RUN apk add --no-cache git ca-certificates

# Cache dependencies
COPY backend/go.mod backend/go.sum ./
RUN go mod download && go mod verify

# Copy backend source code
COPY backend/ .

# Compile optimized static binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o /app/server main.go

# Production minimal runtime image
FROM alpine:3.20

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# Copy compiled binary from builder
COPY --from=builder /app/server /app/server
COPY backend/ca.pem /app/ca.pem

# Create uploads folder for file uploads
RUN mkdir -p /app/uploads

ENV PORT=5000
ENV APP_ENV=production

EXPOSE 5000

CMD ["/app/server"]
