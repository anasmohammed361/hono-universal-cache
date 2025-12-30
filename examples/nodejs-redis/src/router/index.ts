import { Hono } from "hono";
import { universalCache } from "hono-universal-cache";
import { createStorage } from "unstorage";
import redisDriver from "unstorage/drivers/redis";

const app = new Hono();

// Create Redis storage
const storage = createStorage({
  driver: redisDriver({
    base: "unstorage",
    host: process.env.REDIS_HOST,
    tls: false as any,
    port: Number(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD,
  }),
});

// Apply cache middleware globally
app.use(
  "*",
  universalCache({
    cacheName: "nodejs-redis-example",
    storage,
    ttl: Number(process.env.CACHE_TTL) || 3600,
  })
);

// Example routes
app.get("/", (c) => {
  return c.json({
    message: "Node.js + Redis Cache Example",
    timestamp: new Date().toISOString(),
    endpoints: {
      "/": "This endpoint",
      "/api/time": "Current time (cached for 1 hour)",
      "/api/random": "Random number (cached for 1 hour)",
      "/api/user/:id": "User data (cached for 1 hour)",
    },
  });
});

app.get("/api/time", (c) => {
  return c.json({
    time: new Date().toISOString(),
    cached: true,
    message: "This response is cached for 1 hour",
  });
});

app.get("/api/random", (c) => {
  return c.json({
    random: Math.random(),
    timestamp: new Date().toISOString(),
    message: "This random number is cached for 1 hour",
  });
});

app.get("/api/user/:id", (c) => {
  const id = c.req.param("id");
  return c.json({
    id,
    name: `User ${id}`,
    email: `user${id}@example.com`,
    timestamp: new Date().toISOString(),
    message: "This user data is cached for 1 hour",
  });
});

export { app };