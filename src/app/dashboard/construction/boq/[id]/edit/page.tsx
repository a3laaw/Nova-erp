'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirebase, useDocument } from '@/firebase';
import { collection, doc, updateDoc, writeBatch, serverTimestamp, getDocs, query, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/auth-context';
import type { Boq, BoqItem } from '@/lib/types';
import { BoqForm, boqFormSchema, type BoqFormValues } from '@/components/construction/boq/boq-form';
import { cleanFirestoreData } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export default function EditBoqPage() {
    const router = useRouter();
    const params = useParams();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const { firestore } = useFirebase();
    const { toast } = useToast();
    
    const [initialData, setInitialData] = useState<Partial<BoqFormValues> | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [initialItems, setInitialItems] = useState<BoqItem[]>([]);

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
                setInitialData({
                    name: boqData.name,
                    clientName: boqData.clientName,
                    status: boqData.status,
                    items: boqItems.map(item => ({...item, id: item.id!})),
                });
            } catch(e) {
                console.error(e);
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تحميل بيانات جدول الكميات.' });
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [firestore, id, router, toast]);

    const handleSave = async (data: BoqFormValues) => {
        if (!firestore || !id) return;
        setIsSaving(true);
        try {
            const batch = writeBatch(firestore);
            const boqRef = doc(firestore, 'boqs', id);
            
            const totalValue = data.items.reduce((sum, item) => {
                if (item.isHeader) return sum;
                const isLumpSum = item.unit === 'مقطوعية';
                const quantity = isLumpSum ? 1 : (item.quantity || 0);
                return sum + (quantity * (item.sellingUnitPrice || 0));
            }, 0);

            batch.update(boqRef, {
                name: data.name,
                clientName: data.clientName,
                status: data.status,
                totalValue,
                itemCount: data.items.length,
            });

            const originalItemIds = new Set(initialItems.map(item => item.id));
            const currentItemIds = new Set(data.items.map(item => item.id));

            for (const originalItem of initialItems) {
                if (!currentItemIds.has(originalItem.id!)) {
                    batch.delete(doc(firestore, `boqs/${id}/items`, originalItem.id!));
                }
            }

            for (const item of data.items) {
                const itemRef = originalItemIds.has(item.id)
                    ? doc(firestore, `boqs/${id}/items`, item.id)
                    : doc(collection(firestore, `boqs/${id}/items`));
                
                const { id: clientSideId, ...itemData } = item;
                batch.set(itemRef, cleanFirestoreData(itemData), { merge: true });
            }

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
            <Card className="max-w-4xl mx-auto" dir="rtl">
                <CardHeader>
                    <Skeleton className="h-8 w-48" />
                </CardHeader>
                <CardContent>
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <BoqForm 
            initialData={initialData}
            onSave={handleSave}
            onClose={() => router.push(`/dashboard/construction/boq/${id}`)}
            isSaving={isSaving}
        />
    );
}
