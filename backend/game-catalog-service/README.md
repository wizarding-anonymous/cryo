# Game Catalog Service

This service is part of a microservices-based gaming platform. It is responsible for managing the catalog of games, including creating, reading, updating, deleting, and searching for games.

## Prerequisites

- Docker
- Docker Compose
- Node.js (for local development without Docker)
- npm

## Environment Variables

Before running the application, you need to set up the environment variables. Copy the example file `.env.example` to a new file named `.env`:

```bash
cp .env.example .env
```

Then, fill in the values in the `.env` file for your local environment.

| Variable          | Description                              | Default Value     |
| ----------------- | ---------------------------------------- | ----------------- |
| `POSTGRES_HOST`   | Hostname of the PostgreSQL database.     | `localhost`       |
| `POSTGRES_PORT`   | Port of the PostgreSQL database.         | `5432`            |
| `POSTGRES_USER`   | Username for the PostgreSQL database.    | `user`            |
| `POSTGRES_PASSWORD` | Password for the PostgreSQL database.    | `password`        |
| `POSTGRES_DB`     | Name of the database.                    | `game_catalog_db` |
| `REDIS_HOST`      | Hostname of the Redis cache.             | `localhost`       |
| `REDIS_PORT`      | Port of the Redis cache.                 | `6379`            |

## Running the Application with Docker

The easiest way to run the service and its dependencies (PostgreSQL, Redis) is with Docker Compose.

From the `backend/game-catalog-service` directory, run:

```bash
docker-compose up --build
```

The service will be available at `http://localhost:3002`.

## API Overview

The API is documented using Swagger/OpenAPI. Once the application is running, you can access the interactive API documentation at:

`http://localhost:3002/api-docs`

### Main Endpoints

- `POST /api/games`: Create a new game.
- `GET /api/games`: Get a paginated list of games.
- `GET /api/games/:id`: Get a specific game by its ID.
- `PATCH /api/games/:id`: Update a game.
- `DELETE /api/games/:id`: Delete a game.
- `GET /api/search`: Search for games by title.
- `GET /api/health`: Health check endpoint for the service and its dependencies.

## Running Tests

To run the unit and e2e tests, use the following npm scripts:

```bash
# Run unit tests
npm test

# Run e2e tests
npm run test:e2e
```
