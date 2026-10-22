#!/usr/bin/env bash
set -e

echo "=== MyMate Go Build Script ==="

# Check if Go is installed in the environment
if ! command -v go &> /dev/null; then
    echo "==> Go compiler not found in container. Downloading Go 1.24 (linux-amd64)..."
    curl -fsSL https://go.dev/dl/go1.24.0.linux-amd64.tar.gz -o /tmp/go1.24.tar.gz
    tar -xzf /tmp/go1.24.tar.gz -C /tmp
    rm -f /tmp/go1.24.tar.gz
    export GOROOT=/tmp/go
    export PATH="/tmp/go/bin:$PATH"
fi

echo "==> $(go version)"

# Navigate to backend directory if not already inside it
if [ -d "backend" ]; then
    cd backend
fi

echo "==> Downloading and verifying Go dependencies..."
go mod download
go mod verify

echo "==> Compiling static production binary..."
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o server main.go

echo "==> Build successful! Binary ready at $(pwd)/server"
ls -lh server
