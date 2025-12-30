import { RedisClient } from "bun";
import { defineDriver } from "unstorage";

export interface BunRedisOptions {
  /**
   * Redis connection URL
   * @default process.env.REDIS_URL || "redis://localhost:6379"
   */
  url?: string;
}

export const bunRedisDriver = defineDriver<BunRedisOptions>((opts = {}) => {
  const url = opts.url || process.env.REDIS_URL || "redis://localhost:6379";
  let redis: RedisClient;

  const getRedis = () => {
    if (!redis) {
      redis = new RedisClient(url);
    }
    return redis;
  };

  return {
    name: "bun-redis",
    options: opts,

    async hasItem(key) {
      const client = getRedis();
      const exists = await client.exists(key);
      return Boolean(exists);
    },

    async getItem(key) {
      const client = getRedis();
      return await client.get(key);
    },

    async setItem(key, value, opts) {
      const client = getRedis();
      if (opts?.ttl) {
        await client.set(key, value, "EX", opts.ttl);
      } else {
        await client.set(key, value);
      }
    },

    async removeItem(key) {
      const client = getRedis();
      await client.del(key);
    },

    async getKeys(base) {
      const client = getRedis();
      const pattern = base ? `${base}*` : "*";
      return await client.keys(pattern);
    },

    async clear(base) {
      const client = getRedis();
      const pattern = base ? `${base}*` : "*";
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(...keys);
      }
    },

    async dispose() {
      if (redis) {
        redis.close();
      }
    },

    async watch() {
      return () => {};
    },
  };
});
