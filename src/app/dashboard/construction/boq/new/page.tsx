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
                // When copying, we assign new UIDs to items but keep the structure
                const items = (copiedData.items || []).map((item: any) => ({
                    ...item,
                    uid: generateId(),
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
                // Calculate hierarchy numbering and levels before saving
                const finalItems: any[] = [];
                const childMap = new Map<string | null, string[]>();
                data.items.forEach(item => {
                    if (!childMap.has(item.parentId)) childMap.set(item.parentId, []);
                    childMap.get(item.parentId)!.push(item.uid);
                });

                const processNode = (parentId: string | null, parentNumber: string, level: number) => {
                    const childrenUids = childMap.get(parentId) || [];
                    childrenUids.forEach((childUid, index) => {
                        const item = data.items.find(i => i.uid === childUid);
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
            <div className="flex flex-col items-center justify-center h-screen gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-lg font-medium animate-pulse">جاري تهيئة المحرر الجديد...</p>
            </div>
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
