'use client';
import localforage from 'localforage';

interface CachedData<T> {
  timestamp: number;
  data: T;
}

const TTLs: Record<string, number> = {
  // Reference data: 24 hours
  departments: 24 * 60 * 60 * 1000,
  jobs: 24 * 60 * 60 * 1000,
  governorates: 24 * 60 * 60 * 1000,
  areas: 24 * 60 * 60 * 1000,
  'transaction-types': 24 * 60 * 60 * 1000,
  'work-stages': 24 * 60 * 60 * 1000,

  // Semi-stable data: 1 hour
  chartOfAccounts: 60 * 60 * 1000,
  vendors: 60 * 60 * 1000,

  // Daily changing data: 30 minutes
  clients: 30 * 60 * 1000,
  employees: 30 * 60 * 1000,
  appointments: 30 * 60 * 1000,
  
  // Transactional Data: 5 minutes
  contracts: 5 * 60 * 1000,
  transactions: 5 * 60 * 1000,
  purchaseOrders: 5 * 60 * 1000,
  quotations: 5 * 60 * 1000,

  // Sensitive Financial Data: 2 minutes
  cashReceipts: 2 * 60 * 1000,
  journalEntries: 2 * 60 * 1000,
  payroll: 2 * 60 * 1000,

  // Temporary Data: 10 minutes
  notifications: 10 * 60 * 1000,
  leaveRequests: 10 * 60 * 1000,
};


const STATS_KEY = 'cache_stats';
let cacheStats = { hits: 0, misses: 0, writes: 0 };

localforage.config({
  name: 'NovaERP-Cache',
  storeName: 'smart_cache',
  description: 'Smart cache for application data',
});

const loadStats = async () => {
    const stats = await localforage.getItem<{ hits: number, misses: number, writes: number }>(STATS_KEY);
    if(stats) cacheStats = stats;
};
loadStats();

const saveStats = () => {
    localforage.setItem(STATS_KEY, cacheStats);
};


class SmartCacheManager {

  /**
   * Implements a stale-while-revalidate caching strategy.
   * - Returns cached data immediately if available and not expired.
   * - If data is "nearly expired" (e.g., past 80% of TTL), it returns the stale data
   *   and triggers a background fetch to update the cache for the next request.
   * - If data is expired or not in cache, it fetches fresh data, caches it, and returns it.
  */
  async get<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const ttl = TTLs[key] || 5 * 60 * 1000; // Default 5 minutes
    const backgroundRefreshThreshold = ttl * 0.8;

    const cached = await localforage.getItem<CachedData<T>>(key);

    if (cached?.data) {
        const age = Date.now() - cached.timestamp;

        if (age < ttl) {
            cacheStats.hits++;
            saveStats();
            console.log(`CACHE HIT: ${key}`);

            if (age > backgroundRefreshThreshold) {
                console.log(`BACKGROUND REFRESH: ${key}`);
                // Fire-and-forget background update
                fetcher().then(freshData => {
                    this.set(key, freshData);
                }).catch(error => {
                    console.error(`Background refresh for ${key} failed:`, error);
                });
            }
            
            return cached.data; // Return stale data immediately
        } else {
            console.log(`CACHE STALE: ${key}`);
        }
    } else {
        console.log(`CACHE MISS: ${key}`);
    }

    cacheStats.misses++;
    saveStats();
    
    // This part runs on a cache miss or if the cache is stale
    const freshData = await fetcher();
    await this.set(key, freshData);
    return freshData;
  }

  async set<T>(key: string, data: T): Promise<void> {
    const item: CachedData<T> = {
      timestamp: Date.now(),
      data,
    };
    await localforage.setItem(key, item);
    cacheStats.writes++;
    saveStats();
  }

  async invalidate(key: string): Promise<void> {
    await localforage.removeItem(key);
    console.log(`CACHE INVALIDATED: ${key}`);
  }

  async invalidateModule(moduleName: string): Promise<void> {
    const keys = await localforage.keys();
    const moduleKeys = keys.filter(k => k.startsWith(moduleName));
    await Promise.all(moduleKeys.map(k => this.invalidate(k)));
    console.log(`CACHE MODULE INVALIDATED: ${moduleName}`);
  }
  
  async getFromStorage<T>(key: string): Promise<T | null> {
    const cached = await localforage.getItem<CachedData<T>>(key);
    return cached?.data || null;
  }
  
  async isValid(key: string): Promise<boolean> {
    const ttl = TTLs[key] || 5 * 60 * 1000;
    const cached = await localforage.getItem<CachedData<any>>(key);
    if (!cached) return false;
    return (Date.now() - cached.timestamp) < ttl;
  }
}

export const SmartCache = new SmartCacheManager();
