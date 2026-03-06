'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useFirebase, useDocument } from '@/firebase';
import { collection, doc, updateDoc, writeBatch, serverTimestamp, getDocs, query, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { BoqForm, boqFormSchema, type BoqFormValues } from '@/components/construction/boq/boq-form';
import { cleanFirestoreData } from '@/lib/utils';
import type { Boq, BoqItem } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

export default function EditBoqPage() {
    const router = useRouter();
    const params = useParams();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const { firestore } = useFirebase();
    const { toast } = useToast();
    
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [initialItems, setInitialItems] = useState<BoqItem[]>([]);

    const form = useForm<BoqFormValues>({
        resolver: zodResolver(boqFormSchema),
        defaultValues: { items: [] }
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
                form.reset({
                    name: boqData.name,
                    clientName: boqData.clientName || '',
                    status: boqData.status,
                    items: boqItems.map(item => ({
                        uid: item.id!,
                        description: item.description || '',
                        unit: item.unit || '',
                        quantity: item.quantity ?? 0,
                        sellingUnitPrice: item.sellingUnitPrice ?? 0,
                        parentId: item.parentId ?? null,
                        level: item.level ?? 0,
                        isHeader: item.isHeader ?? false,
                        itemId: item.itemId || '',
                        notes: item.notes || '',
                        itemNumber: item.itemNumber || '',
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
    }, [firestore, id, router, toast, form]);

    const handleSave = async (data: BoqFormValues) => {
        if (!firestore || !id) return;
        setIsSaving(true);
        try {
            const batch = writeBatch(firestore);
            const boqRef = doc(firestore, 'boqs', id);
            
            const totalValue = data.items.reduce((sum, item) => {
                if (item.isHeader) return sum;
                return sum + (item.quantity * item.sellingUnitPrice);
            }, 0);

            await updateDoc(boqRef, {
                name: data.name,
                clientName: data.clientName || null,
                status: data.status,
                totalValue,
                itemCount: data.items.length,
                updatedAt: serverTimestamp(),
            });

            const currentUids = new Set(data.items.map(i => i.uid));
            initialItems.forEach(item => {
                if (!currentUids.has(item.id!)) {
                    batch.delete(doc(firestore, `boqs/${id}/items`, item.id!));
                }
            });

            data.items.forEach((item) => {
                const { uid, ...itemData } = item;
                const itemRef = doc(firestore, `boqs/${id}/items`, uid);
                batch.set(itemRef, cleanFirestoreData(itemData));
            });

            await batch.commit();
            toast({ title: 'نجاح', description: 'تم تحديث جدول الكميات بنجاح.' });
            router.push(`/dashboard/construction/boq/${id}`);

        } catch (error) {
            console.error("Error updating BOQ:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تحديث جدول الكميات.' });
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-lg font-medium animate-pulse">جاري تحميل البيانات...</p>
            </div>
        );
    }

    return (
        <BoqForm 
            onClose={() => router.push(`/dashboard/construction/boq/${id}`)}
            isSaving={isSaving}
            isEditing={true}
            control={form.control}
            register={form.register}
            setValue={form.setValue}
            watch={form.watch}
            errors={form.formState.errors}
            handleSubmit={form.handleSubmit}
            onSubmit={handleSave}
        />
    );
}