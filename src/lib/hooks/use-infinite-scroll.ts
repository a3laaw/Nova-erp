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
import { useFirebase } from '@/firebase/index.tsx';
import { useAuth } from '@/context/auth-context';
import { getTenantPath } from '@/lib/utils';

const PAGE_SIZE = 15;
const EMPTY_CONSTRAINTS: QueryConstraint[] = [];

/**
 * محرك التمرير اللانهائي الموحد (Infinite Scroll):
 * تم تحصينه ليدعم عزل المنشآت آلياً ومنع أخطاء الصلاحيات.
 */
export function useInfiniteScroll<T extends { id?: string }>(
  collectionPath: string | null,
  constraints: QueryConstraint[] = EMPTY_CONSTRAINTS,
  orderByField: string = 'createdAt'
) {
  const { firestore } = useFirebase();
  const { user } = useAuth();
  
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = useRef<HTMLDivElement>(null);
  
  const isFetching = useRef(false);

  // 🛡️ محرك التوجيه الموحد
  const tenantId = user?.currentCompanyId || null;
  const finalPath = collectionPath ? getTenantPath(collectionPath, tenantId) : null;

  const fetchMore = useCallback(() => {
    if (!firestore || !finalPath || isFetching.current || !hasMore || finalPath.startsWith('_WAITING_')) return;

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

    try {
        const q = query(collection(firestore, finalPath), ...queryConstraints);
        getDocs(q).then(snapshot => {
            const newItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
            setItems(prev => [...prev, ...newItems]);
            
            const lastDoc = snapshot.docs[snapshot.docs.length - 1];
            setLastVisible(lastDoc || null);

            if (snapshot.docs.length < PAGE_SIZE) {
                setHasMore(false);
            }
        }).catch(error => {
            console.error(`Infinite Scroll Error [${finalPath}]:`, error.message);
            setHasMore(false);
        }).finally(() => {
            setLoadingMore(false);
            isFetching.current = false;
        });
    } catch (e) {
        setHasMore(false);
        setLoadingMore(false);
        isFetching.current = false;
    }

  }, [firestore, finalPath, constraints, orderByField, lastVisible, hasMore]);
  
  useEffect(() => {
    if (!firestore || !finalPath || finalPath.startsWith('_WAITING_')) {
        if (!collectionPath) setLoading(false);
        return;
    }

    setItems([]);
    setLastVisible(null);
    setHasMore(true);
    setLoading(true);
    isFetching.current = true;

    try {
        const queryConstraints: QueryConstraint[] = [
            ...constraints,
            orderBy(orderByField, 'desc'),
            limit(PAGE_SIZE),
        ];

        const q = query(collection(firestore, finalPath), ...queryConstraints);
        getDocs(q).then(snapshot => {
            const newItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
            setItems(newItems);
            
            const lastDoc = snapshot.docs[snapshot.docs.length - 1];
            setLastVisible(lastDoc || null);

            if (snapshot.docs.length < PAGE_SIZE) {
                setHasMore(false);
            }
        }).catch(error => {
            console.error(`Initial Fetch Error [${finalPath}]:`, error.message);
            setHasMore(false);
        }).finally(() => {
            setLoading(false);
            isFetching.current = false;
        });
    } catch (e) {
        setLoading(false);
        setHasMore(false);
        isFetching.current = false;
    }
    
  }, [finalPath, JSON.stringify(constraints.map(c => c.toString())), orderByField, firestore]);

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
    if (loader) observer.observe(loader);
    return () => { if (loader) observer.unobserve(loader); };
  }, [hasMore, loadingMore, loading, fetchMore]);

  return { items, setItems, loading, loadingMore, hasMore, loaderRef };
}
