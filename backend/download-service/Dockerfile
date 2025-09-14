# syntax=docker/dockerfile:1.4

ARG GO_VERSION=1.21

FROM golang:${GO_VERSION}-alpine AS builder
WORKDIR /app
RUN apk add --no-cache git ca-certificates tzdata

# Cache deps
COPY go.mod ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

# Copy source
COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/download-service ./cmd/server

FROM gcr.io/distroless/base-debian12:nonroot
WORKDIR /
COPY --from=builder /out/download-service /download-service
EXPOSE 8080
ENV PORT=8080 \
    APP_ENV=production
USER nonroot:nonroot
ENTRYPOINT ["/download-service"]

