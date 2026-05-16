
'use client';

import { 
    collection, 
    addDoc, 
    updateDoc, 
    doc, 
    serverTimestamp, 
    increment, 
    Timestamp,
    type Firestore 
} from 'firebase/firestore';
import type { UserProductivityItem, ProductivityAction, ProductivityStatus } from '@/lib/types';
import { cleanFirestoreData, getTenantPath } from '@/lib/utils';

/**
 * @fileOverview محرك الإنتاجية الشخصية السيادي (Productivity Service).
 * مسؤول عن تحويل كيانات الـ ERP إلى مهام ومفضلات بضغطة زر.
 */

export class ProductivityService {
    private db: Firestore;
    private tenantId: string;

    constructor(db: Firestore, tenantId: string) {
        this.db = db;
        this.tenantId = tenantId;
    }

    private get collectionPath() {
        return getTenantPath('userProductivity', this.tenantId);
    }

    /**
     * إنشاء عنصر إنتاجية جديد (مهمة أو مفضلة)
     */
    async createItem(data: Partial<UserProductivityItem>) {
        const colRef = collection(this.db, this.collectionPath);
        const finalData = {
            ...data,
            viewCounter: 0,
            status: data.entryType === 'task' ? 'pending' : null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            companyId: this.tenantId,
        };
        return addDoc(colRef, cleanFirestoreData(finalData));
    }

    /**
     * تحديث حالة المهمة مع طابع زمني تلقائي عند الإنجاز
     */
    async updateTaskStatus(itemId: string, status: ProductivityStatus) {
        const docRef = doc(this.db, this.collectionPath, itemId);
        const updates: any = {
            status,
            updatedAt: serverTimestamp()
        };

        if (status === 'completed') {
            updates.completedAt = serverTimestamp();
        }

        return updateDoc(docRef, updates);
    }

    /**
     * رادار التفاعل: زيادة عداد المشاهدات وتحديث طابع الزيارة
     */
    async trackInteraction(itemId: string) {
        const docRef = doc(this.db, this.collectionPath, itemId);
        return updateDoc(docRef, {
            viewCounter: increment(1),
            lastViewedAt: serverTimestamp()
        });
    }

    /**
     * حذف عنصر
     */
    async deleteItem(itemId: string) {
        const docRef = doc(this.db, this.collectionPath, itemId);
        return updateDoc(docRef, { status: 'cancelled', updatedAt: serverTimestamp() });
    }
}
