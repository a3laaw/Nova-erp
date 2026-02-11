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
const EMPTY_CONSTRAINTS: QueryConstraint[] = [];

export function useInfiniteScroll<T extends { id?: string }>(
  collectionPath: string | null,
  constraints: QueryConstraint[] = EMPTY_CONSTRAINTS,
  orderByField: string = 'createdAt'
) {
  const { firestore } = useFirebase();
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = useRef<HTMLDivElement>(null);
  
  const isFetching = useRef(false);

  const fetchMore = useCallback(() => {
    if (!firestore || !collectionPath || isFetching.current || !hasMore) return;

    isFetching.current = true;
    setLoadingMore(true);
    
    const queryConstraints: QueryConstraint[] = [
      ...constraints,
      orderBy(orderByField, 'desc'),
      limit(PAGE_SIZE),
    ];

    if (lastVisible) {
      queryConstraints.push(startAfter(lastVisible));
    }

    const q = query(collection(firestore, collectionPath), ...queryConstraints);
    getDocs(q).then(snapshot => {
      const newItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
      setItems(prev => [...prev, ...newItems]);
      
      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      setLastVisible(lastDoc || null);

      if (snapshot.docs.length < PAGE_SIZE) {
        setHasMore(false);
      }
    }).catch(error => {
      console.error(`Error fetching from ${collectionPath}:`, error);
    }).finally(() => {
      setLoadingMore(false);
      isFetching.current = false;
    });

  }, [firestore, collectionPath, JSON.stringify(constraints), orderByField, lastVisible, hasMore]);
  
  // Effect for resetting and initial fetch
  useEffect(() => {
    if (!firestore || !collectionPath) return;

    setItems([]);
    setLastVisible(null);
    setHasMore(true);
    setLoading(true);
    isFetching.current = true;

    const queryConstraints: QueryConstraint[] = [
      ...constraints,
      orderBy(orderByField, 'desc'),
      limit(PAGE_SIZE),
    ];

    const q = query(collection(firestore, collectionPath), ...queryConstraints);
    getDocs(q).then(snapshot => {
        const newItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
        setItems(newItems);
        
        const lastDoc = snapshot.docs[snapshot.docs.length - 1];
        setLastVisible(lastDoc || null);

        if (snapshot.docs.length < PAGE_SIZE) {
            setHasMore(false);
        }
    }).catch(error => {
        console.error(`Error fetching from ${collectionPath}:`, error);
    }).finally(() => {
        setLoading(false);
        isFetching.current = false;
    });
    
  }, [collectionPath, JSON.stringify(constraints), orderByField, firestore]);

  // Intersection Observer Effect
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
            fetchMore();
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
  }, [hasMore, loadingMore, loading, fetchMore]);

  return { items, setItems, loading, loadingMore, hasMore, loaderRef };
}
