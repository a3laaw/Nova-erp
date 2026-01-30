import localforage from 'localforage';
import { collection, getDocs, type Firestore, type Query } from 'firebase/firestore';

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
  'chart-of-accounts': 24 * 60 * 60 * 1000,
  'transaction-types': 24 * 60 * 60 * 1000,
  
  // Main data lists: 1 hour
  'clients-list': 60 * 60 * 1000,
  'employees-list': 60 * 60 * 1000,
  
  // Frequently changing data: 5 minutes
  'contracts-list': 5 * 60 * 1000,
  'transactions-list': 5 * 60 * 1000,
  
  // Sensitive financial data: 2 minutes
  'cash-receipts-list': 2 * 60 * 1000,
  'journal-entries-list': 2 * 60 * 1000,
};

const STATS_KEY = 'cache_stats';
let cacheStats = { hits: 0, misses: 0 };

// Initialize localforage
localforage.config({
  name: 'NovaERP-Cache',
  storeName: 'smart_cache',
  description: 'Smart cache for application data',
});

// Load stats on startup
const loadStats = async () => {
    const stats = await localforage.getItem<{ hits: number, misses: number }>(STATS_KEY);
    if(stats) {
        cacheStats = stats;
    }
}
loadStats();

const saveStats = () => {
    localforage.setItem(STATS_KEY, cacheStats);
}

/**
 * Gets data from cache. If stale or not present, fetches from Firestore.
 */
async function get<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = await localforage.getItem<CachedData<T>>(key);
  const ttl = TTLs[key] || 5 * 60 * 1000; // Default 5 minutes

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
  await set(key, data);
  return data;
}

/**
 * Sets data into the cache with a timestamp.
 */
async function set<T>(key: string, data: T): Promise<void> {
  const item: CachedData<T> = {
    timestamp: Date.now(),
    data,
  };
  await localforage.setItem(key, item);
}

/**
 * Invalidates a specific key in the cache.
 */
async function invalidate(key: string): Promise<void> {
  await localforage.removeItem(key);
  console.log(`CACHE INVALIDATED: ${key}`);
}

/**
 * Clears the entire cache.
 */
async function clear(): Promise<void> {
  await localforage.clear();
  console.log('CACHE CLEARED');
}

/**
 * Gets cache statistics.
 */
function getStats() {
    return cacheStats;
}

// --- Specific Data Fetchers ---

const getCollectionData = async <T>(db: Firestore, collectionName: string): Promise<T[]> => {
    const querySnapshot = await getDocs(collection(db, collectionName));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
}

export const SmartCache = {
  get,
  set,
  invalidate,
  clear,
  getStats,
  
  // Pre-built functions for common data types
  getClientsList: (db: Firestore) => get(
    'clients-list',
    () => getCollectionData(db, 'clients')
  ),
  getEmployeesList: (db: Firestore) => get(
    'employees-list',
    () => getCollectionData(db, 'employees')
  ),
  getChartOfAccounts: (db: Firestore) => get(
    'chart-of-accounts',
    () => getCollectionData(db, 'chartOfAccounts')
  ),
  // Add other getter functions as needed for different collections
};
