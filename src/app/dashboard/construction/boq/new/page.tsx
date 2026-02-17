'use client';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { BoqForm, type BoqFormValues } from '@/components/construction/boq/boq-form';
import { useFirebase, useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, doc, runTransaction, writeBatch, serverTimestamp, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { cleanFirestoreData } from '@/lib/utils';
import type { Boq } from '@/lib/types';


export default function NewBoqPage() {
    const { firestore } = useFirebase();
    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const [isSaving, setIsSaving] = useState(false);
    
    const handleSave = useCallback(async (data: BoqFormValues) => {
        if (!firestore || !user) return;
        setIsSaving(true);
        try {
            let newBoqId: string | null = null;
            await runTransaction(firestore, async (transaction) => {
                const counterRef = doc(firestore, 'counters', 'boqs');
                const counterDoc = await transaction.get(counterRef);
                const currentYear = new Date().getFullYear();
                let nextNumber = 1;
                if (counterDoc.exists()) {
                    const counts = counterDoc.data().counts || {};
                    nextNumber = (counts[currentYear] || 0) + 1;
                }
                const boqNumber = `BOQ-${currentYear}-${String(nextNumber).padStart(4, '0')}`;

                const boqRef = doc(collection(firestore, 'boqs'));
                newBoqId = boqRef.id;
                
                const totalValue = data.items.reduce((sum, item) => {
                    if (item.isHeader) return sum;
                    const isLumpSum = item.unit === 'مقطوعية';
                    const quantity = isLumpSum ? 1 : (item.quantity || 0);
                    return sum + (quantity * (item.sellingUnitPrice || 0));
                }, 0);

                const boqData: Omit<Boq, 'id'> = {
                    boqNumber,
                    name: data.name,
                    status: data.status,
                    clientName: data.clientName,
                    totalValue,
                    itemCount: data.items.length,
                    createdAt: serverTimestamp(),
                };
                transaction.set(boqRef, boqData);
                transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
            });

            if (newBoqId) {
                const itemsBatch = writeBatch(firestore);
                data.items.forEach(item => {
                   const { id, ...itemData } = item; 
                   const itemRef = doc(collection(firestore, `boqs/${newBoqId}/items`));
                   itemsBatch.set(itemRef, cleanFirestoreData(itemData));
                });
                await itemsBatch.commit();
            }

            toast({ title: 'نجاح', description: 'تم إنشاء جدول الكميات بنجاح.' });
            router.push('/dashboard/construction/boq');

        } catch (error) {
            console.error("Error creating BOQ:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل إنشاء جدول الكميات.' });
        } finally {
            setIsSaving(false);
        }
    }, [firestore, user, toast, router]);

    return (
        <BoqForm 
            onSave={handleSave}
            onClose={() => router.back()}
            isSaving={isSaving}
        />
    );
}
