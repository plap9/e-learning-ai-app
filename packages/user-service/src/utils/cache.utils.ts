import { authConfig } from '../config/auth.config';
import { appLogger as logger } from './logger';

// Cache entry interface
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

// Cache metrics interface
interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  maxSize: number;
  hitRate: number;
}

// Generic LRU Cache implementation
export class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private accessOrder = new Map<string, number>();
  private accessCounter = 0;
  private metrics: CacheMetrics;

  constructor(
    private maxEntries: number = authConfig.CACHE_CONFIG.MAX_ENTRIES,
    private defaultTTL: number = authConfig.CACHE_CONFIG.DEFAULT_TTL
  ) {
    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      maxSize: maxEntries,
      hitRate: 0
    };
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.metrics.misses++;
      this.updateHitRate();
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.defaultTTL) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      this.metrics.size--;
      this.metrics.misses++;
      this.updateHitRate();
      return null;
    }

    // Update access information
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.accessOrder.set(key, ++this.accessCounter);
    
    this.metrics.hits++;
    this.updateHitRate();
    
    return entry.data;
  }

  set(key: string, data: T, ttl?: number): void {
    const currentTTL = ttl || this.defaultTTL;
    
    // If key exists, update it
    if (this.cache.has(key)) {
      const entry = this.cache.get(key)!;
      entry.data = data;
      entry.timestamp = Date.now();
      entry.lastAccessed = Date.now();
      this.accessOrder.set(key, ++this.accessCounter);
      return;
    }

    // Check if we need to evict
    if (this.cache.size >= this.maxEntries) {
      this.evictLRU();
    }

    // Add new entry
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now()
    });
    
    this.accessOrder.set(key, ++this.accessCounter);
    this.metrics.size++;
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.accessOrder.delete(key);
      this.metrics.size--;
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
    this.metrics.size = 0;
    this.metrics.hits = 0;
    this.metrics.misses = 0;
    this.metrics.evictions = 0;
    this.metrics.hitRate = 0;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Check TTL
    if (Date.now() - entry.timestamp > this.defaultTTL) {
      this.delete(key);
      return false;
    }
    
    return true;
  }

  size(): number {
    return this.cache.size;
  }

  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  // Clean expired entries
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.defaultTTL) {
        this.cache.delete(key);
        this.accessOrder.delete(key);
        cleaned++;
      }
    }
    
    this.metrics.size = this.cache.size;
    
    if (cleaned > 0) {
      logger.info('Cache cleanup completed', {
        entriesRemoved: cleaned,
        remainingEntries: this.cache.size
      });
    }
    
    return cleaned;
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;
    
    for (const [key, access] of this.accessOrder.entries()) {
      if (access < oldestAccess) {
        oldestAccess = access;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.accessOrder.delete(oldestKey);
      this.metrics.evictions++;
      this.metrics.size--;
      
      logger.info('Cache entry evicted', {
        key: oldestKey,
        accessCount: oldestAccess,
        reason: 'LRU'
      });
    }
  }

  private updateHitRate(): void {
    const total = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = total > 0 ? this.metrics.hits / total : 0;
  }

  // Get cache statistics
  getStats(): {
    metrics: CacheMetrics;
    entries: Array<{ key: string; accessCount: number; age: number }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      accessCount: entry.accessCount,
      age: Date.now() - entry.timestamp
    }));

    return {
      metrics: this.getMetrics(),
      entries
    };
  }
}

// Health-specific cache implementation
export class HealthCache {
  private static cache = new LRUCache<any>(10, authConfig.HEALTH_CACHE_TTL);
  
  static get(key: string = 'default'): any | null {
    return this.cache.get(key);
  }
  
  static set(data: any, key: string = 'default'): void {
    this.cache.set(key, data);
  }
  
  static clear(): void {
    this.cache.clear();
  }
  
  static getMetrics(): CacheMetrics {
    return this.cache.getMetrics();
  }
  
  static cleanup(): number {
    return this.cache.cleanup();
  }
}

// Generic cache manager
export class CacheManager {
  private static caches = new Map<string, LRUCache<any>>();
  
  static getCache<T>(name: string, maxEntries?: number, ttl?: number): LRUCache<T> {
    if (!this.caches.has(name)) {
      this.caches.set(name, new LRUCache<T>(maxEntries, ttl));
    }
    return this.caches.get(name)!;
  }
  
  static removeCache(name: string): boolean {
    return this.caches.delete(name);
  }
  
  static clearAllCaches(): void {
    this.caches.forEach(cache => cache.clear());
    this.caches.clear();
  }
  
  static getAllMetrics(): Record<string, CacheMetrics> {
    const metrics: Record<string, CacheMetrics> = {};
    this.caches.forEach((cache, name) => {
      metrics[name] = cache.getMetrics();
    });
    return metrics;
  }
  
  static cleanupAllCaches(): Record<string, number> {
    const results: Record<string, number> = {};
    this.caches.forEach((cache, name) => {
      results[name] = cache.cleanup();
    });
    return results;
  }
  
  static getGlobalStats(): {
    totalCaches: number;
    totalEntries: number;
    totalHits: number;
    totalMisses: number;
    averageHitRate: number;
  } {
    let totalEntries = 0;
    let totalHits = 0;
    let totalMisses = 0;
    
    this.caches.forEach(cache => {
      const metrics = cache.getMetrics();
      totalEntries += metrics.size;
      totalHits += metrics.hits;
      totalMisses += metrics.misses;
    });
    
    const averageHitRate = (totalHits + totalMisses) > 0 ? totalHits / (totalHits + totalMisses) : 0;
    
    return {
      totalCaches: this.caches.size,
      totalEntries,
      totalHits,
      totalMisses,
      averageHitRate
    };
  }
}

// Cache cleanup scheduler
export class CacheScheduler {
  private static intervals = new Map<string, NodeJS.Timeout>();
  
  static scheduleCleanup(
    cacheName: string, 
    intervalMs: number = 60000 // 1 minute default
  ): void {
    // Clear existing interval if any
    if (this.intervals.has(cacheName)) {
      clearInterval(this.intervals.get(cacheName)!);
    }
    
    const interval = setInterval(() => {
      const cache = CacheManager.getCache(cacheName);
      const cleaned = cache.cleanup();
      
      if (cleaned > 0) {
        logger.info('Scheduled cache cleanup', {
          cacheName,
          entriesRemoved: cleaned,
          timestamp: new Date().toISOString()
        });
      }
    }, intervalMs);
    
    this.intervals.set(cacheName, interval);
  }
  
  static stopCleanup(cacheName: string): void {
    const interval = this.intervals.get(cacheName);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(cacheName);
    }
  }
  
  static stopAllCleanups(): void {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals.clear();
  }
}

// Export cache instances
export const healthCache = HealthCache;
export const cacheManager = CacheManager;
export const cacheScheduler = CacheScheduler;

export default {
  LRUCache,
  HealthCache,
  CacheManager,
  CacheScheduler,
  healthCache,
  cacheManager,
  cacheScheduler
}; 