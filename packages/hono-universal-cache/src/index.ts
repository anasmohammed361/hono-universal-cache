import type { MiddlewareHandler } from "hono"
import { createStorage } from "unstorage"

import { CacheManager } from "./cache"
import type { CacheOptions } from "./types"
import { DEFAULT_CACHEABLE_STATUS_CODES } from "./types"
import {
  generateCacheKey,
  isCacheableStatus,
} from "./utils"
import { getRuntimeKey } from "hono/adapter"

/**
 * Universal cache middleware for Hono.
 * 
 * Caches responses using unstorage for cross-runtime compatibility.
 * Works with Cloudflare Workers, Vercel Edge, Node.js, Bun, Deno, and more.
 * 
 * @param options - Cache configuration options
 * @param options.cacheName - Cache namespace, either a string or a function that returns a string.
 *                             Used to organize cached entries. Functions receive the Hono context
 *                             and can be async for dynamic cache names (e.g., tenant-based caching).
 * @param options.storage - Unstorage instance for cache persistence. If not provided, defaults to
 *                          in-memory storage (recommended for development only). Use drivers like
 *                          Cloudflare KV, Redis, or Vercel KV for production.
 * @param options.ttl - Time-to-live for cached entries in seconds. After this duration, entries
 *                      are considered expired and will be removed on next access. Omit for no expiration.
 * @param options.cacheableStatusCodes - Array of HTTP status codes to cache. Only responses with
 *                                       these status codes will be stored. Defaults to `[200]`.
 * @param options.keyGenerator - Custom function to generate cache keys from the Hono context.
 *                               Defaults to using the full request URL. Can be async. Useful for
 *                               ignoring query parameters or creating custom cache strategies.
 * 
 * @returns Hono middleware handler
 * 
 * @example Basic usage with TTL
 * ```ts
 * import { Hono } from 'hono'
 * import { universalCache } from 'hono-universal-cache'
 * 
 * const app = new Hono()
 * 
 * app.use('*', universalCache({
 *   cacheName: 'my-app-cache',
 *   ttl: 3600 // Cache for 1 hour
 * }))
 * ```
 * 
 * @example With custom storage driver (Cloudflare KV)
 * ```ts
 * import { Hono } from 'hono'
 * import { universalCache } from 'hono-universal-cache'
 * import { createStorage } from 'unstorage'
 * import cloudflareKVBindingDriver from 'unstorage/drivers/cloudflare-kv-binding'
 * 
 * const app = new Hono<{ Bindings: { CACHE: KVNamespace } }>()
 * 
 * app.use('*', async (c, next) => {
 *   const storage = createStorage({
 *     driver: cloudflareKVBindingDriver({ binding: c.env.CACHE })
 *   })
 *   
 *   return universalCache({
 *     cacheName: 'api-cache',
 *     storage,
 *     ttl: 300
 *   })(c, next)
 * })
 * ```
 * 
 * @example Dynamic cache names for multi-tenancy
 * ```ts
 * app.use('*', universalCache({
 *   cacheName: (c) => {
 *     const tenantId = c.req.header('X-Tenant-ID') || 'default'
 *     return `cache:${tenantId}`
 *   },
 *   ttl: 600
 * }))
 * ```
 * 
 * @example Custom key generator to ignore query params
 * ```ts
 * app.use('*', universalCache({
 *   cacheName: 'api-cache',
 *   keyGenerator: (c) => {
 *     const url = new URL(c.req.url)
 *     return url.pathname // Ignore query parameters
 *   }
 * }))
 * ```
 * 
 * @example Cache multiple status codes
 * ```ts
 * app.use('*', universalCache({
 *   cacheName: 'api-cache',
 *   cacheableStatusCodes: [200, 201, 301, 302],
 *   ttl: 1800
 * }))
 * ```
 */
export const universalCache = (options: CacheOptions): MiddlewareHandler => {
  // Initialize storage
  let storage = options.storage
  if (!storage) {
    console.warn('No storage provided, using default in-memory storage')
    storage = createStorage()
  }

  // Create cache manager
  const cacheManager = new CacheManager(storage, options.ttl)

  const cacheableStatusCodes = new Set<number>(
    options.cacheableStatusCodes ?? DEFAULT_CACHEABLE_STATUS_CODES
  )

  // Return middleware handler
  return async (c, next) => {
    // Generate cache key
    const baseKey = await generateCacheKey(c, options.keyGenerator)
    
    const cacheName =
      typeof options.cacheName === 'function'
        ? await options.cacheName(c)
        : options.cacheName

    const key = `${cacheName}:${baseKey}`

    // Try to retrieve from cache
    const cachedResponse = await cacheManager.get(key)
    if (cachedResponse) {
      return new Response(cachedResponse.body, cachedResponse)
    }

    // Execute downstream handlers
    await next()

    // Check if response should be cached
    if (!isCacheableStatus(c.res.status, cacheableStatusCodes)) {
      return
    }

    // Clone response for caching
    const res = c.res.clone()

    // Store in cache
    const cachePromise = cacheManager.set(key, res)

    // Use waitUntil if available (Cloudflare Workers, Vercel Edge)
    if (getRuntimeKey() === 'workerd') {
      c?.executionCtx?.waitUntil?.(cachePromise)
    } else {
      // For other runtimes, await the cache write
      await cachePromise
    }
  }
}

// Re-export types for convenience
export type { CacheOptions, CachedResponse, CacheMetadata } from "./types"
export { CacheManager } from "./cache"
