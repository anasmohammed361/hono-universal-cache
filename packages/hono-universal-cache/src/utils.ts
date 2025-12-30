import type { Context } from "hono";

/**
 * Generates a cache key for the given context.
 * Includes HTTP method to prevent cache collisions when caching non-GET requests.
 *
 * @param c - Hono context
 * @param keyGenerator - Optional custom key generator function
 * @returns Cache key string in format: "METHOD:url"
 */
export async function generateCacheKey(
  c: Context,
  keyGenerator?: (c: Context) => Promise<string> | string,
): Promise<string> {
  if (keyGenerator) {
    return await keyGenerator(c);
  }
  // Include method to prevent collisions (e.g., GET /api vs POST /api)
  return `${c.req.method}:${c.req.url}`;
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
  cacheableStatusCodes: Set<number>,
): boolean {
  return cacheableStatusCodes.has(status);
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
    return false;
  }
  const now = Date.now();
  const expiresAt = cachedAt + ttl * 1000;
  return now > expiresAt;
}
