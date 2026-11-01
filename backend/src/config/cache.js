const Redis = require("ioredis");

// Dual-mode Cache: Redis with automated In-Memory fallback store
class CacheService {
  constructor() {
    this.memoryStore = new Map();
    this.redisClient = null;
    this.isRedisAvailable = false;

    const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
    try {
      this.redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        retryStrategy: () => null, // Don't hang or spam retries if Redis isn't running locally
        enableOfflineQueue: false,
      });

      this.redisClient.on("connect", () => {
        this.isRedisAvailable = true;
        console.log("⚡ Redis cache connected successfully");
      });

      this.redisClient.on("error", (err) => {
        if (this.isRedisAvailable) {
          console.warn("⚠️ Redis disconnected, falling back to In-Memory cache:", err.message);
        }
        this.isRedisAvailable = false;
      });
    } catch (err) {
      this.isRedisAvailable = false;
      console.log("ℹ️ Using fast In-Memory cache & lock manager (Redis offline)");
    }
  }

  async get(key) {
    if (process.env.NODE_ENV === "production" && !this.isRedisAvailable) throw new Error("Redis is required for production cache and seat locking");
    if (this.isRedisAvailable && this.redisClient) {
      try {
        const val = await this.redisClient.get(key);
        return val ? JSON.parse(val) : null;
      } catch (err) {
        if (process.env.NODE_ENV === "production") throw err;
      }
    }
    const item = this.memoryStore.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.memoryStore.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key, value, ttlSeconds = 300) {
    if (process.env.NODE_ENV === "production" && !this.isRedisAvailable) throw new Error("Redis is required for production cache and seat locking");
    const serialized = JSON.stringify(value);
    if (this.isRedisAvailable && this.redisClient) {
      try {
        await this.redisClient.set(key, serialized, "EX", ttlSeconds);
        return true;
      } catch (err) {
        if (process.env.NODE_ENV === "production") throw err;
      }
    }
    this.memoryStore.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
    return true;
  }

  async setNX(key, value, ttlSeconds = 600) {
    // Atomic Set If Not Exists (Used for 10-minute seat lock)
    if (this.isRedisAvailable && this.redisClient) {
      try {
        const result = await this.redisClient.set(key, JSON.stringify(value), "EX", ttlSeconds, "NX");
        return result === "OK";
      } catch (err) {
        if (process.env.NODE_ENV === "production") throw err;
      }
    }
    if (process.env.NODE_ENV === "production") throw new Error("Redis is required for distributed locks in production");
    const existing = await this.get(key);
    if (existing) return false;
    await this.set(key, value, ttlSeconds);
    return true;
  }

  async increment(key, ttlSeconds = 900) {
    if (this.isRedisAvailable && this.redisClient) {
      const value = await this.redisClient.incr(key);
      if (value === 1) await this.redisClient.expire(key, ttlSeconds);
      return value;
    }
    if (process.env.NODE_ENV === "production") throw new Error("Redis is required for production rate limiting");
    let item = this.memoryStore.get(key);
    if (item?.expiresAt && Date.now() > item.expiresAt) {
      this.memoryStore.delete(key);
      item = null;
    }
    const value = (Number(item?.value) || 0) + 1;
    this.memoryStore.set(key, { value, expiresAt: item?.expiresAt || (ttlSeconds ? Date.now() + ttlSeconds * 1000 : null) });
    return value;
  }

  async del(key) {
    if (this.isRedisAvailable && this.redisClient) {
      try {
        await this.redisClient.del(key);
      } catch (err) {
        if (process.env.NODE_ENV === "production") throw err;
      }
    }
    this.memoryStore.delete(key);
    return true;
  }

  async delIfValue(key, expectedValue) {
    if (this.isRedisAvailable && this.redisClient) {
      const script = "local v=redis.call('get', KEYS[1]); if not v then return 0 end; local d=cjson.decode(v); if d.lockToken == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
      return (await this.redisClient.eval(script, 1, key, JSON.stringify(expectedValue))) === 1;
    }
    if (process.env.NODE_ENV === "production") throw new Error("Redis is required for distributed locks in production");
    const current = await this.get(key);
    if (current?.lockToken !== expectedValue) return false;
    return this.del(key);
  }

  async assertRedisReady() {
    if (!this.redisClient) throw new Error("REDIS_URL is required for production");
    await this.redisClient.ping();
    this.isRedisAvailable = true;
  }
}

const cacheService = new CacheService();
module.exports = cacheService;
