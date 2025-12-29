import type { Context } from "hono"

/**
 * Generates a cache key for the given context.
 * 
 * @param c - Hono context
 * @param keyGenerator - Optional custom key generator function
 * @returns Cache key string
 */
export async function generateCacheKey(
  c: Context,
  keyGenerator?: (c: Context) => Promise<string> | string
): Promise<string> {
  if (keyGenerator) {
    return await keyGenerator(c)
  }
  return c.req.url
}

/**
 * Checks if a response should skip caching based on Vary header.
 * 
 * Per RFC 9111 Section 4.1, responses with "Vary: *" should not be cached
 * as they indicate the response varies in unpredictable ways.
 * 
 * @param res - Response to check
 * @returns True if cache should be skipped
 */
export function shouldSkipCache(res: Response): boolean {
  const vary = res.headers.get('Vary')
  // Don't cache for Vary: *
  // https://www.rfc-editor.org/rfc/rfc9111#section-4.1
  // Also note that some runtimes throw a TypeError for it.
  return vary !== null && vary.includes('*')
}

/**
 * Checks if a status code is cacheable.
 * 
 * @param status - HTTP status code
 * @param cacheableStatusCodes - Set of allowed status codes
 * @returns True if status code is cacheable
 */
export function isCacheableStatus(
  status: number,
  cacheableStatusCodes: Set<number>
): boolean {
  return cacheableStatusCodes.has(status)
}

/**
 * Checks if a cached entry has expired based on TTL.
 * 
 * @param cachedAt - Timestamp when entry was cached (Unix epoch ms)
 * @param ttl - Time-to-live in seconds
 * @returns True if entry has expired
 */
export function isExpired(cachedAt: number, ttl?: number): boolean {
  if (!ttl) {
    return false
  }
  const now = Date.now()
  const expiresAt = cachedAt + (ttl * 1000)
  return now > expiresAt
}
