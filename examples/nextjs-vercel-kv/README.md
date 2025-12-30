# Next.js + Vercel KV Cache Example

This example demonstrates using `hono-universal-cache` with Vercel KV storage in a Next.js application using Hono as the API framework.

## Features

- ✅ Next.js 16 with App Router
- ✅ Hono API routes with `/hono` base path
- ✅ Vercel KV storage for caching
- ✅ Local development with serverless-redis-http
- ✅ TypeScript support

## Prerequisites

- Node.js 18+ or Bun
- Docker and Docker Compose (for local development)
- Vercel account (for production deployment)

## Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Environment Variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

For local development, the default values work with the Docker Compose setup:

```env
KV_REST_API_URL="http://localhost:8079"
KV_REST_API_TOKEN="example_token"
```

For production on Vercel, these will be automatically set when you add a Vercel KV store to your project.

### 3. Start Redis (Local Development)

Start the Redis server and serverless-redis-http proxy:

```bash
docker-compose up
```

This starts:
- Redis on port 6379
- serverless-redis-http on port 8079 (emulates Vercel KV REST API)

### 4. Run the Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## API Routes

All Hono routes are available under `/hono`:

- `GET /hono/time` - Returns current server time (cached for 60s)

## Testing the Cache

### First Request (Cache Miss)
```bash
curl http://localhost:3000/hono/time
```

Response includes the current time.

## How It Works

1. **Hono App**: API routes are defined in `src/lib/hono/index.ts`
2. **Cache Middleware**: `universalCache` middleware is applied globally
3. **Vercel KV Storage**: Uses `unstorage/drivers/vercel-kv` driver
4. **Next.js Integration**: Hono app is handled via `hono/vercel` adapter in `src/app/hono/[[...route]]/route.ts`
