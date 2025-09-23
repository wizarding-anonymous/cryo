# syntax=docker/dockerfile:1.4

ARG GO_VERSION=1.24

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

FROM alpine:3.20
WORKDIR /app
RUN addgroup -g 65532 -S nonroot && adduser -S -D -H -u 65532 -G nonroot nonroot \
    && apk add --no-cache ca-certificates tzdata
COPY --from=builder /out/download-service /app/download-service
EXPOSE 8080
ENV PORT=8080 \
    APP_ENV=production
USER 65532:65532
ENTRYPOINT ["/app/download-service"]
