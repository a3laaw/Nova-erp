'use client';

import { useMemo } from 'react';
import { useFirebase, useCollection, useAuth } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Notification } from '@/lib/types';

/**
 * A custom hook to fetch and manage notifications for the current user.
 * It handles fetching, loading states, and sorting by creation date.
 */
export function useNotifications() {
    const { firestore } = useFirebase();
    const { user } = useAuth();

    // Memoize the Firestore query to prevent re-running on every render
    const notificationsQuery = useMemo(() => {
        if (!firestore || !user?.id) return null;
        // Query for notifications for the current user, ordered by creation date
        return query(
            collection(firestore, 'notifications'),
            where('userId', '==', user.id)
        );
    }, [firestore, user?.id]);

    // useCollection is a custom hook that listens to Firestore snapshot changes
    const [snapshot, loading, error] = useCollection(notificationsQuery);

    // Memoize the notifications array to prevent unnecessary re-renders
    const notifications = useMemo(() => {
        if (!snapshot) return [];
        
        // Map snapshot documents to Notification type
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
        
        // Sort notifications client-side to avoid complex Firestore indexes
        // Newest notifications will appear first.
        data.sort((a, b) => {
            const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
            const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
            return timeB - timeA;
        });

        return data;
    }, [snapshot]);
    
    return { notifications, loading, error };
}
