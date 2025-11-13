/**
 * Simple cache utility using localStorage
 * Stores data with expiration time
 */

interface CacheData<T> {
  value: T;
  expiry: number;
}

export class CacheService {
  private static PREFIX = 'dailyspark_cache_';

  /**
   * Set cache with TTL (time to live in seconds)
   */
  static set<T>(key: string, value: T, ttlSeconds: number = 300): void {
    try {
      const now = Date.now();
      const item: CacheData<T> = {
        value,
        expiry: now + ttlSeconds * 1000,
      };
      localStorage.setItem(this.PREFIX + key, JSON.stringify(item));
    } catch (error) {
      console.warn('Cache set error:', error);
    }
  }

  /**
   * Get cached value if not expired
   */
  static get<T>(key: string): T | null {
    try {
      const itemStr = localStorage.getItem(this.PREFIX + key);
      if (!itemStr) return null;

      const item: CacheData<T> = JSON.parse(itemStr);
      const now = Date.now();

      // Check if expired
      if (now > item.expiry) {
        this.remove(key);
        return null;
      }

      return item.value;
    } catch (error) {
      console.warn('Cache get error:', error);
      return null;
    }
  }

  /**
   * Remove specific cache entry
   */
  static remove(key: string): void {
    try {
      localStorage.removeItem(this.PREFIX + key);
    } catch (error) {
      console.warn('Cache remove error:', error);
    }
  }

  /**
   * Clear all cache
   */
  static clear(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('Cache clear error:', error);
    }
  }

  /**
   * Check if cache exists and is valid
   */
  static has(key: string): boolean {
    return this.get(key) !== null;
  }
}

/**
 * Hook-style wrapper for easier React usage
 */
export function useCache<T>(key: string, ttlSeconds: number = 300) {
  const getCached = (): T | null => CacheService.get<T>(key);
  
  const setCached = (value: T): void => CacheService.set<T>(key, value, ttlSeconds);
  
  const removeCached = (): void => CacheService.remove(key);
  
  const hasCached = (): boolean => CacheService.has(key);

  return { getCached, setCached, removeCached, hasCached };
}

/**
 * Cache keys constants
 */
export const CACHE_KEYS = {
  AI_PROMPT: 'ai_prompt',
  USER_SETTINGS: 'user_settings',
  USER_PROFILE: 'user_profile',
  SOCIAL_QUEUE: 'social_queue',
  POST_HISTORY: 'post_history',
  SOCIAL_ACCOUNTS: 'social_accounts',
  SAVED_TEMPLATES: 'saved_templates',
} as const;

/**
 * Cache TTL (time to live) in seconds
 */
export const CACHE_TTL = {
  SHORT: 60,          // 1 minute
  MEDIUM: 300,        // 5 minutes
  LONG: 900,          // 15 minutes
  VERY_LONG: 3600,    // 1 hour
} as const;
