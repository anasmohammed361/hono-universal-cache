import { Hono } from "hono";
import { universalCache } from "hono-universal-cache";
import { createStorage } from "unstorage";
import { bunRedisDriver } from "./custom-driver-redis";

const app = new Hono();

// Build Redis URL from environment variables
const redisHost = process.env.REDIS_HOST || "localhost";
const redisPort = process.env.REDIS_PORT || "6379";
const redisPassword = process.env.REDIS_PASSWORD;
const redisDb = process.env.REDIS_DB || "0";

let redisUrl = `redis://${redisHost}:${redisPort}/${redisDb}`;
if (redisPassword) {
  redisUrl = `redis://:${redisPassword}@${redisHost}:${redisPort}/${redisDb}`;
}

// Create Redis storage using custom Bun driver
const storage = createStorage({
  driver: bunRedisDriver({
    url: redisUrl,
  }),
});

// Apply cache middleware globally
app.use(
  "*",
  universalCache({
    cacheName: "bun-redis-example",
    storage,
    ttl: Number(process.env.CACHE_TTL) || 3600,
  })
);

// Example routes
app.get("/", (c) => {
  return c.json({
    message: "Bun + Redis Cache Example",
    timestamp: new Date().toISOString(),
    runtime: "Bun",
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

const port = Number(process.env.PORT) || 3000;

console.log(`Server is running on http://localhost:${port}`);
console.log(
  `Redis cache enabled at ${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || 6379}`
);

export default {
  port,
  fetch: app.fetch,
};
