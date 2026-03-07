'use client';

import { useMemo } from 'react';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { where, QueryConstraint } from 'firebase/firestore'; 
import { useSubscription } from '@/hooks/use-subscription';
import type { Notification } from '@/lib/types';

/**
 * خطاف جلب التنبيهات: تم إزالة orderBy من الاستعلام لتجنب خطأ الفهرس المركب.
 * يتم الترتيب الآن في الواجهة الأمامية.
 */
export function useNotifications() {
    const { firestore } = useFirebase();
    const { user, loading: authLoading } = useAuth();

    const queryConstraints = useMemo<QueryConstraint[] | null>(() => {
        if (authLoading || !user?.id) {
          return null;
        }
        return [
            where('userId', '==', user.id),
        ];
    }, [user?.id, authLoading]);
    
    const { data: notifications, loading: notificationsLoading, error } = useSubscription<Notification>(
        firestore, 
        queryConstraints ? 'notifications' : null, 
        queryConstraints || []
    );
    
    // الترتيب اليدوي لضمان ظهور غير المقروء أولاً ثم الأحدث
    const sortedNotifications = useMemo(() => {
        if (!notifications) return [];
        return [...notifications].sort((a, b) => {
            if (a.isRead !== b.isRead) {
                return a.isRead ? 1 : -1;
            }
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime();
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(a.createdAt).getTime();
            return timeB - timeA;
        });
    }, [notifications]);
    
    const loading = authLoading || (queryConstraints !== null && notificationsLoading);
    
    return { notifications: sortedNotifications, loading, error };
}
