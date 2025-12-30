import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { createStorage } from "unstorage";
import { universalCache } from "../src";

describe("universalCache - Basic Functionality", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
  });

  it("should cache GET request response", async () => {
    let callCount = 0;

    app.use(
      "*",
      universalCache({
        cacheName: "test-cache",
      }),
    );

    app.get("/test", (c) => {
      callCount++;
      return c.json({ message: "Hello", count: callCount });
    });

    // First request - should hit handler
    const res1 = await app.request("/test");
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(data1.count).toBe(1);

    // Second request - should return cached response
    const res2 = await app.request("/test");
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.count).toBe(1); // Same count = cached

    expect(callCount).toBe(1); // Handler called only once
  });

  it("should use default in-memory storage when not provided", async () => {
    let callCount = 0;

    app.use(
      "*",
      universalCache({
        cacheName: "default-storage",
      }),
    );

    app.get("/api", (c) => {
      callCount++;
      return c.text("Response");
    });

    await app.request("/api");
    await app.request("/api");

    expect(callCount).toBe(1); // Cached with default storage
  });

  it("should respect custom storage driver", async () => {
    const storage = createStorage();
    let callCount = 0;

    app.use(
      "*",
      universalCache({
        cacheName: "custom-cache",
        storage,
      }),
    );

    app.get("/api", (c) => {
      callCount++;
      return c.text("Response");
    });

    await app.request("/api");
    await app.request("/api");

    expect(callCount).toBe(1);

    // Verify item exists in storage
    const keys = await storage.getKeys();
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.some((key) => key.includes("custom-cache"))).toBe(true);
  });

  it("should cache different routes separately", async () => {
    const storage = createStorage();

    app.use(
      "*",
      universalCache({
        cacheName: "multi-route",
        storage,
      }),
    );

    app.get("/route1", (c) => c.json({ route: 1 }));
    app.get("/route2", (c) => c.json({ route: 2 }));

    await app.request("/route1");
    await app.request("/route2");

    const keys = await storage.getKeys();
    expect(keys.length).toBe(2);
  });
});

describe("universalCache - Custom Key Generation", () => {
  let app: Hono;
  let storage: ReturnType<typeof createStorage>;

  beforeEach(() => {
    app = new Hono();
    storage = createStorage();
  });

  it("should use custom key generator", async () => {
    app.use(
      "*",
      universalCache({
        cacheName: "key-test",
        storage,
        keyGenerator: (c) => {
          return `custom-${c.req.path}`;
        },
      }),
    );

    app.get("/path", (c) => c.text("Hello"));

    await app.request("/path?query=123");
    await new Promise((resolve) => setTimeout(resolve, 1));
    const keys = await storage.getKeys();
    // In key / gets replaced with :
    const hasCustomKey = keys.some((key) => key.includes("custom-:path"));
    expect(hasCustomKey).toBe(true);
  });

  it("should handle async key generator", async () => {
    app.use(
      "*",
      universalCache({
        cacheName: "async-key",
        storage,
        keyGenerator: async (c) => {
          // Simulate async operation
          return Promise.resolve(`async-${c.req.path}`);
        },
      }),
    );

    app.get("/async", (c) => c.text("Async"));

    await app.request("/async");

    const keys = await storage.getKeys();
    expect(keys.some((key) => key.includes("async-:async"))).toBe(true);
  });

  it("should ignore query params with custom key generator", async () => {
    let callCount = 0;

    app.use(
      "*",
      universalCache({
        cacheName: "ignore-query",
        storage,
        keyGenerator: (c) => {
          const url = new URL(c.req.url);
          return url.pathname; // Ignore query params
        },
      }),
    );

    app.get("/api", (c) => {
      callCount++;
      return c.json({ count: callCount });
    });

    // Different query params, same path
    const res1 = await app.request("/api?v=1");
    const res2 = await app.request("/api?v=2");

    const data1 = await res1.json();
    const data2 = await res2.json();

    expect(data1.count).toBe(1);
    expect(data2.count).toBe(1); // Same response = cached
    expect(callCount).toBe(1);
  });
});

describe("universalCache - Status Code Filtering", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
  });

  it("should only cache configured status codes", async () => {
    let callCount = 0;

    app.use(
      "*",
      universalCache({
        cacheName: "status-cache",
        cacheableStatusCodes: [200],
      }),
    );

    app.get("/success", (c) => {
      callCount++;
      return c.json({ status: "ok" });
    });

    app.get("/error", (c) => {
      callCount++;
      return c.json({ error: "Not found" }, 404);
    });

    // Cache 200 response
    await app.request("/success");
    await app.request("/success");
    expect(callCount).toBe(1); // Cached

    // Don't cache 404 response
    await app.request("/error");
    await app.request("/error");
    expect(callCount).toBe(3); // Not cached, both requests hit handler
  });

  it("should cache multiple status codes", async () => {
    let successCount = 0;
    let redirectCount = 0;

    app.use(
      "*",
      universalCache({
        cacheName: "multi-status",
        cacheableStatusCodes: [200, 201, 301, 302],
      }),
    );

    app.get("/success", (c) => {
      successCount++;
      return c.json({ ok: true }, 201);
    });

    app.get("/redirect", (c) => {
      redirectCount++;
      return c.redirect("/other", 301);
    });

    await app.request("/success");
    await app.request("/success");
    expect(successCount).toBe(1); // 201 cached

    await app.request("/redirect");
    await app.request("/redirect");
    expect(redirectCount).toBe(1); // 301 cached
  });

  it("should use default cacheable status codes (200 only)", async () => {
    let callCount = 0;

    app.use(
      "*",
      universalCache({
        cacheName: "default-status",
      }),
    );

    app.get("/test", (c) => {
      callCount++;
      return c.json({}, 201);
    });

    await app.request("/test");
    await app.request("/test");

    expect(callCount).toBe(2); // 201 not in default cacheable codes
  });
});

describe("universalCache - Dynamic Cache Names", () => {
  let app: Hono;
  let storage: ReturnType<typeof createStorage>;

  beforeEach(() => {
    app = new Hono();
    storage = createStorage();
  });

  it("should use dynamic cache name function", async () => {
    app.use(
      "*",
      universalCache({
        cacheName: (c) => {
          const tenant = c.req.header("X-Tenant-ID") || "default";
          return `tenant-${tenant}`;
        },
        storage,
      }),
    );

    app.get("/data", (c) => c.text("Data"));

    await app.request("/data", {
      headers: { "X-Tenant-ID": "acme" },
    });

    const keys = await storage.getKeys();
    const hasAcmeKey = keys.some((key) => key.includes("tenant-acme"));
    expect(hasAcmeKey).toBe(true);
  });

  it("should cache separately for different tenants", async () => {
    let acmeCount = 0;
    let globexCount = 0;

    app.use(
      "*",
      universalCache({
        cacheName: (c) => `tenant-${c.req.header("X-Tenant") || "default"}`,
        storage,
      }),
    );

    app.get("/data", (c) => {
      const tenant = c.req.header("X-Tenant");
      if (tenant === "acme") acmeCount++;
      if (tenant === "globex") globexCount++;
      return c.json({ tenant });
    });

    // Acme tenant
    await app.request("/data", { headers: { "X-Tenant": "acme" } });
    await app.request("/data", { headers: { "X-Tenant": "acme" } });

    // Globex tenant
    await app.request("/data", { headers: { "X-Tenant": "globex" } });
    await app.request("/data", { headers: { "X-Tenant": "globex" } });

    // Each tenant cached separately
    expect(acmeCount).toBe(1);
    expect(globexCount).toBe(1);

    const keys = await storage.getKeys();
    expect(keys.length).toBe(2); // Two separate cache entries
  });

  it("should handle async cache name function", async () => {
    app.use(
      "*",
      universalCache({
        cacheName: async (c) => {
          return Promise.resolve(`async-${c.req.path}`);
        },
        storage,
      }),
    );

    app.get("/test", (c) => c.text("Test"));

    await app.request("/test");

    const keys = await storage.getKeys();
    // In cache keys / are replaced with :
    expect(keys.some((key) => key.includes("async-:test"))).toBe(true);
  });
});

describe("universalCache - Response Types", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
  });

  it("should cache JSON responses", async () => {
    let callCount = 0;

    app.use("*", universalCache({ cacheName: "json-cache" }));

    app.get("/json", (c) => {
      callCount++;
      return c.json({ message: "Hello", timestamp: Date.now() });
    });

    const res1 = await app.request("/json");
    const res2 = await app.request("/json");

    const data1 = await res1.json();
    const data2 = await res2.json();

    expect(data1).toEqual(data2); // Exact same cached response
    expect(callCount).toBe(1);
  });

  it("should cache text responses", async () => {
    let callCount = 0;

    app.use("*", universalCache({ cacheName: "text-cache" }));

    app.get("/text", (c) => {
      callCount++;
      return c.text("Plain text response");
    });

    const res1 = await app.request("/text");
    const res2 = await app.request("/text");

    const text1 = await res1.text();
    const text2 = await res2.text();

    expect(text1).toBe("Plain text response");
    expect(text2).toBe("Plain text response");
    expect(callCount).toBe(1);
  });

  it("should cache HTML responses", async () => {
    let callCount = 0;

    app.use("*", universalCache({ cacheName: "html-cache" }));

    app.get("/html", (c) => {
      callCount++;
      return c.html("<h1>Hello World</h1>");
    });

    const res1 = await app.request("/html");
    const res2 = await app.request("/html");

    const html1 = await res1.text();
    const html2 = await res2.text();

    expect(html1).toBe("<h1>Hello World</h1>");
    expect(html2).toBe("<h1>Hello World</h1>");
    expect(callCount).toBe(1);
  });

  it("should preserve response headers", async () => {
    app.use("*", universalCache({ cacheName: "headers-cache" }));

    app.get("/headers", (c) => {
      c.header("X-Custom-Header", "custom-value");
      c.header("Content-Type", "application/json");
      return c.json({ data: "test" });
    });

    const res1 = await app.request("/headers");
    const res2 = await app.request("/headers");

    expect(res2.headers.get("X-Custom-Header")).toBe("custom-value");
    expect(res2.headers.get("Content-Type")).toContain("application/json");
  });

  it("should preserve response status", async () => {
    app.use(
      "*",
      universalCache({
        cacheName: "status-cache",
        cacheableStatusCodes: [201],
      }),
    );

    app.get("/created", (c) => {
      return c.json({ created: true }, 201);
    });

    const res1 = await app.request("/created");
    const res2 = await app.request("/created");

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
  });
});

describe("universalCache - HTTP Method Restriction", () => {
  let app: Hono;
  let storage: ReturnType<typeof createStorage>;

  beforeEach(() => {
    app = new Hono();
    storage = createStorage();
  });

  it("should only cache GET requests by default", async () => {
    let getCount = 0;
    let postCount = 0;

    app.use(
      "*",
      universalCache({
        cacheName: "method-cache",
        storage,
      }),
    );

    app.get("/api", (c) => {
      getCount++;
      return c.json({ method: "GET", count: getCount });
    });

    app.post("/api", (c) => {
      postCount++;
      return c.json({ method: "POST", count: postCount });
    });

    // GET requests should be cached
    const get1 = await app.request("/api", { method: "GET" });
    const get2 = await app.request("/api", { method: "GET" });
    const getData1 = await get1.json();
    const getData2 = await get2.json();

    expect(getData1.count).toBe(1);
    expect(getData2.count).toBe(1); // Same count = cached
    expect(getCount).toBe(1);

    // POST requests should NOT be cached
    const post1 = await app.request("/api", { method: "POST" });
    const post2 = await app.request("/api", { method: "POST" });
    const postData1 = await post1.json();
    const postData2 = await post2.json();

    expect(postData1.count).toBe(1);
    expect(postData2.count).toBe(2); // Different count = not cached
    expect(postCount).toBe(2);
  });

  it("should not cache PUT requests", async () => {
    let callCount = 0;

    app.use(
      "*",
      universalCache({
        cacheName: "put-cache",
        storage,
      }),
    );

    app.put("/api", (c) => {
      callCount++;
      return c.json({ count: callCount });
    });

    await app.request("/api", { method: "PUT" });
    await app.request("/api", { method: "PUT" });

    expect(callCount).toBe(2); // Not cached
  });

  it("should not cache DELETE requests", async () => {
    let callCount = 0;

    app.use(
      "*",
      universalCache({
        cacheName: "delete-cache",
        storage,
      }),
    );

    app.delete("/api", (c) => {
      callCount++;
      return c.json({ count: callCount });
    });

    await app.request("/api", { method: "DELETE" });
    await app.request("/api", { method: "DELETE" });

    expect(callCount).toBe(2); // Not cached
  });

  it("should not cache PATCH requests", async () => {
    let callCount = 0;

    app.use(
      "*",
      universalCache({
        cacheName: "patch-cache",
        storage,
      }),
    );

    app.patch("/api", (c) => {
      callCount++;
      return c.json({ count: callCount });
    });

    await app.request("/api", { method: "PATCH" });
    await app.request("/api", { method: "PATCH" });

    expect(callCount).toBe(2); // Not cached
  });

  it("should handle method check case-insensitively", async () => {
    let callCount = 0;

    app.use(
      "*",
      universalCache({
        cacheName: "case-cache",
        storage,
      }),
    );

    app.get("/api", (c) => {
      callCount++;
      return c.json({ count: callCount });
    });

    // Both should be cached (GET is case-insensitive)
    await app.request("/api", { method: "GET" });
    await app.request("/api", { method: "get" });

    expect(callCount).toBe(1); // Cached
  });

  it("should bypass method check when flag is enabled", async () => {
    let postCount = 0;
    let putCount = 0;
    let deleteCount = 0;

    app.use(
      "*",
      universalCache({
        cacheName: "bypass-cache",
        storage,
        bypassMethodCheck: true, // Enable bypass
      }),
    );

    app.post("/api", (c) => {
      postCount++;
      return c.json({ method: "POST", count: postCount });
    });

    app.put("/api", (c) => {
      putCount++;
      return c.json({ method: "PUT", count: putCount });
    });

    app.delete("/api", (c) => {
      deleteCount++;
      return c.json({ method: "DELETE", count: deleteCount });
    });

    // POST requests should be cached with bypass
    const post1 = await app.request("/api", { method: "POST" });
    const post2 = await app.request("/api", { method: "POST" });
    const postData1 = await post1.json();
    const postData2 = await post2.json();

    expect(postData1.count).toBe(1);
    expect(postData2.count).toBe(1); // Same count = cached
    expect(postCount).toBe(1);

    // PUT requests should be cached with bypass
    const put1 = await app.request("/api", { method: "PUT" });
    const put2 = await app.request("/api", { method: "PUT" });
    const putData1 = await put1.json();
    const putData2 = await put2.json();

    expect(putData1.count).toBe(1);
    expect(putData2.count).toBe(1); // Same count = cached
    expect(putCount).toBe(1);

    // DELETE requests should be cached with bypass
    const delete1 = await app.request("/api", { method: "DELETE" });
    const delete2 = await app.request("/api", { method: "DELETE" });
    const deleteData1 = await delete1.json();
    const deleteData2 = await delete2.json();

    expect(deleteData1.count).toBe(1);
    expect(deleteData2.count).toBe(1); // Same count = cached
    expect(deleteCount).toBe(1);
  });

  it("should still cache GET requests when bypass is enabled", async () => {
    let callCount = 0;

    app.use(
      "*",
      universalCache({
        cacheName: "bypass-get-cache",
        storage,
        bypassMethodCheck: true,
      }),
    );

    app.get("/api", (c) => {
      callCount++;
      return c.json({ count: callCount });
    });

    await app.request("/api", { method: "GET" });
    await app.request("/api", { method: "GET" });

    expect(callCount).toBe(1); // Still cached
  });

  it("should not create cache entries for non-GET methods by default", async () => {
    app.use(
      "*",
      universalCache({
        cacheName: "no-entry-cache",
        storage,
      }),
    );

    app.post("/api", (c) => c.json({ ok: true }));
    app.put("/api", (c) => c.json({ ok: true }));
    app.delete("/api", (c) => c.json({ ok: true }));

    await app.request("/api", { method: "POST" });
    await app.request("/api", { method: "PUT" });
    await app.request("/api", { method: "DELETE" });

    const keys = await storage.getKeys();
    expect(keys.length).toBe(0); // No cache entries created
  });

  it("should create cache entries for non-GET methods with bypass", async () => {
    app.use(
      "*",
      universalCache({
        cacheName: "entry-cache",
        storage,
        bypassMethodCheck: true,
      }),
    );

    app.post("/api", (c) => c.json({ ok: true }));

    await app.request("/api", { method: "POST" });

    const keys = await storage.getKeys();
    expect(keys.length).toBeGreaterThan(0); // Cache entry created
  });

  it("should not have cache collisions between different methods on same route", async () => {
    let getCount = 0;
    let postCount = 0;
    let putCount = 0;

    app.use(
      "*",
      universalCache({
        cacheName: "collision-test",
        storage,
        bypassMethodCheck: true,
      }),
    );

    app.get("/api", (c) => {
      getCount++;
      return c.json({ method: "GET", count: getCount });
    });

    app.post("/api", (c) => {
      postCount++;
      return c.json({ method: "POST", count: postCount });
    });

    app.put("/api", (c) => {
      putCount++;
      return c.json({ method: "PUT", count: putCount });
    });

    // Make requests with different methods to same route
    const get1 = await app.request("/api", { method: "GET" });
    const post1 = await app.request("/api", { method: "POST" });
    const put1 = await app.request("/api", { method: "PUT" });

    const getData1 = await get1.json();
    const postData1 = await post1.json();
    const putData1 = await put1.json();

    // Each method should have its own cache entry
    expect(getData1.method).toBe("GET");
    expect(postData1.method).toBe("POST");
    expect(putData1.method).toBe("PUT");

    // Make same requests again - should hit cache
    const get2 = await app.request("/api", { method: "GET" });
    const post2 = await app.request("/api", { method: "POST" });
    const put2 = await app.request("/api", { method: "PUT" });

    const getData2 = await get2.json();
    const postData2 = await post2.json();
    const putData2 = await put2.json();

    // Should return cached responses (same count)
    expect(getData2.count).toBe(1);
    expect(postData2.count).toBe(1);
    expect(putData2.count).toBe(1);

    // Verify each method was called only once
    expect(getCount).toBe(1);
    expect(postCount).toBe(1);
    expect(putCount).toBe(1);

    // Verify separate cache entries exist
    const keys = await storage.getKeys();
    expect(keys.length).toBe(3); // Three separate entries
  });
});
