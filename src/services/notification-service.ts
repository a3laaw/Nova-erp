'use client';

import { collection, addDoc, serverTimestamp, query, where, getDocs, type Firestore } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';

interface NotificationData {
    userId: string;
    title: string;
    body: string;
    link: string;
}

/**
 * Creates a notification for a specific user.
 */
export async function createNotification(db: Firestore, data: NotificationData) {
    try {
        await addDoc(collection(db, 'notifications'), {
            ...data,
            isRead: false,
            createdAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Failed to create notification:", error);
        // We don't want to throw an error here, as notification failure shouldn't block the main action.
    }
}

/**
 * Finds a user's document ID based on their employee ID.
 * @returns The user's Firestore document ID or null if not found.
 */
export async function findUserIdByEmployeeId(db: Firestore, employeeId: string): Promise<string | null> {
    if (!employeeId) return null;

    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('employeeId', '==', employeeId));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            return querySnapshot.docs[0].id; // Return the Firestore document ID
        }
        return null;
    } catch (error) {
        console.error("Failed to find user by employeeId:", error);
        return null;
    }
}
    