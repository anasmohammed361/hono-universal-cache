import type { Context } from "hono";
import type { Storage } from "unstorage";

/**
 * Options for configuring the universal cache middleware.
 */
export type CacheOptions = {
  /**
   * Name or function to generate cache namespace.
   * Used to organize cached entries.
   */
  cacheName: string | ((c: Context) => Promise<string> | string);

  /**
   * HTTP status codes that should be cached.
   * @default [200]
   */
  cacheableStatusCodes?: number[];

  /**
   * Custom function to generate cache keys.
   * @default Uses request URL
   */
  keyGenerator?: (c: Context) => Promise<string> | string;

  /**
   * Unstorage instance for cache persistence.
   * If not provided, defaults to in-memory storage.
   */
  storage?: Storage;

  /**
   * Time-to-live for cached entries in seconds.
   * After this duration, cached entries are considered stale.
   */
  ttl?: number;
};

/**
 * Serialized representation of a cached Response.
 * Stored in unstorage with metadata.
 * Optimized for text-based API responses (JSON, text, HTML).
 */
export type CachedResponse = {
  /**
   * Response body as text string.
   * Works for JSON, text, HTML, and other text-based responses.
   */
  body: string;

  /**
   * Response headers as key-value pairs.
   */
  headers: Record<string, string>;

  /**
   * HTTP status code.
   */
  status: number;

  /**
   * HTTP status text.
   */
  statusText: string;

  /**
   * Timestamp when the response was cached (Unix epoch ms).
   */
  cachedAt: number;
};

/**
 * Metadata stored alongside cached entries.
 */
export type CacheMetadata = {
  /**
   * Timestamp when entry was created (Date object for unstorage compatibility).
   */
  mtime: Date;

  /**
   * Expiration timestamp (Unix epoch ms).
   * Calculated as cachedAt + ttl.
   */
  expires?: number;
};

/**
 * Status codes that can be cached by default.
 */
export const DEFAULT_CACHEABLE_STATUS_CODES: ReadonlyArray<number> = [200];
