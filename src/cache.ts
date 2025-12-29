import type { Storage } from "unstorage"
import type { CachedResponse, CacheMetadata } from "./types"
import { isExpired } from "./utils"

/**
 * CacheManager handles Response serialization, storage, and retrieval.
 * 
 * Wraps unstorage to provide Response-specific caching with TTL support.
 * Designed for API responses (JSON, text, HTML) - not binary assets.
 */
export class CacheManager {
  private storage: Storage
  private ttl?: number

  /**
   * Creates a new CacheManager instance.
   * 
   * @param storage - Unstorage instance
   * @param ttl - Optional time-to-live in seconds
   */
  constructor(storage: Storage, ttl?: number) {
    this.storage = storage
    this.ttl = ttl
  }

  /**
   * Serializes a Response object for storage.
   * 
   * Converts Response to a plain object with text body.
   * Optimized for API responses (JSON, text, HTML).
   * 
   * @param response - Response to serialize
   * @returns Serialized response object
   */
  private async serializeResponse(response: Response): Promise<CachedResponse> {
    const body = await response.text()
    const headers: Record<string, string> = {}
    
    response.headers.forEach((value, key) => {
      headers[key] = value
    })

    return {
      body,
      headers,
      status: response.status,
      statusText: response.statusText,
      cachedAt: Date.now()
    }
  }

  /**
   * Deserializes a cached response back to Response object.
   * 
   * @param cached - Serialized response
   * @returns Reconstructed Response object
   */
  private deserializeResponse(cached: CachedResponse): Response {
    const headers = new Headers(cached.headers)

    return new Response(cached.body, {
      status: cached.status,
      statusText: cached.statusText,
      headers
    })
  }

  /**
   * Retrieves a cached response by key.
   * 
   * Returns null if:
   * - Entry doesn't exist
   * - Entry has expired (based on TTL)
   * 
   * @param key - Cache key
   * @returns Cached Response or null
   */
  async get(key: string): Promise<Response | null> {
    try {
      const cached = await this.storage.getItem<CachedResponse>(key)
      
      if (!cached) {
        return null
      }

      // Check if entry has expired
      if (isExpired(cached.cachedAt, this.ttl)) {
        // Remove expired entry
        await this.delete(key)
        return null
      }

      return this.deserializeResponse(cached)
    } catch (error) {
      console.error('Cache retrieval error:', error)
      return null
    }
  }

  /**
   * Stores a Response in cache.
   * 
   * @param key - Cache key
   * @param response - Response to cache
   */
  async set(key: string, response: Response): Promise<void> {
    try {
      const serialized = await this.serializeResponse(response)
      
      // Store with metadata for TTL tracking
      await this.storage.setItem(key, serialized)
      
      // Set metadata if TTL is configured
      if (this.ttl) {
        const metadata: CacheMetadata = {
          mtime: new Date(serialized.cachedAt),
          expires: serialized.cachedAt + (this.ttl * 1000)
        }
        await this.storage.setMeta(key, metadata)
      }
    } catch (error) {
      console.error('Cache storage error:', error)
    }
  }

  /**
   * Checks if a key exists in cache and is not expired.
   * 
   * @param key - Cache key
   * @returns True if key exists and is valid
   */
  async has(key: string): Promise<boolean> {
    try {
      const cached = await this.storage.getItem<CachedResponse>(key)
      
      if (!cached) {
        return false
      }

      return !isExpired(cached.cachedAt, this.ttl)
    } catch {
      return false
    }
  }

  /**
   * Deletes a cached entry.
   * 
   * @param key - Cache key
   */
  async delete(key: string): Promise<void> {
    try {
      await this.storage.removeItem(key)
    } catch (error) {
      console.error('Cache deletion error:', error)
    }
  }

  /**
   * Clears all cached entries.
   */
  async clear(): Promise<void> {
    try {
      await this.storage.clear()
    } catch (error) {
      console.error('Cache clear error:', error)
    }
  }

  /**
   * Gets all cache keys.
   * 
   * @returns Array of cache keys
   */
  async keys(): Promise<string[]> {
    try {
      return await this.storage.getKeys()
    } catch (error) {
      console.error('Cache keys retrieval error:', error)
      return []
    }
  }
}
