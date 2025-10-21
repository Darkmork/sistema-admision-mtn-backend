/**
 * SimpleCache - In-Memory Cache with TTL Support
 *
 * A lightweight, efficient caching solution for Node.js microservices.
 * Features:
 * - Automatic TTL (Time To Live) expiration
 * - LRU (Least Recently Used) eviction
 * - Cache statistics and monitoring
 * - Pattern-based invalidation
 * - Memory-efficient storage
 *
 * @class SimpleCache
 * @example
 * const cache = new SimpleCache({ defaultTTL: 300000, maxSize: 1000 });
 * cache.set('user:123', userData, 600000); // 10 min TTL
 * const user = cache.get('user:123');
 * cache.invalidatePattern('user:*');
 */

class SimpleCache {
  /**
   * Create a new SimpleCache instance
   *
   * @param {Object} options - Cache configuration options
   * @param {number} [options.defaultTTL=300000] - Default TTL in milliseconds (5 min)
   * @param {number} [options.maxSize=1000] - Maximum number of entries
   * @param {boolean} [options.enableStats=true] - Enable statistics tracking
   */
  constructor(options = {}) {
    this.cache = new Map();
    this.defaultTTL = options.defaultTTL || 300000; // 5 minutes default
    this.maxSize = options.maxSize || 1000;
    this.enableStats = options.enableStats !== false;

    // Statistics
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      expirations: 0
    };

    // Cleanup interval (every minute)
    this.cleanupInterval = setInterval(() => this._cleanup(), 60000);
  }

  /**
   * Get a value from cache
   *
   * @param {string} key - Cache key
   * @returns {*} Cached value or undefined if not found/expired
   * @example
   * const user = cache.get('user:123');
   * if (user) {
   *   console.log('Cache hit!');
   * }
   */
  get(key) {
    const entry = this.cache.get(key);

    if (!entry) {
      if (this.enableStats) this.stats.misses++;
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      if (this.enableStats) {
        this.stats.misses++;
        this.stats.expirations++;
      }
      return undefined;
    }

    // Update access time for LRU
    entry.lastAccessed = Date.now();

    if (this.enableStats) this.stats.hits++;
    return entry.value;
  }

  /**
   * Set a value in cache
   *
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} [ttl] - TTL in milliseconds (uses defaultTTL if not specified)
   * @returns {boolean} True if set successfully
   * @example
   * cache.set('user:123', { id: 123, name: 'John' }, 600000);
   */
  set(key, value, ttl) {
    // Evict if at max size
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this._evictLRU();
    }

    const expiresAt = Date.now() + (ttl || this.defaultTTL);

    this.cache.set(key, {
      value,
      expiresAt,
      lastAccessed: Date.now(),
      createdAt: Date.now()
    });

    if (this.enableStats) this.stats.sets++;
    return true;
  }

  /**
   * Delete a specific key from cache
   *
   * @param {string} key - Cache key to delete
   * @returns {boolean} True if key existed and was deleted
   * @example
   * cache.delete('user:123');
   */
  delete(key) {
    const existed = this.cache.delete(key);
    if (existed && this.enableStats) this.stats.deletes++;
    return existed;
  }

  /**
   * Check if a key exists in cache (and is not expired)
   *
   * @param {string} key - Cache key
   * @returns {boolean} True if key exists and is valid
   * @example
   * if (cache.has('user:123')) {
   *   console.log('User is cached');
   * }
   */
  has(key) {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      if (this.enableStats) this.stats.expirations++;
      return false;
    }

    return true;
  }

  /**
   * Invalidate cache entries matching a pattern
   * Supports wildcards (*) for pattern matching
   *
   * @param {string} pattern - Pattern to match (e.g., 'user:*', '*:123')
   * @returns {number} Number of entries invalidated
   * @example
   * cache.invalidatePattern('user:*'); // Invalidate all user entries
   * cache.invalidatePattern('*:staff'); // Invalidate all staff entries
   */
  invalidatePattern(pattern) {
    let count = 0;
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }

    if (this.enableStats && count > 0) {
      this.stats.deletes += count;
    }

    return count;
  }

  /**
   * Clear all cache entries
   *
   * @returns {number} Number of entries cleared
   * @example
   * const cleared = cache.clear();
   * console.log(`Cleared ${cleared} entries`);
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    if (this.enableStats) this.stats.deletes += size;
    return size;
  }

  /**
   * Get cache statistics
   *
   * @returns {Object} Cache statistics
   * @example
   * const stats = cache.getStats();
   * console.log(`Hit rate: ${stats.hitRate}%`);
   */
  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0
      ? ((this.stats.hits / totalRequests) * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: parseFloat(hitRate),
      totalRequests,
      memoryUsage: this._estimateMemoryUsage()
    };
  }

  /**
   * Reset cache statistics
   *
   * @example
   * cache.resetStats();
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      expirations: 0
    };
  }

  /**
   * Get all cache keys
   *
   * @returns {string[]} Array of cache keys
   * @example
   * const keys = cache.keys();
   * console.log(`Cache contains ${keys.length} keys`);
   */
  keys() {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size
   *
   * @returns {number} Number of entries in cache
   * @example
   * console.log(`Cache size: ${cache.size()}`);
   */
  size() {
    return this.cache.size;
  }

  /**
   * Destroy cache and cleanup resources
   * Call this when shutting down the service
   *
   * @example
   * cache.destroy();
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }

  /**
   * Internal: Clean up expired entries
   * Automatically called every minute
   *
   * @private
   */
  _cleanup() {
    const now = Date.now();
    let expired = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        expired++;
      }
    }

    if (this.enableStats && expired > 0) {
      this.stats.expirations += expired;
    }
  }

  /**
   * Internal: Evict least recently used entry
   * Called when cache reaches maxSize
   *
   * @private
   */
  _evictLRU() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      if (this.enableStats) this.stats.evictions++;
    }
  }

  /**
   * Internal: Estimate memory usage in bytes
   * Rough estimation for monitoring purposes
   *
   * @private
   * @returns {number} Estimated memory usage in bytes
   */
  _estimateMemoryUsage() {
    let bytes = 0;

    for (const [key, entry] of this.cache.entries()) {
      // Key size (string)
      bytes += key.length * 2;

      // Entry metadata (timestamps, etc.)
      bytes += 24; // 3 numbers (8 bytes each)

      // Value size (rough estimate)
      try {
        bytes += JSON.stringify(entry.value).length * 2;
      } catch (e) {
        bytes += 100; // Default estimate for non-serializable values
      }
    }

    return bytes;
  }
}

module.exports = SimpleCache;
