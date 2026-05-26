'use client';

import { 
    collection, 
    addDoc, 
    updateDoc, 
    doc, 
    serverTimestamp, 
    increment, 
    Timestamp,
    writeBatch,
    type Firestore 
} from 'firebase/firestore';
import type { UserProductivityItem, ProductivityStatus } from '@/lib/types';
import { cleanFirestoreData, getTenantPath } from '@/lib/utils';

/**
 * @fileOverview محرك الإنتاجية الشخصية والتشاركية السيادي (Productivity Service V112.0).
 * تفعيل نظام "المصافحة التشاركية" عند إتمام المهام المشتركة لضمان توثيق الطرفين.
 */

export class ProductivityService {
    private db: Firestore;
    private tenantId: string | null;

    constructor(db: Firestore, tenantId: string | null) {
        this.db = db;
        this.tenantId = tenantId;
    }

    private get collectionPath() {
        return getTenantPath('userProductivity', this.tenantId);
    }

    /**
     * إنشاء عنصر إنتاجية جديد (مهمة فردية أو تشاركية)
     */
    async createItem(data: Partial<UserProductivityItem>) {
        const path = this.collectionPath;
        if (!path) throw new Error("CRITICAL_ERROR: Missing tenant scope.");

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
     * إغلاق المهمة مع التوثيق المتبادل (The Shared Handshake)
     */
    async completeTaskWithNote(itemId: string, status: ProductivityStatus, note: string, taskData: UserProductivityItem) {
        const path = this.collectionPath;
        if (!path || !this.tenantId) return;

        const batch = writeBatch(this.db);
        const taskRef = doc(this.db, path, itemId);

        // 1. تحديث المهمة
        batch.update(taskRef, {
            status,
            completionNote: note,
            completedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        // 2. إذا كانت تشاركية ولها مصدر فني، التوثيق في المعاملة
        const isShared = taskData.assignedUserIds && taskData.assignedUserIds.length > 0;
        if (isShared && taskData.sourceId && taskData.sourceModule) {
            const txPath = getTenantPath(`clients/${taskData.clientId}/transactions/${taskData.sourceId}`, this.tenantId);
            if (txPath) {
                const timelineRef = doc(collection(this.db, `${txPath}/timelineEvents`));
                batch.set(timelineRef, {
                    type: 'comment',
                    content: `**[إتمام مهمة عمل تشاركية]**\nأنجز الموظف المسؤول هذه المهمة.\n\n**محضر الإنجاز الموثق:**\n${note}`,
                    userId: taskData.userId,
                    userName: 'المسؤول عن الإنجاز',
                    createdAt: serverTimestamp(),
                    companyId: this.tenantId
                });
            }
        }

        return batch.commit();
    }

    /**
     * رادار التفاعل: زيادة عداد المشاهدات
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
     * حذف عنصر
     */
    async deleteItem(itemId: string) {
        const path = this.collectionPath;
        if (!path) return;
        return deleteDoc(doc(this.db, path, itemId));
    }
}
