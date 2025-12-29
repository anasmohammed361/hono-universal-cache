import type { MiddlewareHandler } from "hono"
import { createStorage } from "unstorage"

import { CacheManager } from "./cache"
import type { CacheOptions } from "./types"
import { DEFAULT_CACHEABLE_STATUS_CODES } from "./types"
import {
  generateCacheKey,
  isCacheableStatus,
  shouldSkipCache,
} from "./utils"

/**
 * Universal cache middleware for Hono.
 * 
 * Caches responses using unstorage for cross-runtime compatibility.
 * Works with Cloudflare Workers, Vercel Edge, Node.js, Bun, Deno, and more.
 * 
 * @param options - Cache configuration options
 * @returns Hono middleware handler
 * 
 * @example
 * ```ts
 * import { Hono } from 'hono'
 * import { universalCache } from 'hono-universal-cache'
 * 
 * const app = new Hono()
 * 
 * app.use('*', universalCache({
 *   cacheName: 'my-app-cache',
 *   ttl: 3600
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

    // Skip caching if Vary: * is present
    if (shouldSkipCache(c.res)) {
      return
    }

    // Clone response for caching
    const res = c.res.clone()

    // Store in cache (non-blocking if executionCtx available)
    const cachePromise = cacheManager.set(key, res)

    // Use waitUntil if available (Cloudflare Workers, Vercel Edge)
    if (c.executionCtx?.waitUntil) {
      c.executionCtx.waitUntil(cachePromise)
    } else {
      // For other runtimes, cache asynchronously but don't block response
      cachePromise.catch((error) => {
        console.error('Background cache storage failed:', error)
      })
    }
  }
}

// Re-export types for convenience
export type { CacheOptions, CachedResponse, CacheMetadata } from "./types"
export { CacheManager } from "./cache"
