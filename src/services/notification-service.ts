'use client';

import { collection, addDoc, serverTimestamp, query, where, getDocs, type Firestore } from 'firebase/firestore';

interface NotificationData {
    userId: string;
    title: string;
    body: string;
    link: string;
}

/**
 * محرك الإشعارات (Notification Engine):
 * مسؤول عن إرسال التنبيهات اللحظية للمستخدمين لضمان سرعة الاستجابة في سير العمل.
 */
export async function createNotification(db: Firestore, data: NotificationData) {
    if (!db || !data.userId) return;
    try {
        await addDoc(collection(db, 'notifications'), {
            ...data,
            isRead: false,
            createdAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Failed to create notification:", error);
    }
}

/**
 * البحث عن معرّف المستخدم بناءً على الموظف:
 * يُستخدم لتحويل الإسناد المهني (المهندس) إلى تنبيه للنظام (المستخدم).
 */
export async function findUserIdByEmployeeId(db: Firestore, employeeId: string): Promise<string | null> {
    if (!employeeId || !db) return null;
    try {
        const q = query(collection(db, 'users'), where('employeeId', '==', employeeId));
        const snap = await getDocs(q);
        return snap.empty ? null : snap.docs[0].id;
    } catch (error) {
        return null;
    }
}
