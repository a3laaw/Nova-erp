'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { type Firestore, query, collection, orderBy, limit, startAfter, getDocs, type DocumentSnapshot, type QueryConstraint } from 'firebase/firestore';

const PAGE_SIZE = 15;

export function useInfiniteScroll<T>(
    firestore: Firestore | null,
    collectionPath: string | null,
    constraints: QueryConstraint[] = []
) {
    const [items, setItems] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const loaderRef = useRef(null);

    const fetchItems = useCallback(async (loadMore = false) => {
        if (!firestore || !collectionPath || (!hasMore && loadMore)) return;

        if (loadMore) {
            setLoadingMore(true);
        } else {
            setLoading(true);
            setItems([]);
            setLastVisible(null);
            setHasMore(true);
        }

        try {
            const queryConstraints = [
                ...constraints,
                orderBy('createdAt', 'desc'),
                limit(PAGE_SIZE)
            ];

            if (loadMore && lastVisible) {
                queryConstraints.push(startAfter(lastVisible));
            }
            
            const q = query(collection(firestore, collectionPath), ...queryConstraints);
            const snapshot = await getDocs(q);
            
            const newItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));

            setItems(prev => loadMore ? [...prev, ...newItems] : newItems);
            
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
    }, [firestore, collectionPath, JSON.stringify(constraints), lastVisible, hasMore]);
    
    // Initial Fetch
    useEffect(() => {
        if (collectionPath) {
            fetchItems(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [collectionPath]);

    // Intersection Observer
    useEffect(() => {
        const observer = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
                fetchItems(true);
            }
        }, { threshold: 1.0 });

        const loader = loaderRef.current;
        if (loader) {
            observer.observe(loader);
        }
        return () => {
            if (loader) {
                observer.unobserve(loader);
            }
        };
    }, [loaderRef, hasMore, loadingMore, loading, fetchItems]);

    return { items, setItems, loading, loadingMore, hasMore, loaderRef };
}
