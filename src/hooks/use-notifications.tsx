'use client';

import { useMemo } from 'react';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { where, QueryConstraint, orderBy } from 'firebase/firestore'; 
import { useSubscription } from '@/hooks/use-subscription';
import type { Notification } from '@/lib/types';
import { toFirestoreDate } from '@/services/date-converter';

/**
 * خطاف جلب التنبيهات (Sovereign Alerts Hook V91.0): 
 * تم تحصين الفرز الزمني لضمان ظهور التنبيهات الجديدة في القمة آلياً.
 */
export function useNotifications() {
    const { firestore } = useFirebase();
    const { user, loading: authLoading } = useAuth();

    // 🛡️ تصفية التنبيهات حسب معرّف المستخدم الحالي فقط 🛡️
    const queryConstraints = useMemo<QueryConstraint[] | null>(() => {
        if (authLoading || !user?.id) return null;
        return [
            where('userId', '==', user.id),
            orderBy('createdAt', 'desc') 
        ];
    }, [user?.id, authLoading]);
    
    const { data: notifications, loading: notificationsLoading, error } = useSubscription<Notification>(
        firestore, 
        queryConstraints ? 'notifications' : null, 
        queryConstraints || []
    );
    
    // 🛡️ فرز إضافي لضمان ظهور غير المقروء أولاً ثم الأحدث 🛡️
    const sortedNotifications = useMemo(() => {
        if (!notifications) return [];
        return [...notifications].sort((a, b) => {
            if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
            const timeA = toFirestoreDate(a.createdAt)?.getTime() || 0;
            const timeB = toFirestoreDate(b.createdAt)?.getTime() || 0;
            return timeB - timeA;
        });
    }, [notifications]);
    
    const loading = authLoading || (queryConstraints !== null && notificationsLoading);
    
    return { 
        notifications: sortedNotifications, 
        loading, 
        error 
    };
}
