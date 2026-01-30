'use client';

import { useMemo } from 'react';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { where, orderBy } from 'firebase/firestore';
import { useSubscription } from '@/lib/cache/smart-cache';
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
        // Query for notifications for the current user, ordered by creation date descending.
        return [
            where('userId', '==', user.id),
            orderBy('createdAt', 'desc')
        ];
    }, [user?.id]);
    
    // useSubscription handles caching, real-time updates, loading, and error states.
    // The query will not run if constraints are null (i.e., no user).
    const { data: notifications, loading, error } = useSubscription<Notification>(
        firestore, 
        queryConstraints ? 'notifications' : '', 
        queryConstraints || []
    );
    
    // The data from useSubscription is already sorted by the query.
    // No need for additional client-side sorting.
    
    return { notifications, loading, error };
}
