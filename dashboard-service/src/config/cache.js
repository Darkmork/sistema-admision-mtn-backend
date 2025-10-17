const logger = require('../utils/logger');

/**
 * Simple in-memory cache with TTL support
 * For production, consider using Redis
 */
class SimpleCache {
  constructor() {
    this.cache = new Map();
    this.enabled = process.env.CACHE_ENABLED !== 'false';
  }

  /**
   * Set a value in cache with TTL
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds
   */
  set(key, value, ttl = 300000) {
    if (!this.enabled) return;

    const expiresAt = Date.now() + ttl;
    this.cache.set(key, { value, expiresAt });
    logger.debug(`Cache SET: ${key} (TTL: ${ttl}ms)`);
  }

  /**
   * Get a value from cache
   * @param {string} key - Cache key
   * @returns {*} - Cached value or null if not found/expired
   */
  get(key) {
    if (!this.enabled) return null;

    const cached = this.cache.get(key);
    if (!cached) {
      logger.debug(`Cache MISS: ${key}`);
      return null;
    }

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      logger.debug(`Cache EXPIRED: ${key}`);
      return null;
    }

    logger.debug(`Cache HIT: ${key}`);
    return cached.value;
  }

  /**
   * Delete a value from cache
   * @param {string} key - Cache key
   */
  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      logger.debug(`Cache DELETE: ${key}`);
    }
  }

  /**
   * Clear all cache or keys matching a pattern
   * @param {string} pattern - Optional pattern to match keys
   */
  clear(pattern = null) {
    if (pattern) {
      let count = 0;
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
          count++;
        }
      }
      logger.info(`Cache CLEAR: ${count} keys matching pattern "${pattern}"`);
    } else {
      this.cache.clear();
      logger.info('Cache CLEAR: All keys cleared');
    }
  }

  /**
   * Get cache statistics
   * @returns {object} - Cache stats
   */
  getStats() {
    const now = Date.now();
    let activeKeys = 0;
    let expiredKeys = 0;

    for (const [key, cached] of this.cache.entries()) {
      if (now > cached.expiresAt) {
        expiredKeys++;
      } else {
        activeKeys++;
      }
    }

    return {
      enabled: this.enabled,
      totalKeys: this.cache.size,
      activeKeys,
      expiredKeys,
      memoryUsage: process.memoryUsage().heapUsed
    };
  }
}

// Singleton instance
const cache = new SimpleCache();

module.exports = cache;
