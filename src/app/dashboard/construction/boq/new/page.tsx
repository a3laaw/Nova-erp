'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BoqForm, type BoqFormValues } from '@/components/construction/boq/boq-form';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { collection, doc, runTransaction, writeBatch, serverTimestamp, getDocs, query } from 'firebase/firestore';
import { cleanFirestoreData } from '@/lib/utils';

export default function NewBoqPage() {
    const { firestore } = useFirebase();
    const { user: currentUser, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [isSaving, setIsSaving] = useState(false);
    const [initialData, setInitialData] = useState<Partial<BoqFormValues> | null>(null);

    useEffect(() => {
        const copiedDataString = sessionStorage.getItem('copiedBoqData');
        if (copiedDataString) {
            try {
                const copiedData = JSON.parse(copiedDataString);
                setInitialData(copiedData);
                toast({ title: 'تم النسخ', description: 'تم ملء النموذج ببيانات النسخة.' });
            } catch (error) {
                console.error("Failed to parse copied BOQ data:", error);
            } finally {
                sessionStorage.removeItem('copiedBoqData');
            }
        }
    }, [toast]);

    const handleSave = async (data: BoqFormValues) => {
        if (!firestore || !currentUser) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'المستخدم او قاعده البيانات غير متاحه.' });
            return;
        }

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
                // Now, commit the processed items
                const batch = writeBatch(firestore);
                data.items.forEach((item) => {
                    const { uid, id, ...itemData } = item;
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
            initialData={initialData}
            onSave={handleSave}
            onClose={() => router.back()}
            isSaving={isSaving}
        />
    );
}
