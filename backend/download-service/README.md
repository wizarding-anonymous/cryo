# Download Service (MVP) – Go + Gin

This service manages download sessions for purchased games. This initial scaffold implements Task 1 from the specs: Go module setup, dependencies, project structure, and containerization with Postgres + Redis for local development.

## Quickstart

- Prerequisites: Docker, Docker Compose, Go 1.21+
- Copy `.env.example` to `.env` and adjust if needed.
- Start stack:

    docker compose up --build

Service runs on http://localhost:8080 with GET /health and GET /ready endpoints.

## Layout

- `cmd/server`: entrypoint with Gin HTTP server
- `internal/handlers`: REST handlers (stubs for now)
- `internal/services`: business logic (stubs)
- `internal/models`: data models
- `internal/repository`: DB connection (GORM + Postgres)
- `internal/middleware`: auth/logging placeholders
- `pkg/config`: env configuration loader
- `pkg/logger`: lightweight logging + Gin middleware

## Dependencies

- Gin (`github.com/gin-gonic/gin`)
- GORM (`gorm.io/gorm`) + Postgres driver (`gorm.io/driver/postgres`)
- Postgres driver (`github.com/lib/pq`) – kept for compatibility where needed
- Redis (`github.com/go-redis/redis/v9`)

## Next Steps (from specs)

- Implement DB migrations and repositories
- Implement Download/File/Stream services and handlers
- Integrate Library Service over HTTP
- Add tests and observability

