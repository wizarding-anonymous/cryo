# syntax=docker/dockerfile:1.4

ARG GO_VERSION=1.24

# Build stage
FROM golang:${GO_VERSION}-alpine AS builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata upx

# Cache dependencies
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

# Copy source code
COPY . .

# Build optimized binary
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-w -s -X main.version=$(git describe --tags --always --dirty)" \
    -trimpath -o /out/download-service ./cmd/server

# Compress binary (optional, reduces size by ~30%)
RUN upx --best --lzma /out/download-service

# Production stage
FROM alpine:3.20
WORKDIR /app

# Install runtime dependencies and security updates
RUN apk add --no-cache \
    ca-certificates \
    tzdata \
    curl \
    && apk upgrade --no-cache \
    && rm -rf /var/cache/apk/*

# Create non-root user with specific UID/GID for security
RUN addgroup -g 65532 -S nonroot && \
    adduser -S -D -H -u 65532 -G nonroot nonroot

# Create necessary directories with proper permissions
RUN mkdir -p /app/data /app/logs /tmp/downloads && \
    chown -R nonroot:nonroot /app /tmp/downloads && \
    chmod 755 /app && \
    chmod 1777 /tmp/downloads

# Copy binary from builder
COPY --from=builder --chown=nonroot:nonroot /out/download-service /app/download-service

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8080}/health || exit 1

# Security: Run as non-root user
USER 65532:65532

# Production environment variables
ENV PORT=8080 \
    APP_ENV=production \
    GIN_MODE=release \
    GOGC=100 \
    GOMEMLIMIT=450MiB

# Expose port
EXPOSE 8080

# Use exec form for proper signal handling
ENTRYPOINT ["/app/download-service"]
