import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import type { Context } from "hono";
import { generateCacheKey, isCacheableStatus, isExpired } from "../src/utils";

// Helper to get context from a request
async function getContext(url: string): Promise<Context> {
  const app = new Hono();
  let capturedContext: Context | null = null;

  app.get("*", (c) => {
    capturedContext = c;
    return c.text("ok");
  });

  await app.request(url);
  return capturedContext!;
}

describe("generateCacheKey", () => {
  it("should use full URL with method as default cache key", async () => {
    const c = await getContext("http://localhost:3000/api/test?foo=bar");

    const key = await generateCacheKey(c);

    expect(key).toBe("GET:http://localhost:3000/api/test?foo=bar");
  });

  it("should use custom key generator when provided", async () => {
    const c = await getContext("http://localhost:3000/api/test?foo=bar");

    const customGenerator = (ctx: Context) => `custom-${ctx.req.path}`;
    const key = await generateCacheKey(c, customGenerator);

    expect(key).toBe("custom-/api/test");
  });

  it("should handle async custom key generator", async () => {
    const c = await getContext("http://localhost:3000/api/test");

    const asyncGenerator = async (ctx: Context) => {
      return Promise.resolve(`async-${ctx.req.path}`);
    };
    const key = await generateCacheKey(c, asyncGenerator);

    expect(key).toBe("async-/api/test");
  });
});

describe("isCacheableStatus", () => {
  it("should return true for status codes in the set", () => {
    const cacheableStatuses = new Set([200, 201, 301]);

    expect(isCacheableStatus(200, cacheableStatuses)).toBe(true);
    expect(isCacheableStatus(201, cacheableStatuses)).toBe(true);
    expect(isCacheableStatus(301, cacheableStatuses)).toBe(true);
  });

  it("should return false for status codes not in the set", () => {
    const cacheableStatuses = new Set([200]);

    expect(isCacheableStatus(404, cacheableStatuses)).toBe(false);
    expect(isCacheableStatus(500, cacheableStatuses)).toBe(false);
    expect(isCacheableStatus(201, cacheableStatuses)).toBe(false);
  });

  it("should handle empty set", () => {
    const cacheableStatuses = new Set<number>();

    expect(isCacheableStatus(200, cacheableStatuses)).toBe(false);
  });
});

describe("isExpired", () => {
  it("should return false when no TTL is provided", () => {
    const cachedAt = Date.now();

    expect(isExpired(cachedAt)).toBe(false);
    expect(isExpired(cachedAt, undefined)).toBe(false);
  });

  it("should return false when entry is not expired", () => {
    const cachedAt = Date.now();
    const ttl = 3600; // 1 hour in seconds

    expect(isExpired(cachedAt, ttl)).toBe(false);
  });

  it("should return true when entry has expired", () => {
    const cachedAt = Date.now() - 7200000; // 2 hours ago
    const ttl = 3600; // 1 hour TTL

    expect(isExpired(cachedAt, ttl)).toBe(true);
  });

  it("should return false when entry is exactly at expiration boundary", () => {
    const ttl = 60; // 60 seconds
    const cachedAt = Date.now() - ttl * 1000; // Exactly expired

    // Should be expired (now > expiresAt)
    expect(isExpired(cachedAt, ttl)).toBe(false);
  });

  it("should handle edge case: entry just expired", () => {
    const ttl = 1; // 1 second
    const cachedAt = Date.now() - 1001; // 1.001 seconds ago

    expect(isExpired(cachedAt, ttl)).toBe(true);
  });

  it("should handle edge case: entry not quite expired", () => {
    const ttl = 10; // 10 seconds
    const cachedAt = Date.now() - 9000; // 9 seconds ago

    expect(isExpired(cachedAt, ttl)).toBe(false);
  });
});
