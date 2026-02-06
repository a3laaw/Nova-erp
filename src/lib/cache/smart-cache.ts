'use client';

import { getFirebaseServices } from '@/firebase/init';
import {
  collection,
  query,
  onSnapshot,
  doc,
  type DocumentData,
  type QueryConstraint,
  type Firestore,
} from 'firebase/firestore';
import Fuse from 'fuse.js';
import localforage from 'localforage';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// FIXED: Added a safe replacer for JSON.stringify to handle Firestore Timestamps.
// This prevents serialization errors when caching data that contains date objects.
function safeJsonReplacer(key: string, value: any) {
    if (value && typeof value === 'object' && typeof value.toDate === 'function') {
        // This is a Firestore Timestamp object. Convert it to a serializable ISO string.
        return value.toDate().toISOString();
    }
    // For all other values, return them as is.
    return value;
}

class SmartCache {
  async getFromStorage<T>(key: string): Promise<CacheEntry<T> | null> {
    try {
      const cached = await localforage.getItem<CacheEntry<T>>(key);
      return cached;
    } catch (error) {
      console.error('Error reading from cache:', error);
      return null;
    }
  }

  async set<T>(key: string, data: T, ttl: number = 30 * 60 * 1000): Promise<void> {
    try {
      const entry: CacheEntry<T> = { data, timestamp: Date.now(), ttl };
      // IMPROVED: Use the safe replacer before setting data to localforage.
      const plainData = JSON.parse(JSON.stringify(entry, safeJsonReplacer));
      await localforage.setItem(key, plainData);
    } catch (error) {
      console.error('Error saving to cache:', error);
    }
  }

  async invalidate(key: string): Promise<void> {
    try {
      await localforage.removeItem(key);
    } catch (error) {
      console.error('Error invalidating cache:', error);
    }
  }

  search<T>(items: T[], query: string, keys: (keyof T | string)[], threshold: number = 0.3): T[] {
    if (!query.trim()) return items;
    const fuse = new Fuse(items, {
      keys: keys as string[],
      threshold,
      includeScore: true,
      minMatchCharLength: 2,
      ignoreLocation: true,
    });
    return fuse.search(query).map(r => r.item);
  }

  subscribe<T extends DocumentData>(
    firestore: Firestore,
    collectionPath: string,
    onUpdate: (data: T[]) => void,
    onError: (error: Error) => void,
    queryConstraints?: QueryConstraint[]
  ): () => void {
    const db = firestore;
    if (!db) {
      onError(new Error("Firestore instance provided to subscribe is not valid."));
      return () => {};
    }

    const q = queryConstraints?.length
      ? query(collection(db, collectionPath), ...queryConstraints)
      : collection(db, collectionPath);

    return onSnapshot(q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => {
            // FIXED: Use the safe replacer here as well to ensure data passed to `onUpdate` is clean.
            const plainData = JSON.parse(JSON.stringify(doc.data(), safeJsonReplacer));
            return { id: doc.id, ...plainData } as T;
        });
        onUpdate(data);
      },
      (err) => {
        console.error(`Real-time listener error for ${collectionPath}:`, err);
        onError(err);
      }
    );
  }

  subscribeDoc<T extends DocumentData>(
    firestore: Firestore,
    docPath: string,
    onUpdate: (data: T | null) => void,
    onError: (error: Error) => void,
  ): () => void {
    const db = firestore;
    if (!db) {
      onError(new Error("Firestore instance provided to subscribeDoc is not valid."));
      return () => {};
    }

    return onSnapshot(doc(db, docPath),
      (snapshot) => {
        if(snapshot.exists()) {
            // FIXED: Use the safe replacer for single documents.
            const plainData = JSON.parse(JSON.stringify(snapshot.data(), safeJsonReplacer));
            const data = { id: snapshot.id, ...plainData } as T;
            onUpdate(data);
        } else {
            onUpdate(null);
        }
      },
      (err) => {
        console.error(`Real-time listener error for doc ${docPath}:`, err);
        onError(err);
      }
    );
  }

  async get<T>(key: string, fetchFn: () => Promise<T>, ttl: number): Promise<T> {
    const cached = await this.getFromStorage<T>(key);
    const now = Date.now();
    if (cached && now - cached.timestamp < cached.ttl) {
      return cached.data;
    }

    const freshData = await fetchFn();
    // FIXED: Use the safe replacer before caching the fetched data.
    const plainData = JSON.parse(JSON.stringify(freshData, safeJsonReplacer));
    await this.set(key, plainData, ttl);
    return plainData;
  }
}

export const cache = new SmartCache();
