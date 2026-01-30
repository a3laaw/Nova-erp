import localforage from 'localforage';
import { collection, getDocs, query, onSnapshot, type Firestore, type QueryConstraint, type DocumentData, type Query } from 'firebase/firestore';
import { useState, useEffect, useCallback } from 'react';
import { searchClients, searchEmployees, searchAccounts } from './fuse-search';
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
  'chart-of-accounts': 60 * 60 * 1000, // 1 hour for semi-stable
  'transaction-types': 24 * 60 * 60 * 1000,
  
  // Main data lists: 30 minutes (as per 'daily changing')
  'clients-list': 30 * 60 * 1000,
  'employees-list': 30 * 60 * 1000,
  'appointments-list': 30 * 60 * 1000,

  // Transactional Data: 5 minutes
  'contracts-list': 5 * 60 * 1000,
  'transactions-list': 5 * 60 * 1000,

  // Sensitive Financial Data: 2 minutes
  'cash-receipts-list': 2 * 60 * 1000,
  'journal-entries-list': 2 * 60 * 1000,

  // Temporary Data: 10 minutes
  'notifications-list': 10 * 60 * 1000,
  'leave-requests-list': 10 * 60 * 1000,
};


const STATS_KEY = 'cache_stats';
let cacheStats = { hits: 0, misses: 0 };

localforage.config({
  name: 'NovaERP-Cache',
  storeName: 'smart_cache',
  description: 'Smart cache for application data',
});

const loadStats = async () => {
    const stats = await localforage.getItem<{ hits: number, misses: number }>(STATS_KEY);
    if(stats) cacheStats = stats;
};
loadStats();

const saveStats = () => {
    localforage.setItem(STATS_KEY, cacheStats);
};


class SmartCacheManager {

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
  }

  async invalidate(key: string): Promise<void> {
    await localforage.removeItem(key);
    console.log(`CACHE INVALIDATED: ${key}`);
  }

  async invalidateModule(moduleName: string): Promise<void> {
    const keys = await localforage.keys();
    const moduleKeys = keys.filter(k => k.startsWith(`${moduleName}:`));
    await Promise.all(moduleKeys.map(k => this.invalidate(k)));
    console.log(`CACHE MODULE INVALIDATED: ${moduleName}`);
  }

  search<T>(items: T[], query: string, keys: (keyof T | string)[], threshold: number = 0.3): T[] {
    if (!query) return items;
    const fuse = new Fuse(items, { keys: keys as any, threshold, includeScore: true });
    return fuse.search(query).map(result => result.item);
  }

  // Pre-built fetchers
  getCollectionData = async <T>(db: Firestore, collectionName: string, key: string): Promise<T[]> => {
    return this.get(key, async () => {
        const querySnapshot = await getDocs(collection(db, collectionName));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
    });
  }
}

export const SmartCache = new SmartCacheManager();

// React Hook for real-time data subscription
export function useSubscription<T extends { id?: string }>(
  firestore: Firestore | null, 
  collectionPath: string, 
  constraints: QueryConstraint[] = []
): { data: T[], loading: boolean, error: Error | null } {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const constraintsJSON = JSON.stringify(constraints);

    useEffect(() => {
        if (!firestore) {
          setLoading(false);
          return;
        }

        const q = query(collection(firestore, collectionPath), ...constraints);
        
        const unsubscribe = onSnapshot(q, 
            (snapshot) => {
                const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
                setData(results);
                setLoading(false);
            },
            (err) => {
                console.error(`Error subscribing to ${collectionPath}:`, err);
                setError(err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [firestore, collectionPath, constraintsJSON]);

    return { data, loading, error };
}
