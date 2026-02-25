'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BoqForm, boqFormSchema, type BoqFormValues } from '@/components/construction/boq/boq-form';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { collection, doc, runTransaction, writeBatch, serverTimestamp, getDoc } from 'firebase/firestore';
import { cleanFirestoreData } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

const generateId = () => Math.random().toString(36).substring(2, 9);

export default function NewBoqPage() {
    const { firestore } = useFirebase();
    const { user: currentUser, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [isSaving, setIsSaving] = useState(false);

    const {
        control,
        handleSubmit,
        register,
        watch,
        setValue,
        formState: { errors },
        reset,
    } = useForm<BoqFormValues>({
        resolver: zodResolver(boqFormSchema),
        defaultValues: {
            name: '',
            clientName: '',
            status: 'تقديري',
            items: [
                {
                    uid: generateId(),
                    description: '',
                    unit: 'مقطوعية',
                    quantity: 1,
                    sellingUnitPrice: 0,
                    parentId: null,
                    level: 0,
                    isHeader: false,
                    itemId: '',
                    notes: '',
                },
            ],
        },
    });

    useEffect(() => {
        const copiedDataString = sessionStorage.getItem('copiedBoqData');
        if (copiedDataString) {
            try {
                const copiedData = JSON.parse(copiedDataString);
                // Ensure each item has a UID which will serve as its Firestore ID
                const items = (copiedData.items || []).map((item: any) => ({
                    ...item,
                    uid: item.uid || generateId(),
                }));
                reset({ ...copiedData, items });
                toast({ title: 'تم النسخ', description: 'تم ملء النموذج ببيانات النسخة.' });
            } catch (error) {
                console.error("Failed to parse copied BOQ data:", error);
            } finally {
                sessionStorage.removeItem('copiedBoqData');
            }
        }
    }, [reset, toast]);

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
                    createdBy: currentUser.id,
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
                // Now, commit the items using their UIDs as Firestore IDs
                const batch = writeBatch(firestore);
                data.items.forEach((item) => {
                    const { uid, ...itemData } = item;
                    const itemRef = doc(firestore, `boqs/${newBoqId}/items`, uid);
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

    if (authLoading) {
        return (
            <Card className="max-w-4xl mx-auto" dir="rtl">
                <CardHeader><CardTitle>إنشاء جدول كميات جديد</CardTitle></CardHeader>
                <CardContent>
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <p className="mr-4">جاري تهيئة المحرر...</p>
                    </div>
                </CardContent>
            </Card>
        );
    }
    
    return (
        <form onSubmit={handleSubmit(handleSave)}>
            <BoqForm
                onClose={() => router.back()}
                isSaving={isSaving}
                isEditing={false}
                control={control}
                register={register}
                setValue={setValue}
                watch={watch}
                errors={errors}
            />
        </form>
    );
}
