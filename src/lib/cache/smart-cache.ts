import localforage from 'localforage';
import { collection, getDocs, query, onSnapshot, type Firestore, type QueryConstraint, type DocumentData, type Query } from 'firebase/firestore';
import { useState, useEffect, useCallback } from 'react';
import Fuse from 'fuse.js';

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

  // Stale-while-revalidate fetcher
  async get<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const ttl = TTLs[key] || 5 * 60 * 1000;
    const cached = await localforage.getItem<CachedData<T>>(key);

    if (cached && (Date.now() - cached.timestamp < ttl)) {
      cacheStats.hits++;
      saveStats();
      console.log(`CACHE HIT: ${key}`);
      return cached.data;
    }

    console.log(`CACHE MISS: ${key}`);
    cacheStats.misses++;
    saveStats();
    
    const data = await fetcher();
    await this.set(key, data);
    return data;
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

  search<T>(items: T[], query: string, keys: (string | Fuse.FuseOptionKey<T>)[], threshold: number = 0.3): T[] {
    if (!query) return items;
    const fuse = new Fuse(items, { keys: keys as any, threshold, includeScore: true, minMatchCharLength: 2 });
    return fuse.search(query).map(result => result.item);
  }
}

export const SmartCache = new SmartCacheManager();


// The new hook that combines stale-while-revalidate with real-time subscriptions
export function useSubscription<T extends { id?: string }>(
  firestore: Firestore | null, 
  collectionPath: string, 
  constraints: QueryConstraint[] = []
): { data: T[], setData: React.Dispatch<React.SetStateAction<T[]>>, loading: boolean, error: Error | null } {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const cacheKey = `${collectionPath}:${JSON.stringify(constraints)}`;

    useEffect(() => {
        if (!firestore) {
            setLoading(false);
            return;
        }

        let isMounted = true;
        setLoading(true);
        
        // 1. Load stale data from cache first
        localforage.getItem<CachedData<T[]>>(cacheKey).then(cached => {
            if (isMounted && cached?.data) {
                setData(cached.data);
                // We have data to show, so the "initial" load is done in a sense.
                // The real loading state will be set to false by the onSnapshot listener.
                console.log(`CACHE HIT (stale): ${cacheKey}`);
            }
        });

        // 2. Set up real-time listener
        const q = query(collection(firestore, collectionPath), ...constraints);
        
        const unsubscribe = onSnapshot(q, 
            (snapshot) => {
                const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
                if (isMounted) {
                    setData(results); // Update with fresh data
                    setLoading(false); // Fresh data arrived, loading is complete.
                    setError(null);
                    // 3. Update the cache
                    SmartCache.set(cacheKey, results);
                }
            },
            (err) => {
                console.error(`Error subscribing to ${collectionPath}:`, err);
                if (isMounted) {
                    setError(err);
                    setLoading(false);
                }
            }
        );

        return () => {
            isMounted = false;
            unsubscribe();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [firestore, collectionPath, JSON.stringify(constraints)]);

    return { data, setData, loading, error };
}
