// Performance optimization utilities
import React from "react";

// Cache for API responses
const apiCache = new Map<
  string,
  { data: unknown; timestamp: number; ttl: number }
>();

// Cache TTL in milliseconds
const CACHE_TTL = {
  INVOICES: 60 * 1000, // 1 minute
  CUSTOMERS: 2 * 60 * 1000, // 2 minutes
  DASHBOARD: 30 * 1000, // 30 seconds
};

export interface CacheOptions {
  ttl?: number;
  key: string;
}

/**
 * Get cached data if available and not expired
 */
export function getCachedData<T>(key: string): T | null {
  const cached = apiCache.get(key);
  if (!cached) return null;

  const now = Date.now();
  if (now - cached.timestamp > cached.ttl) {
    apiCache.delete(key);
    return null;
  }

  return cached.data as T;
}

/**
 * Set data in cache
 */
export function setCachedData<T>(key: string, data: T, ttl: number): void {
  apiCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl,
  });
}

/**
 * Clear cache for a specific key or all cache
 */
export function clearCache(key?: string): void {
  if (key) {
    apiCache.delete(key);
  } else {
    apiCache.clear();
  }
}

/**
 * Optimized fetch with caching
 */
export async function cachedFetch<T>(
  url: string,
  options: RequestInit = {},
  cacheOptions: CacheOptions
): Promise<T> {
  const { key, ttl = 60000 } = cacheOptions;

  // Try to get from cache first
  const cached = getCachedData<T>(key);
  if (cached) {
    return cached;
  }

  // Fetch from API
  const response = await fetch(url, {
    ...options,
    headers: {
      "Cache-Control": "max-age=60",
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();

  // Cache the result
  setCachedData(key, data, ttl);

  return data;
}

/**
 * Debounce function to prevent excessive API calls
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function to limit function execution frequency
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Preload critical resources
 */
export function preloadResources() {
  // Preload critical API endpoints
  const criticalEndpoints = ["/api/customers", "/api/invoices?limit=10"];

  criticalEndpoints.forEach((endpoint) => {
    fetch(endpoint, {
      headers: { "Cache-Control": "max-age=60" },
    }).catch(() => {
      // Ignore preload errors
    });
  });
}

/**
 * Performance monitoring
 */
export function measurePerformance(
  name: string,
  fn: () => void | Promise<void>
) {
  const start = performance.now();

  const result = fn();

  if (result instanceof Promise) {
    return result.finally(() => {
      const end = performance.now();
      console.log(`${name} took ${end - start} milliseconds`);
    });
  } else {
    const end = performance.now();
    console.log(`${name} took ${end - start} milliseconds`);
  }
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Optimize images for better performance
 */
export function optimizeImageUrl(url: string): string {
  if (!url) return "";

  // For external images, you might want to use a service like Cloudinary
  // For now, just return the original URL
  return url;
}

/**
 * Lazy load components
 */
export function lazyLoadComponent<T extends React.ComponentType<unknown>>(
  importFunc: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return React.lazy(importFunc);
}

// Export cache TTL constants
export { CACHE_TTL };
