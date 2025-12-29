# hono-universal-cache

Universal cache middleware for [Hono](https://hono.dev) powered by [unstorage](https://unstorage.unjs.io).

Cache **API responses** across **any runtime** - Cloudflare Workers, Vercel Edge, Node.js, Bun, Deno, and more.

> **Note:** Optimized for API responses (JSON, text, HTML). For static assets (images, videos, files), use CDN/edge caching instead.

## Features

✨ **Universal Runtime Support** - Works everywhere Hono works  
🗄️ **Multiple Storage Drivers** - Memory, Redis, Cloudflare KV, Vercel KV, filesystem, and [more](https://unstorage.unjs.io/drivers)  
⚡ **TTL Support** - Automatic expiration with configurable time-to-live  
🎯 **Selective Caching** - Control what gets cached by status code  
🔑 **Custom Key Generation** - Flexible cache key strategies  
🪶 **Lightweight** - Minimal overhead, focused on storage operations  
🎨 **HTTP Header Agnostic** - You control your own Cache-Control headers  
📦 **Efficient Storage** - Optimized for text-based API responses

## Installation

```bash
npm install hono-universal-cache
# or
pnpm add hono-universal-cache
# or
yarn add hono-universal-cache
```

> **Note:** `unstorage` is included as a dependency - no need to install it separately!

## Quick Start

### Basic Usage (In-Memory)

```typescript
import { Hono } from 'hono'
import { universalCache } from 'hono-universal-cache'

const app = new Hono()

app.use('*', universalCache({
  cacheName: 'my-app-cache',
  ttl: 3600 // 1 hour
}))

app.get('/api/data', (c) => {
  // Set your own Cache-Control headers
  c.header('Cache-Control', 'public, max-age=3600')
  return c.json({ timestamp: Date.now() })
})

export default app
```

### With Custom Storage Driver

```typescript
import { createStorage } from 'unstorage'
import redisDriver from 'unstorage/drivers/redis'

const storage = createStorage({
  driver: redisDriver({
    host: 'localhost',
    port: 6379
  })
})

app.use('*', universalCache({
  cacheName: 'api-cache',
  storage,
  ttl: 3600
}))
```

## Runtime-Specific Examples

### Cloudflare Workers

```typescript
import { Hono } from 'hono'
import { universalCache } from 'hono-universal-cache'
import { createStorage } from 'unstorage'
import cloudflareKVBindingDriver from 'unstorage/drivers/cloudflare-kv-binding'

type Env = {
  MY_KV: KVNamespace
}

const app = new Hono<{ Bindings: Env }>()

app.use('*', async (c, next) => {
  const storage = createStorage({
    driver: cloudflareKVBindingDriver({ 
      binding: c.env.MY_KV 
    })
  })

  return universalCache({
    cacheName: 'worker-cache',
    storage,
    ttl: 3600
  })(c, next)
})

export default app
```

### Vercel Edge

```typescript
import { createStorage } from 'unstorage'
import vercelKVDriver from 'unstorage/drivers/vercel-kv'

const storage = createStorage({
  driver: vercelKVDriver({
    // Auto-detects from environment:
    // KV_REST_API_URL and KV_REST_API_TOKEN
  })
})

app.use('*', universalCache({
  cacheName: 'edge-cache',
  storage,
  ttl: 3600
}))
```

### Node.js / Bun (Filesystem)

```typescript
import { createStorage } from 'unstorage'
import fsDriver from 'unstorage/drivers/fs'

const storage = createStorage({
  driver: fsDriver({
    base: './cache'
  })
})

app.use('*', universalCache({
  cacheName: 'fs-cache',
  storage,
  ttl: 3600
}))
```

### Redis

```typescript
import { createStorage } from 'unstorage'
import redisDriver from 'unstorage/drivers/redis'

const storage = createStorage({
  driver: redisDriver({
    host: 'localhost',
    port: 6379,
    // password: 'your-password'
  })
})

app.use('*', universalCache({
  cacheName: 'redis-cache',
  storage,
  ttl: 3600
}))
```

## API Reference

### `universalCache(options)`

Creates a Hono middleware for response caching.

#### Options

```typescript
type CacheOptions = {
  // Required: Cache namespace
  cacheName: string | ((c: Context) => Promise<string> | string)
  
  // Optional: Unstorage instance (defaults to in-memory)
  storage?: Storage
  
  // Optional: Time-to-live in seconds
  ttl?: number
  
  // Optional: Status codes to cache (default: [200])
  cacheableStatusCodes?: number[]
  
  // Optional: Custom cache key generator
  keyGenerator?: (c: Context) => Promise<string> | string
}
```

## Common Use Cases

### Dynamic Cache Names

Cache different tenants or users separately:

```typescript
app.use('*', universalCache({
  cacheName: (c) => {
    const tenant = c.req.header('X-Tenant-ID') || 'default'
    return `cache:${tenant}`
  },
  storage,
  ttl: 3600
}))
```

### Custom Key Generation

Cache based on custom logic (e.g., ignore specific query params):

```typescript
app.use('*', universalCache({
  cacheName: 'api-cache',
  keyGenerator: (c) => {
    const url = new URL(c.req.url)
    // Ignore tracking parameters
    url.searchParams.delete('utm_source')
    url.searchParams.delete('utm_campaign')
    return url.toString()
  },
  storage
}))
```

### Selective Caching by Status Code

Cache successful and redirect responses:

```typescript
app.use('*', universalCache({
  cacheName: 'selective-cache',
  cacheableStatusCodes: [200, 201, 301, 302],
  storage
}))
```

### Managing HTTP Headers

The middleware focuses on storage-level caching. You control HTTP headers in your route handlers:

```typescript
app.get('/api/public', (c) => {
  // Set headers for browser/CDN caching
  c.header('Cache-Control', 'public, max-age=3600')
  c.header('Vary', 'Accept-Encoding')
  
  return c.json({ data: 'public data' })
})

app.get('/api/private', (c) => {
  // Private data - browser should not cache
  c.header('Cache-Control', 'private, no-cache')
  
  // But server-side cache can still store it
  return c.json({ data: 'user-specific data' })
})
```

## Storage Drivers

Use any [unstorage driver](https://unstorage.unjs.io/drivers):

### Popular Drivers

- **Memory** - `unstorage/drivers/memory` (default, ephemeral)
- **Filesystem** - `unstorage/drivers/fs` (Node.js/Bun)
- **Redis** - `unstorage/drivers/redis` (persistent, distributed)
- **Cloudflare KV** - `unstorage/drivers/cloudflare-kv-binding`
- **Vercel KV** - `unstorage/drivers/vercel-kv`
- **MongoDB** - `unstorage/drivers/mongodb`
- **Upstash Redis** - `unstorage/drivers/upstash`
- **LRU Cache** - `unstorage/drivers/lru-cache` (in-memory with eviction)

### Cloud Storage

- **AWS S3** - `unstorage/drivers/s3`
- **Azure Blob** - `unstorage/drivers/azure-storage-blob`
- **Cloudflare R2** - `unstorage/drivers/cloudflare-r2-binding`
- **Vercel Blob** - `unstorage/drivers/vercel-blob`

See [all drivers](https://unstorage.unjs.io/drivers) in the unstorage documentation.

## How It Works

1. **Request arrives** → Middleware generates cache key
2. **Check cache** → Retrieve from storage if exists and not expired
3. **Cache hit** → Return cached response immediately
4. **Cache miss** → Execute route handler
5. **Check cacheability** → Verify status code and Vary header
6. **Store response** → Save text body to storage with TTL metadata (non-blocking)
7. **Return response** → Send to client

## Important Notes

### Optimized for API Responses

This middleware is designed for **text-based API responses**:

- ✅ **JSON APIs** - Perfect use case
- ✅ **Text responses** - Works great
- ✅ **HTML pages** - Fully supported
- ✅ **XML/RSS feeds** - No problem
- ❌ **Binary assets** (images, PDFs, videos) - Use CDN/edge caching instead

**Why not binary?** The middleware uses `response.text()` for optimal storage efficiency. For static assets, use:
- CDN caching (Cloudflare, CloudFront)
- Object storage (S3, R2, Blob Storage)
- Hono's built-in static file serving with CDN

### Vary: * Behavior

Responses with `Vary: *` header are **never cached**, per RFC 9111:

```typescript
app.get('/api/uncacheable', (c) => {
  c.header('Vary', '*') // This response will not be cached
  return c.json({ random: Math.random() })
})
```

### HTTP Headers vs Storage Caching

This middleware handles **server-side storage caching only**:

- ✅ Stores responses in Redis, KV, filesystem, etc.
- ❌ Does NOT modify Cache-Control or other HTTP headers
- 💡 You control browser/CDN caching via headers in your routes

### Non-blocking Cache Writes

Cache writes happen asynchronously and don't block responses:

- **Cloudflare Workers/Vercel Edge**: Uses `waitUntil()` for background writes
- **Other runtimes**: Uses promises with error handling

## Advanced Usage

### CacheManager API

Access the low-level cache manager for manual operations:

```typescript
import { CacheManager } from 'hono-universal-cache'
import { createStorage } from 'unstorage'

const storage = createStorage()
const cache = new CacheManager(storage, 3600) // 1 hour TTL

// Manual cache operations
await cache.set('key', response)
const cached = await cache.get('key')
const exists = await cache.has('key')
await cache.delete('key')
await cache.clear()
const keys = await cache.keys()
```

### Per-Route Caching

Apply caching to specific routes only:

```typescript
const app = new Hono()

// Global middleware without cache
app.use('*', logger())

// Cache only API routes
app.use('/api/*', universalCache({
  cacheName: 'api-cache',
  storage,
  ttl: 300 // 5 minutes
}))

// Cache product pages longer
app.use('/products/*', universalCache({
  cacheName: 'products-cache',
  storage,
  ttl: 3600 // 1 hour
}))
```

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.

## Credits

- [Hono](https://hono.dev) - Ultrafast web framework
- [unstorage](https://unstorage.unjs.io) - Universal storage layer
