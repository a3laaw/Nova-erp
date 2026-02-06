'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  type Firestore,
  query,
  collection,
  orderBy,
  limit,
  startAfter,
  getDocs,
  type DocumentSnapshot,
  type QueryConstraint,
} from 'firebase/firestore';
import { useFirebase } from '@/firebase';

const PAGE_SIZE = 15;

export function useInfiniteScroll<T extends { id?: string }>(
  collectionPath: string | null,
  orderByField: string = 'createdAt',
  orderByDirection: 'asc' | 'desc' = 'desc'
) {
  const { firestore } = useFirebase();
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = useRef<HTMLDivElement>(null);

  const fetchItems = useCallback(async (isLoadMore: boolean) => {
    if (!firestore || !collectionPath || (isLoadMore && !hasMore)) return;

    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setItems([]);
      setLastVisible(null);
      setHasMore(true);
    }

    try {
      const queryConstraints: QueryConstraint[] = [
        orderBy(orderByField, orderByDirection),
        limit(PAGE_SIZE),
      ];

      if (isLoadMore && lastVisible) {
        queryConstraints.push(startAfter(lastVisible));
      }

      const q = query(collection(firestore, collectionPath), ...queryConstraints);
      const snapshot = await getDocs(q);

      const newItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
      
      setItems(prev => isLoadMore ? [...prev, ...newItems] : newItems);
      
      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      setLastVisible(lastDoc || null);

      if (snapshot.docs.length < PAGE_SIZE) {
        setHasMore(false);
      }
    } catch (error) {
      console.error(`Error fetching from ${collectionPath}:`, error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [firestore, collectionPath, hasMore, lastVisible, orderByField, orderByDirection]);

  useEffect(() => {
    if (collectionPath) {
        fetchItems(false);
    }
  }, [collectionPath, orderByField, orderByDirection, fetchItems]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          fetchItems(true);
        }
      },
      { threshold: 1.0 }
    );

    const loader = loaderRef.current;
    if (loader) {
      observer.observe(loader);
    }

    return () => {
      if (loader) {
        observer.unobserve(loader);
      }
    };
  }, [hasMore, loadingMore, loading, fetchItems]);

  return { items, setItems, loading, loadingMore, hasMore, loaderRef };
}
