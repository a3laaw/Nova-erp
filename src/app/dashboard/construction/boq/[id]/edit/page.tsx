'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirebase } from '@/firebase';
import { collection, doc, writeBatch, serverTimestamp, getDocs, query, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { BoqForm, boqFormSchema, type BoqFormValues } from '@/components/construction/boq/boq-form';
import { cleanFirestoreData } from '@/lib/utils';
import type { Boq, BoqItem } from '@/lib/types';
import { Loader2 } from 'lucide-react';

export default function EditBoqPage() {
    const router = useRouter();
    const params = useParams();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const { firestore } = useFirebase();
    const { toast } = useToast();
    
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [initialItems, setInitialItems] = useState<BoqItem[]>([]);

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
    });

    useEffect(() => {
        if (!firestore || !id) return;
        const fetchData = async () => {
            setLoading(true);
            try {
                const boqRef = doc(firestore, 'boqs', id);
                const itemsRef = collection(firestore, `boqs/${id}/items`);

                const [boqSnap, itemsSnap] = await Promise.all([
                    getDoc(boqRef),
                    getDocs(query(itemsRef))
                ]);

                if (!boqSnap.exists()) {
                    toast({ variant: 'destructive', title: 'خطأ', description: 'لم يتم العثور على جدول الكميات.' });
                    router.push('/dashboard/construction/boq');
                    return;
                }

                const boqData = boqSnap.data() as Boq;
                const boqItems = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() } as BoqItem));
                
                setInitialItems(boqItems);
                
                // For editing, UID is the document ID
                reset({
                    name: boqData.name,
                    clientName: boqData.clientName || '',
                    status: boqData.status,
                    items: boqItems.map(item => ({
                        ...item,
                        uid: item.id!, // Stable UID from DB ID
                    })),
                });
            } catch(e) {
                console.error(e);
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تحميل بيانات جدول الكميات.' });
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [firestore, id, router, toast, reset]);

    const handleSave = async (data: BoqFormValues) => {
        if (!firestore || !id) return;
        setIsSaving(true);
        try {
            const batch = writeBatch(firestore);
            const boqRef = doc(firestore, 'boqs', id);
            
            const totalValue = data.items.reduce((sum, item) => {
                if (item.isHeader) return sum;
                return sum + ((item.quantity || 0) * (item.sellingUnitPrice || 0));
            }, 0);

            batch.update(boqRef, {
                name: data.name,
                clientName: data.clientName || null,
                status: data.status,
                totalValue,
                itemCount: data.items.length,
                updatedAt: serverTimestamp(),
            });

            // Handle items: UID is the Firestore document ID
            const currentUids = new Set(data.items.map(item => item.uid));

            // 1. Delete removed items
            for (const originalItem of initialItems) {
                if (!currentUids.has(originalItem.id!)) {
                    batch.delete(doc(firestore, `boqs/${id}/items`, originalItem.id!));
                }
            }

            // 2. Update or add items
            for (const item of data.items) {
                const itemRef = doc(firestore, `boqs/${id}/items`, item.uid);
                // Remove client-side UID field before saving to data, but it is our document ID
                const { uid, ...itemData } = item;
                batch.set(itemRef, cleanFirestoreData(itemData), { merge: true });
            }

            await batch.commit();

            toast({ title: 'نجاح', description: 'تم تحديث جدول الكميات بنجاح.' });
            router.push(`/dashboard/construction/boq/${id}`);

        } catch (error) {
            console.error("Error updating BOQ:", error);
            toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: 'فشل تحديث جدول الكميات. تأكد من البيانات وحاول مرة أخرى.' });
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-lg font-medium animate-pulse">جاري تحميل بيانات التعديل...</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit(handleSave)}>
            <BoqForm 
                onClose={() => router.push(`/dashboard/construction/boq/${id}`)}
                isSaving={isSaving}
                isEditing={true}
                control={control}
                register={register}
                setValue={setValue}
                watch={watch}
                errors={errors}
            />
        </form>
    );
}
