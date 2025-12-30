# Node.js + Redis Cache Example

This example demonstrates how to use `hono-universal-cache` with Redis in a Node.js environment.

## Prerequisites

- Node.js 18+
- Docker and Docker Compose (for running Redis)
- pnpm (or npm/yarn)

## Setup

1. **Install dependencies:**

```bash
pnpm install
```

2. **Set up environment variables:**

```bash
cp .env.example .env
```

Edit `.env` if you need to customize the configuration.

3. **Start Redis using Docker Compose:**

```bash
docker-compose up -d
```

This will start a Redis instance on `localhost:6379`.

4. **Start the development server:**

```bash
pnpm dev
```

The server will start on `http://localhost:3000`.

## Environment Variables

- `PORT` - Server port (default: 3000)
- `REDIS_HOST` - Redis host (default: localhost)
- `REDIS_PORT` - Redis port (default: 6379)
- `REDIS_PASSWORD` - Redis password (optional)
- `REDIS_DB` - Redis database number (default: 0)
- `CACHE_TTL` - Cache time-to-live in seconds (default: 3600)

## Available Endpoints

- `GET /` - API information and available endpoints
- `GET /api/time` - Current time (cached for 1 hour)
- `GET /api/random` - Random number (cached for 1 hour)
- `GET /api/user/:id` - User data (cached for 1 hour)

## Testing the Cache

1. Visit `http://localhost:3000/api/random`
2. Note the random number returned
3. Refresh the page - you'll see the same number (cached)
4. Wait for the TTL to expire or restart the server to see a new number

## Stopping Redis

```bash
docker-compose down
```

To remove the Redis data volume:

```bash
docker-compose down -v
```

## Production Build

```bash
pnpm build
pnpm start
```
