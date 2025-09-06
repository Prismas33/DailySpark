/**
 * Simple rate limiter utility to prevent overwhelming RPC endpoints
 */

interface RateLimiterOptions {
  maxRequests: number;
  windowMs: number;
  minDelay?: number;
}

class RateLimiter {
  private requests: number[] = [];
  private lastRequest: number = 0;
  
  constructor(private options: RateLimiterOptions) {}

  /**
   * Check if we can make a request now, or wait if needed
   */
  async waitForNextRequest(): Promise<void> {
    const now = Date.now();
    const windowStart = now - this.options.windowMs;
    
    // Remove old requests outside the window
    this.requests = this.requests.filter(time => time > windowStart);
    
    // Check if we're under the rate limit
    if (this.requests.length < this.options.maxRequests) {
      // Check minimum delay between requests
      if (this.options.minDelay && this.lastRequest > 0) {
        const timeSinceLastRequest = now - this.lastRequest;
        if (timeSinceLastRequest < this.options.minDelay) {
          const waitTime = this.options.minDelay - timeSinceLastRequest;
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
      
      this.requests.push(Date.now());
      this.lastRequest = Date.now();
      return;
    }
    
    // We're at the rate limit, wait until the oldest request expires
    const oldestRequest = this.requests[0];
    const waitTime = oldestRequest + this.options.windowMs - now + 100; // Add small buffer
    
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    // Recursively try again
    await this.waitForNextRequest();
  }
}

// Create rate limiters for different RPC providers
export const rpcRateLimiters = {
  // Base mainnet.base.org is more restrictive
  base_mainnet: new RateLimiter({
    maxRequests: 10,
    windowMs: 60000, // 1 minute
    minDelay: 200 // 200ms between requests
  }),
  
  // Public nodes are usually more lenient
  public_rpc: new RateLimiter({
    maxRequests: 30,
    windowMs: 60000, // 1 minute
    minDelay: 100 // 100ms between requests
  }),
  
  // Infura has higher limits
  infura: new RateLimiter({
    maxRequests: 100,
    windowMs: 60000, // 1 minute
    minDelay: 50 // 50ms between requests
  })
};

/**
 * Get appropriate rate limiter for a given RPC URL
 */
export function getRateLimiterForUrl(url: string): RateLimiter {
  if (url.includes('infura.io')) {
    return rpcRateLimiters.infura;
  } else if (url.includes('mainnet.base.org')) {
    return rpcRateLimiters.base_mainnet;
  } else {
    return rpcRateLimiters.public_rpc;
  }
}

/**
 * Execute a function with rate limiting for a specific URL
 */
export async function executeWithRateLimit<T>(
  url: string,
  fn: () => Promise<T>
): Promise<T> {
  const rateLimiter = getRateLimiterForUrl(url);
  await rateLimiter.waitForNextRequest();
  return fn();
}
