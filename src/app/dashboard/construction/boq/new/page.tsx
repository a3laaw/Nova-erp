'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BoqForm, type BoqFormValues } from '@/components/construction/boq/boq-form';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { collection, doc, runTransaction, writeBatch, serverTimestamp } from 'firebase/firestore';
import { cleanFirestoreData } from '@/lib/utils';

export default function NewBoqPage() {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async (data: BoqFormValues) => {
        if (!firestore || !currentUser) return;

        setIsSaving(true);
        try {
            let newBoqId: string | null = null;
            const clientId = searchParams.get('clientId');
            const transactionId = searchParams.get('transactionId');

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
                    return sum + ((item.quantity || 0) * (item.sellingUnitPrice || 0));
                }, 0);

                const boqData = {
                    boqNumber,
                    name: data.name,
                    status: data.status,
                    clientName: data.clientName || null,
                    totalValue,
                    itemCount: data.items.length,
                    createdBy: currentUser.uid,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    clientId: clientId || null,
                    transactionId: transactionId || null,
                };
                transaction.set(boqRef, boqData);
                transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });

                if (clientId && transactionId) {
                    const transactionRef = doc(firestore, `clients/${clientId}/transactions/${transactionId}`);
                    transaction.update(transactionRef, { boqId: newBoqId });
                }
            });

            if (newBoqId) {
                const finalItems: any[] = [];
                const childMap = new Map<string | null, string[]>();

                data.items.forEach((item) => {
                    if (!childMap.has(item.parentId)) childMap.set(item.parentId, []);
                    childMap.get(item.parentId)!.push(item.uid);
                });

                const processNode = (parentId: string | null, parentNumber: string, level: number) => {
                    const childrenUids = childMap.get(parentId) || [];
                    childrenUids.forEach((childUid, index) => {
                        const item = data.items.find((i) => i.uid === childUid);
                        if (item) {
                            const newNumber = parentNumber ? `${parentNumber}.${index + 1}` : `${index + 1}`;
                            finalItems.push({ ...item, itemNumber: newNumber, level });
                            processNode(childUid, newNumber, level + 1);
                        }
                    });
                };
                processNode(null, '', 0);

                const batch = writeBatch(firestore);
                finalItems.forEach((item) => {
                    const { uid, ...itemData } = item;
                    const itemRef = doc(collection(firestore, `boqs/${newBoqId}/items`));
                    batch.set(itemRef, cleanFirestoreData(itemData));
                });
                await batch.commit();
            }

            toast({ title: 'نجاح', description: 'تم إنشاء جدول الكميات بنجاح.' });
            
            if (transactionId && clientId) {
                router.push(`/dashboard/clients/${clientId}/transactions/${transactionId}`);
            } else {
                router.push('/dashboard/construction/boq');
            }

        } catch (error: any) {
            console.error('❌ Save failed:', error);
            toast({
                variant: 'destructive',
                title: 'خطأ في الحفظ',
                description: error?.message || 'حدث خطأ أثناء الحفظ.',
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <BoqForm
            onSave={handleSave}
            onClose={() => router.back()}
            isSaving={isSaving}
        />
    );
}
