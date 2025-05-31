import { VADScore } from './vad-model';

// Define the structure for cache entries
interface CacheEntry {
  response: string;
  timestamp: number;
  vadScore: VADScore;
}

// Simple in-memory LRU cache implementation
class ResponseCache {
  private cache: Map<string, CacheEntry>;
  private capacity: number;
  private ttl: number; // Time to live in milliseconds

  constructor(capacity = 1000, ttlMinutes = 60) {
    this.cache = new Map();
    this.capacity = capacity;
    this.ttl = ttlMinutes * 60 * 1000;
  }

  // Get normalized form of input for better cache hits
  private normalizeInput(input: string): string {
    return input
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
  }

  // Generate a hash for the input
  private hashInput(input: string): string {
    return this.normalizeInput(input);
  }

  // Add a response to the cache
  set(input: string, response: string, vadScore: VADScore): void {
    // Clean up expired entries
    this.cleanup();

    // If we're at capacity, remove least recently used item
    if (this.cache.size >= this.capacity) {
      const keys = Array.from(this.cache.keys());
      if (keys.length > 0) {
        this.cache.delete(keys[0]);
      }
    }

    const key = this.hashInput(input);
    this.cache.set(key, {
      response,
      timestamp: Date.now(),
      vadScore
    });
  }

  // Get a response from the cache
  get(input: string): CacheEntry | undefined {
    const key = this.hashInput(input);
    const entry = this.cache.get(key);

    // Check if entry exists and is not expired
    if (entry && Date.now() - entry.timestamp < this.ttl) {
      // Move this entry to the end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, entry);
      return entry;
    }

    return undefined;
  }

  // Find semantically similar responses
  findSimilar(input: string, similarityThreshold = 0.7): CacheEntry | undefined {
    const normalizedInput = this.normalizeInput(input);
    let bestMatch: { score: number; entry: CacheEntry | null } = {
      score: 0,
      entry: null
    };

    // Simple word-based similarity
    const inputWords = normalizedInput.split(' ');
    const inputWordsSet = new Set<string>();
    for (const word of inputWords) {
      inputWordsSet.add(word);
    }

    // Iterate through cache entries
    const entries = Array.from(this.cache.entries());
    
    for (const [key, entry] of entries) {
      // Skip expired entries
      if (Date.now() - entry.timestamp >= this.ttl) continue;

      const keyWords = key.split(' ');
      const keyWordsSet = new Set<string>();
      for (const word of keyWords) {
        keyWordsSet.add(word);
      }
      
      // Calculate Jaccard similarity
      let intersectionSize = 0;
      const inputWordsArray = Array.from(inputWordsSet);
      for (let i = 0; i < inputWordsArray.length; i++) {
        if (keyWordsSet.has(inputWordsArray[i])) {
          intersectionSize++;
        }
      }
      
      const unionSize = inputWordsSet.size + keyWordsSet.size - intersectionSize;
      const similarity = unionSize > 0 ? intersectionSize / unionSize : 0;
      
      if (similarity > bestMatch.score && similarity >= similarityThreshold) {
        bestMatch = { score: similarity, entry };
      }
    }

    return bestMatch.entry || undefined;
  }

  // Remove expired entries
  private cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    
    for (const [key, entry] of entries) {
      if (now - entry.timestamp >= this.ttl) {
        this.cache.delete(key);
      }
    }
  }

  // Clear the cache
  clear(): void {
    this.cache.clear();
  }

  // Get cache size
  get size(): number {
    return this.cache.size;
  }
}

// Export a singleton instance
export const responseCache = new ResponseCache();

// Request rate limiter to prevent abuse
export class RateLimiter {
  private requests: Map<string, number[]>;
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs = 60000, maxRequests = 20) {
    this.requests = new Map();
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  isRateLimited(userId: number | string): boolean {
    const now = Date.now();
    const key = userId.toString();
    
    if (!this.requests.has(key)) {
      this.requests.set(key, [now]);
      return false;
    }

    // Get timestamps for this user and filter out old ones
    const timestamps = this.requests.get(key)!.filter(
      time => now - time < this.windowMs
    );
    
    // Check if user has exceeded rate limit
    if (timestamps.length >= this.maxRequests) {
      return true;
    }
    
    // Update timestamps and return false (not rate limited)
    timestamps.push(now);
    this.requests.set(key, timestamps);
    return false;
  }

  reset(userId: number | string): void {
    this.requests.delete(userId.toString());
  }
}

// Export a singleton instance
export const rateLimiter = new RateLimiter();

// Enhanced request queue for managing API calls during high load
// Supports async callback processing for our hybrid system
export class RequestQueue {
  private queue: Array<{
    callback: () => Promise<string>;
    timestamp: number;
    resolve: (value: string) => void;
    reject: (error: any) => void;
  }>;
  private isProcessing: boolean;
  private processingDelay: number;

  constructor(processingDelayMs = 200) {
    this.queue = [];
    this.isProcessing = false;
    this.processingDelay = processingDelayMs;
  }

  enqueue(callback: () => Promise<string>): Promise<string> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        callback,
        timestamp: Date.now(),
        resolve,
        reject
      });

      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  private async processQueue() {
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const { callback, resolve, reject } = this.queue.shift()!;

      try {
        // Execute the callback which should make the API call and return the result
        const result = await callback();
        resolve(result);
      } catch (error) {
        // If the callback fails, reject the promise
        reject(error);
      }

      // Add delay between processing items to avoid hitting rate limits
      if (this.queue.length > 0) {
        await new Promise(r => setTimeout(r, this.processingDelay));
      }
    }

    this.isProcessing = false;
  }

  get length(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }
}

// Export a singleton instance
export const requestQueue = new RequestQueue();