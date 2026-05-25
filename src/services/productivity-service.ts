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
 * @fileOverview محرك الإنتاجية الشخصية السيادي (Productivity Service V2.0).
 * تم تحصينه بـ "رادار التحقق" لضمان عدم الحفظ في مسارات خاطئة أو ناقصة.
 */

export class ProductivityService {
    private db: Firestore;
    private tenantId: string | null;

    constructor(db: Firestore, tenantId: string | null) {
        this.db = db;
        this.tenantId = tenantId;
    }

    private get collectionPath() {
        // استخدام getTenantPath لضمان العزل التام
        return getTenantPath('userProductivity', this.tenantId);
    }

    /**
     * إنشاء عنصر إنتاجية جديد (مهمة أو مفضلة)
     */
    async createItem(data: Partial<UserProductivityItem>) {
        const path = this.collectionPath;
        if (!path) throw new Error("CRITICAL_ERROR: Missing tenant scope for productivity item.");

        const colRef = collection(this.db, path);
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
        const path = this.collectionPath;
        if (!path) return;

        const docRef = doc(this.db, path, itemId);
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
        const path = this.collectionPath;
        if (!path) return;

        const docRef = doc(this.db, path, itemId);
        return updateDoc(docRef, {
            viewCounter: increment(1),
            lastViewedAt: serverTimestamp()
        });
    }

    /**
     * حذف عنصر (إخفاء منطقي)
     */
    async deleteItem(itemId: string) {
        const path = this.collectionPath;
        if (!path) return;

        const docRef = doc(this.db, path, itemId);
        return updateDoc(docRef, { status: 'cancelled', updatedAt: serverTimestamp() });
    }
}
