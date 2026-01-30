'use client';

import { useMemo } from 'react';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { where } from 'firebase/firestore';
import { useSubscription } from '@/hooks/use-subscription';
import type { Notification } from '@/lib/types';

/**
 * A custom hook to fetch and manage notifications for the current user in real-time.
 * It uses a subscription to Firestore for live updates.
 */
export function useNotifications() {
    const { firestore } = useFirebase();
    const { user } = useAuth();

    // Memoize the query constraints array to prevent re-running the subscription unnecessarily.
    const queryConstraints = useMemo(() => {
        if (!user?.id) return null;
        // Query for notifications for the current user. Sorting is handled client-side.
        return [
            where('userId', '==', user.id)
        ];
    }, [user?.id]);
    
    // useSubscription handles caching, real-time updates, loading, and error states.
    // The query will not run if constraints are null (i.e., no user).
    const { data, loading, error } = useSubscription<Notification>(
        firestore, 
        queryConstraints ? 'notifications' : '', 
        queryConstraints || []
    );
    
    // Client-side sorting to avoid composite index
    const sortedNotifications = useMemo(() => {
        if (!data) return [];
        return [...data].sort((a, b) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime();
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime();
            return timeB - timeA; // Sort descending
        });
    }, [data]);
    
    return { notifications: sortedNotifications, loading, error };
}
