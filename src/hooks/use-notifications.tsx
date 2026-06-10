'use client';

import { useMemo } from 'react';
// CORRECTED: The hook is now imported from the central provider
import { useFirebase, useSubscription } from '@/firebase/provider'; 
import { useAuth } from '@/context/auth-context';
import { where, QueryConstraint, orderBy } from 'firebase/firestore'; 
import type { Notification } from '@/lib/types';
import { toFirestoreDate } from '@/services/date-converter';

/**
 * خطاف جلب التنبيهات (Sovereign Alerts Hook V91.0): 
 * تم تحصين الفرز الزمني لضمان ظهور التنبيهات الجديدة في القمة آلياً.
 */
export function useNotifications() {
    const { user, loading: authLoading } = useAuth();

    const constraints = useMemo(() => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        return [
            where('createdAt', '>=', toFirestoreDate(sevenDaysAgo)),
            orderBy('createdAt', 'desc')
        ] as QueryConstraint[];

    }, []); // No dependencies, calculates once

    // CORRECTED: No longer passes `firestore` as an argument.
    const { 
        data: notifications, 
        loading: loadingNotifications, 
        error 
    } = useSubscription<Notification>(
        'notifications', 
        constraints,
        true // isGroup query
    );

    const unreadCount = useMemo(() => 
        notifications.filter(n => !n.isRead).length
    , [notifications]);

    return { 
        notifications, 
        loadingNotifications: loadingNotifications || authLoading, 
        unreadCount, 
        error 
    };
}
