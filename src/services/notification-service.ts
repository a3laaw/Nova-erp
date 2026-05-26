'use client';

import { collection, addDoc, serverTimestamp, query, where, getDocs, type Firestore } from 'firebase/firestore';
import { getTenantPath } from '@/lib/utils';

interface NotificationData {
    userId: string;
    title: string;
    body: string;
    link: string;
}

/**
 * محرك الإشعارات السيادي (Notification Engine V92.0):
 * تم تحصينه ليعمل عبر مسار المنشأة المعزول ويضمن وصول التنبيهات للشخص المعني.
 */
export async function createNotification(db: Firestore, data: NotificationData, tenantId?: string | null) {
    if (!db || !data.userId) return;
    try {
        const path = getTenantPath('notifications', tenantId);
        if (!path) return;

        await addDoc(collection(db, path), {
            ...data,
            isRead: false,
            createdAt: serverTimestamp(),
            companyId: tenantId || null
        });
    } catch (error) {
        console.error("Failed to create notification:", error);
    }
}

/**
 * البحث عن معرّف المستخدم بناءً على الموظف:
 * تم تحديثه ليدعم البحث داخل مسار المنشأة المعزول.
 */
export async function findUserIdByEmployeeId(db: Firestore, employeeId: string, tenantId?: string | null): Promise<string | null> {
    if (!employeeId || !db) return null;
    try {
        const path = getTenantPath('users', tenantId);
        if (!path) return null;

        const q = query(collection(db, path), where('employeeId', '==', employeeId));
        const snap = await getDocs(q);
        return snap.empty ? null : snap.docs[0].id;
    } catch (error) {
        return null;
    }
}
