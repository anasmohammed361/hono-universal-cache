import { describe, it, expect, beforeEach } from 'vitest'
import { createStorage } from 'unstorage'
import { CacheManager } from '../src/cache'

describe('CacheManager', () => {
  let storage: ReturnType<typeof createStorage>
  let cacheManager: CacheManager

  beforeEach(() => {
    storage = createStorage()
    cacheManager = new CacheManager(storage)
  })

  it('should store and retrieve Response', async () => {
    const response = new Response('Hello World', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })

    await cacheManager.set('test-key', response)
    const retrieved = await cacheManager.get('test-key')

    expect(retrieved).not.toBeNull()
    expect(retrieved?.status).toBe(200)
    expect(await retrieved?.text()).toBe('Hello World')
    expect(retrieved?.headers.get('Content-Type')).toBe('text/plain')
  })

  it('should return null for non-existent key', async () => {
    const retrieved = await cacheManager.get('non-existent')
    expect(retrieved).toBeNull()
  })

  it('should handle JSON responses', async () => {
    const data = { message: 'Hello', count: 42 }
    const response = new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    })

    await cacheManager.set('json-key', response)
    const retrieved = await cacheManager.get('json-key')

    expect(retrieved).not.toBeNull()
    const parsed = await retrieved?.json()
    expect(parsed).toEqual(data)
  })

  it('should check if key exists', async () => {
    const response = new Response('Test')

    expect(await cacheManager.has('exists-key')).toBe(false)

    await cacheManager.set('exists-key', response)

    expect(await cacheManager.has('exists-key')).toBe(true)
  })

  it('should delete cached entry', async () => {
    const response = new Response('Delete me')

    await cacheManager.set('delete-key', response)
    expect(await cacheManager.has('delete-key')).toBe(true)

    await cacheManager.delete('delete-key')
    expect(await cacheManager.has('delete-key')).toBe(false)
  })

  it('should clear all entries', async () => {
    await cacheManager.set('key1', new Response('1'))
    await cacheManager.set('key2', new Response('2'))

    const keysBefore = await cacheManager.keys()
    expect(keysBefore.length).toBe(2)

    await cacheManager.clear()

    const keysAfter = await cacheManager.keys()
    expect(keysAfter.length).toBe(0)
  })

  it('should list all cache keys', async () => {
    await cacheManager.set('key-a', new Response('A'))
    await cacheManager.set('key-b', new Response('B'))
    await cacheManager.set('key-c', new Response('C'))

    const keys = await cacheManager.keys()

    expect(keys).toContain('key-a')
    expect(keys).toContain('key-b')
    expect(keys).toContain('key-c')
  })

  it('should preserve response headers', async () => {
    const response = new Response('Test', {
      headers: {
        'X-Custom': 'value',
        'Content-Type': 'text/plain',
      },
    })

    await cacheManager.set('headers-key', response)
    const retrieved = await cacheManager.get('headers-key')

    expect(retrieved?.headers.get('X-Custom')).toBe('value')
    expect(retrieved?.headers.get('Content-Type')).toBe('text/plain')
  })

  it('should preserve response status and statusText', async () => {
    const response = new Response('Not Found', {
      status: 404,
      statusText: 'Not Found',
    })

    await cacheManager.set('status-key', response)
    const retrieved = await cacheManager.get('status-key')

    expect(retrieved?.status).toBe(404)
    expect(retrieved?.statusText).toBe('Not Found')
  })

  it('should handle empty responses', async () => {
    const response = new Response(null, { status: 204 })

    await cacheManager.set('empty-key', response)
    const retrieved = await cacheManager.get('empty-key')
    console.log(retrieved);
    
    expect(retrieved).not.toBeNull()
    expect(retrieved?.status).toBe(204)
  })
})

describe('CacheManager - TTL Support', () => {
  let storage: ReturnType<typeof createStorage>
  
  beforeEach(() => {
    storage = createStorage()
  })

  it('should respect TTL and expire entries', async () => {
    const cacheWithTTL = new CacheManager(storage, 1) // 1 second TTL

    const response = new Response('Expires soon')
    await cacheWithTTL.set('ttl-key', response)

    // Should exist immediately
    expect(await cacheWithTTL.get('ttl-key')).not.toBeNull()

    // Wait for expiration
    await new Promise((resolve) => setTimeout(resolve, 1100))

    // Should be expired and return null
    const expired = await cacheWithTTL.get('ttl-key')
    expect(expired).toBeNull()
  })

  it('should not expire when no TTL is set', async () => {
    const cacheWithoutTTL = new CacheManager(storage)

    const response = new Response('Never expires')
    await cacheWithoutTTL.set('no-ttl-key', response)

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Should still exist
    const retrieved = await cacheWithoutTTL.get('no-ttl-key')
    expect(retrieved).not.toBeNull()
    expect(await retrieved?.text()).toBe('Never expires')
  })

  it('should remove expired entries on get', async () => {
    const cacheWithTTL = new CacheManager(storage, 1)

    await cacheWithTTL.set('expire-me', new Response('Test'))

    // Wait for expiration
    await new Promise((resolve) => setTimeout(resolve, 1100))

    // Get should remove expired entry
    await cacheWithTTL.get('expire-me')

    // Check key no longer exists
    const keys = await cacheWithTTL.keys()
    expect(keys).not.toContain('expire-me')
  })

  it('should handle has() with expired entries', async () => {
    const cacheWithTTL = new CacheManager(storage, 1)

    await cacheWithTTL.set('check-ttl', new Response('Test'))

    expect(await cacheWithTTL.has('check-ttl')).toBe(true)

    // Wait for expiration
    await new Promise((resolve) => setTimeout(resolve, 1100))

    expect(await cacheWithTTL.has('check-ttl')).toBe(false)
  })
})

describe('CacheManager - Text Serialization', () => {
  let storage: ReturnType<typeof createStorage>
  let cacheManager: CacheManager

  beforeEach(() => {
    storage = createStorage()
    cacheManager = new CacheManager(storage)
  })

  it('should handle large JSON responses', async () => {
    const largeData = {
      items: Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        description: 'A very long description '.repeat(10),
      })),
    }

    const response = new Response(JSON.stringify(largeData), {
      headers: { 'Content-Type': 'application/json' },
    })

    await cacheManager.set('large-json', response)
    const retrieved = await cacheManager.get('large-json')

    expect(retrieved).not.toBeNull()
    const parsed = await retrieved?.json()
    expect(parsed.items.length).toBe(1000)
    expect(parsed).toEqual(largeData)
  })

  it('should handle special characters in text', async () => {
    const specialText = 'Hello 世界 🌍 \n\t Special chars: áéíóú ñ'
    const response = new Response(specialText)

    await cacheManager.set('special-chars', response)
    const retrieved = await cacheManager.get('special-chars')

    expect(await retrieved?.text()).toBe(specialText)
  })

  it('should handle HTML with special characters', async () => {
    const html = '<div>Hello &amp; <strong>World</strong> © 2024</div>'
    const response = new Response(html, {
      headers: { 'Content-Type': 'text/html' },
    })

    await cacheManager.set('html', response)
    const retrieved = await cacheManager.get('html')

    expect(await retrieved?.text()).toBe(html)
  })

  it('should handle XML responses', async () => {
    const xml = '<?xml version="1.0"?><root><item>Test</item></root>'
    const response = new Response(xml, {
      headers: { 'Content-Type': 'application/xml' },
    })

    await cacheManager.set('xml', response)
    const retrieved = await cacheManager.get('xml')

    expect(await retrieved?.text()).toBe(xml)
    expect(retrieved?.headers.get('Content-Type')).toBe('application/xml')
  })
})
