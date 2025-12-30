import { Hono } from 'hono'
import { universalCache } from 'hono-universal-cache';
import { createStorage } from 'unstorage';
import vercelKVDriver from "unstorage/drivers/vercel-kv";

const app = new Hono().basePath('/hono')

// Create Vercel KV storage
const storage = createStorage({
  driver: vercelKVDriver({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  }),
});

// Apply cache middleware
app.use(
  '*',
  universalCache({
    cacheName: 'nextjs-vercel-kv',
    storage,
    ttl: 60,
  })
);

// Cached route - returns current time
app.get('/time', (c) => {
  return c.json({
    message: 'Current server time',
    time: new Date().toISOString(),
    cached: true,
  })
})



export { app }