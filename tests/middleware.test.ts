import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { createStorage } from 'unstorage'
import { universalCache } from '../src'

describe('universalCache - Basic Functionality', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
  })

  it('should cache GET request response', async () => {
    let callCount = 0

    app.use(
      '*',
      universalCache({
        cacheName: 'test-cache',
      })
    )

    app.get('/test', (c) => {
      callCount++
      return c.json({ message: 'Hello', count: callCount })
    })

    // First request - should hit handler
    const res1 = await app.request('/test')
    expect(res1.status).toBe(200)
    const data1 = await res1.json()
    expect(data1.count).toBe(1)

    // Second request - should return cached response
    const res2 = await app.request('/test')
    expect(res2.status).toBe(200)
    const data2 = await res2.json()
    expect(data2.count).toBe(1) // Same count = cached

    expect(callCount).toBe(1) // Handler called only once
  })

  it('should use default in-memory storage when not provided', async () => {
    let callCount = 0

    app.use(
      '*',
      universalCache({
        cacheName: 'default-storage',
      })
    )

    app.get('/api', (c) => {
      callCount++
      return c.text('Response')
    })

    await app.request('/api')
    await app.request('/api')

    expect(callCount).toBe(1) // Cached with default storage
  })

  it('should respect custom storage driver', async () => {
    const storage = createStorage()
    let callCount = 0

    app.use(
      '*',
      universalCache({
        cacheName: 'custom-cache',
        storage,
      })
    )

    app.get('/api', (c) => {
      callCount++
      return c.text('Response')
    })

    await app.request('/api')
    await app.request('/api')

    expect(callCount).toBe(1)

    // Verify item exists in storage
    const keys = await storage.getKeys()
    expect(keys.length).toBeGreaterThan(0)
    expect(keys.some((key) => key.includes('custom-cache'))).toBe(true)
  })

  it('should cache different routes separately', async () => {
    const storage = createStorage()

    app.use(
      '*',
      universalCache({
        cacheName: 'multi-route',
        storage,
      })
    )

    app.get('/route1', (c) => c.json({ route: 1 }))
    app.get('/route2', (c) => c.json({ route: 2 }))

    await app.request('/route1')
    await app.request('/route2')

    const keys = await storage.getKeys()
    expect(keys.length).toBe(2)
  })
})

describe('universalCache - Custom Key Generation', () => {
  let app: Hono
  let storage: ReturnType<typeof createStorage>

  beforeEach(() => {
    app = new Hono()
    storage = createStorage()
  })

  it('should use custom key generator', async () => {
    app.use(
      '*',
      universalCache({
        cacheName: 'key-test',
        storage,
        keyGenerator: (c) => {         
          return `custom-${c.req.path}`
        },
      })
    )

    app.get('/path', (c) => c.text('Hello'))

    await app.request('/path?query=123')
    await new Promise(resolve => setTimeout(resolve, 1));
    const keys = await storage.getKeys()
    // In key / gets replaced with :
    const hasCustomKey = keys.some((key) => key.includes('custom-:path'))
    expect(hasCustomKey).toBe(true)
  })

  it('should handle async key generator', async () => {
    app.use(
      '*',
      universalCache({
        cacheName: 'async-key',
        storage,
        keyGenerator: async (c) => {
          // Simulate async operation
          return Promise.resolve(`async-${c.req.path}`)
        },
      })
    )

    app.get('/async', (c) => c.text('Async'))

    await app.request('/async')

    const keys = await storage.getKeys()
    expect(keys.some((key) => key.includes('async-:async'))).toBe(true)
  })

  it('should ignore query params with custom key generator', async () => {
    let callCount = 0

    app.use(
      '*',
      universalCache({
        cacheName: 'ignore-query',
        storage,
        keyGenerator: (c) => {
          const url = new URL(c.req.url)
          return url.pathname // Ignore query params
        },
      })
    )

    app.get('/api', (c) => {
      callCount++
      return c.json({ count: callCount })
    })

    // Different query params, same path
    const res1 = await app.request('/api?v=1')
    const res2 = await app.request('/api?v=2')

    const data1 = await res1.json()
    const data2 = await res2.json()

    expect(data1.count).toBe(1)
    expect(data2.count).toBe(1) // Same response = cached
    expect(callCount).toBe(1)
  })
})

describe('universalCache - Status Code Filtering', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
  })

  it('should only cache configured status codes', async () => {
    let callCount = 0

    app.use(
      '*',
      universalCache({
        cacheName: 'status-cache',
        cacheableStatusCodes: [200],
      })
    )

    app.get('/success', (c) => {
      callCount++
      return c.json({ status: 'ok' })
    })

    app.get('/error', (c) => {
      callCount++
      return c.json({ error: 'Not found' }, 404)
    })

    // Cache 200 response
    await app.request('/success')
    await app.request('/success')
    expect(callCount).toBe(1) // Cached

    // Don't cache 404 response
    await app.request('/error')
    await app.request('/error')
    expect(callCount).toBe(3) // Not cached, both requests hit handler
  })

  it('should cache multiple status codes', async () => {
    let successCount = 0
    let redirectCount = 0

    app.use(
      '*',
      universalCache({
        cacheName: 'multi-status',
        cacheableStatusCodes: [200, 201, 301, 302],
      })
    )

    app.get('/success', (c) => {
      successCount++
      return c.json({ ok: true }, 201)
    })

    app.get('/redirect', (c) => {
      redirectCount++
      return c.redirect('/other', 301)
    })

    await app.request('/success')
    await app.request('/success')
    expect(successCount).toBe(1) // 201 cached

    await app.request('/redirect')
    await app.request('/redirect')
    expect(redirectCount).toBe(1) // 301 cached
  })

  it('should use default cacheable status codes (200 only)', async () => {
    let callCount = 0

    app.use(
      '*',
      universalCache({
        cacheName: 'default-status',
      })
    )

    app.get('/test', (c) => {
      callCount++
      return c.json({}, 201)
    })

    await app.request('/test')
    await app.request('/test')

    expect(callCount).toBe(2) // 201 not in default cacheable codes
  })
})

describe('universalCache - Dynamic Cache Names', () => {
  let app: Hono
  let storage: ReturnType<typeof createStorage>

  beforeEach(() => {
    app = new Hono()
    storage = createStorage()
  })

  it('should use dynamic cache name function', async () => {
    app.use(
      '*',
      universalCache({
        cacheName: (c) => {
          const tenant = c.req.header('X-Tenant-ID') || 'default'
          return `tenant-${tenant}`
        },
        storage,
      })
    )

    app.get('/data', (c) => c.text('Data'))

    await app.request('/data', {
      headers: { 'X-Tenant-ID': 'acme' },
    })

    const keys = await storage.getKeys()
    const hasAcmeKey = keys.some((key) => key.includes('tenant-acme'))
    expect(hasAcmeKey).toBe(true)
  })

  it('should cache separately for different tenants', async () => {
    let acmeCount = 0
    let globexCount = 0

    app.use(
      '*',
      universalCache({
        cacheName: (c) => `tenant-${c.req.header('X-Tenant') || 'default'}`,
        storage,
      })
    )

    app.get('/data', (c) => {
      const tenant = c.req.header('X-Tenant')
      if (tenant === 'acme') acmeCount++
      if (tenant === 'globex') globexCount++
      return c.json({ tenant })
    })

    // Acme tenant
    await app.request('/data', { headers: { 'X-Tenant': 'acme' } })
    await app.request('/data', { headers: { 'X-Tenant': 'acme' } })

    // Globex tenant
    await app.request('/data', { headers: { 'X-Tenant': 'globex' } })
    await app.request('/data', { headers: { 'X-Tenant': 'globex' } })

    // Each tenant cached separately
    expect(acmeCount).toBe(1)
    expect(globexCount).toBe(1)

    const keys = await storage.getKeys()
    expect(keys.length).toBe(2) // Two separate cache entries
  })

  it('should handle async cache name function', async () => {
    app.use(
      '*',
      universalCache({
        cacheName: async (c) => {
          return Promise.resolve(`async-${c.req.path}`)
        },
        storage,
      })
    )

    app.get('/test', (c) => c.text('Test'))

    await app.request('/test')

    const keys = await storage.getKeys()
    // In cache keys / are replaced with :
    expect(keys.some((key) => key.includes('async-:test'))).toBe(true)
  })
})

describe('universalCache - Vary Header Handling', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
  })

  it('should not cache responses with Vary: *', async () => {
    let callCount = 0

    app.use(
      '*',
      universalCache({
        cacheName: 'vary-star-cache',
      })
    )

    app.get('/test', (c) => {
      callCount++
      c.header('Vary', '*')
      return c.text('Response')
    })

    await app.request('/test')
    await app.request('/test')

    expect(callCount).toBe(2) // Not cached due to Vary: *
  })

  it('should cache responses with regular Vary headers', async () => {
    let callCount = 0

    app.use(
      '*',
      universalCache({
        cacheName: 'vary-cache',
      })
    )

    app.get('/test', (c) => {
      callCount++
      c.header('Vary', 'Accept-Encoding')
      return c.text('Response')
    })

    await app.request('/test')
    await app.request('/test')

    expect(callCount).toBe(1) // Cached normally
  })
})

describe('universalCache - Response Types', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
  })

  it('should cache JSON responses', async () => {
    let callCount = 0

    app.use('*', universalCache({ cacheName: 'json-cache' }))

    app.get('/json', (c) => {
      callCount++
      return c.json({ message: 'Hello', timestamp: Date.now() })
    })

    const res1 = await app.request('/json')
    const res2 = await app.request('/json')

    const data1 = await res1.json()
    const data2 = await res2.json()

    expect(data1).toEqual(data2) // Exact same cached response
    expect(callCount).toBe(1)
  })

  it('should cache text responses', async () => {
    let callCount = 0

    app.use('*', universalCache({ cacheName: 'text-cache' }))

    app.get('/text', (c) => {
      callCount++
      return c.text('Plain text response')
    })

    const res1 = await app.request('/text')
    const res2 = await app.request('/text')

    const text1 = await res1.text()
    const text2 = await res2.text()

    expect(text1).toBe('Plain text response')
    expect(text2).toBe('Plain text response')
    expect(callCount).toBe(1)
  })

  it('should cache HTML responses', async () => {
    let callCount = 0

    app.use('*', universalCache({ cacheName: 'html-cache' }))

    app.get('/html', (c) => {
      callCount++
      return c.html('<h1>Hello World</h1>')
    })

    const res1 = await app.request('/html')
    const res2 = await app.request('/html')

    const html1 = await res1.text()
    const html2 = await res2.text()

    expect(html1).toBe('<h1>Hello World</h1>')
    expect(html2).toBe('<h1>Hello World</h1>')
    expect(callCount).toBe(1)
  })

  it('should preserve response headers', async () => {
    app.use('*', universalCache({ cacheName: 'headers-cache' }))

    app.get('/headers', (c) => {
      c.header('X-Custom-Header', 'custom-value')
      c.header('Content-Type', 'application/json')
      return c.json({ data: 'test' })
    })

    const res1 = await app.request('/headers')
    const res2 = await app.request('/headers')

    expect(res2.headers.get('X-Custom-Header')).toBe('custom-value')
    expect(res2.headers.get('Content-Type')).toContain('application/json')
  })

  it('should preserve response status', async () => {
    app.use(
      '*',
      universalCache({
        cacheName: 'status-cache',
        cacheableStatusCodes: [201],
      })
    )

    app.get('/created', (c) => {
      return c.json({ created: true }, 201)
    })

    const res1 = await app.request('/created')
    const res2 = await app.request('/created')

    expect(res1.status).toBe(201)
    expect(res2.status).toBe(201)
  })
})

