
'use client';

import { useMemo } from 'react';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { where, orderBy, QueryConstraint } from 'firebase/firestore';
import { useSubscription } from '@/hooks/use-subscription';
import type { Notification } from '@/lib/types';

/**
 * A custom hook to fetch and manage notifications for the current user in real-time.
 * It uses a subscription to Firestore for live updates.
 */
export function useNotifications() {
    const { firestore } = useFirebase();
    const { user, loading: authLoading } = useAuth();

    // Memoize the query constraints array to prevent re-running the subscription unnecessarily.
    const queryConstraints = useMemo<QueryConstraint[] | null>(() => {
        if (authLoading || !user?.id) {
          // If auth is loading or there's no user, return null to signify "don't query yet".
          return null;
        }
        // Once we have a user ID, we can create the actual query constraints.
        return [
            where('userId', '==', user.id),
            orderBy('createdAt', 'desc'),
        ];
    }, [user?.id, authLoading]);
    
    // Pass null for collectionPath and constraints if they aren't ready.
    // The useSubscription hook is designed to handle this and will not start a listener.
    const { data: notifications, loading: notificationsLoading, error } = useSubscription<Notification>(
        firestore, 
        queryConstraints ? 'notifications' : null, 
        queryConstraints || []
    );
    
    // Sort notifications on the client-side to add unread items first.
    const sortedNotifications = useMemo(() => {
        if (!notifications) return [];
        return [...notifications].sort((a, b) => {
            if (a.isRead !== b.isRead) {
                return a.isRead ? 1 : -1; // unread first
            }
            // createdAt is already sorted by the query, but we can ensure it here too.
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime();
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(a.createdAt).getTime();
            return timeB - timeA;
        });
    }, [notifications]);
    
    // The final loading state is true if either auth is loading or the notifications subscription is loading.
    const loading = authLoading || (queryConstraints !== null && notificationsLoading);
    
    return { notifications: sortedNotifications, loading, error };
}


