'use client';

import { useState, useMemo } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, orderBy, doc, deleteDoc, updateDoc, getDocs } from 'firebase/firestore';
import type { BoqItem } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2, Trash2 } from 'lucide-react';
import { BoqItemForm } from './boq-item-form';
import { BoqDataTable } from './boq-data-table';
import { getBoqColumns } from './boq-columns';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';

interface BoqViewProps {
  transactionId: string;
}

export function BoqView({ transactionId }: BoqViewProps) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<BoqItem | null>(null);
    const [itemToDelete, setItemToDelete] = useState<BoqItem | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { clientId, txId } = useMemo(() => {
        if (!transactionId) return { clientId: null, txId: null };
        const parts = transactionId.split('/');
        return { clientId: parts[0], txId: parts[1] };
    }, [transactionId]);

    const collectionPath = useMemo(() => {
        if (!clientId || !txId) return null;
        return `clients/${clientId}/transactions/${txId}/boq`;
    }, [clientId, txId]);

    const boqQuery = useMemo(() => [orderBy('itemNumber')], []);

    const { data: boqItems, loading: boqLoading } = useSubscription<BoqItem>(
        firestore, 
        collectionPath, 
        boqQuery
    );

    const updateTransactionSummary = async () => {
      if (!firestore || !clientId || !txId) return;
      try {
        const boqCollectionRef = collection(firestore, `clients/${clientId}/transactions/${txId}/boq`);
        const boqSnapshot = await getDocs(boqCollectionRef);
        const items = boqSnapshot.docs.map(d => d.data() as BoqItem);
        const boqItemCount = items.length;
        const boqTotalValue = items.reduce((sum, item) => sum + ((item.plannedQuantity || 0) * (item.plannedUnitPrice || 0)), 0);
        const transactionRef = doc(firestore, `clients/${clientId}/transactions/${txId}`);
        await updateDoc(transactionRef, { boqItemCount, boqTotalValue });
      } catch (error) {
        console.error("Failed to update transaction summary:", error);
        toast({ variant: "destructive", title: "خطأ", description: "فشل تحديث ملخص جدول الكميات." });
      }
    };
    
    const handleDelete = async () => {
        if (!itemToDelete || !firestore || !collectionPath) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(firestore, collectionPath, itemToDelete.id!));
            await updateTransactionSummary(); // Update summary after deletion
            toast({ title: "نجاح", description: "تم حذف البند." });
        } catch (e) {
            console.error("Error deleting BOQ item:", e);
            toast({ variant: "destructive", title: "خطأ", description: "فشل حذف البند." });
        } finally {
            setIsDeleting(false);
            setItemToDelete(null);
        }
    };


    const handleAddItem = () => {
        setEditingItem(null);
        setIsFormOpen(true);
    };

    const handleEditItem = (item: BoqItem) => {
        setEditingItem(item);
        setIsFormOpen(true);
    };
    
    const handleFormSaveSuccess = () => {
        updateTransactionSummary();
    }

    const columns = useMemo(() => getBoqColumns({ onEdit: handleEditItem, onDelete: setItemToDelete }), []);

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>جدول الكميات (BOQ)</CardTitle>
                        <CardDescription>إدارة بنود وكميات وتكاليف المشروع.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" disabled>استيراد Excel</Button>
                        <Button variant="outline" disabled>تصدير Excel</Button>
                        <Button onClick={handleAddItem}><PlusCircle className="ml-2 h-4"/> إضافة بند</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <BoqDataTable columns={columns} data={boqItems || []} loading={boqLoading} />
                </CardContent>
            </Card>
            {isFormOpen && (
                <BoqItemForm
                    isOpen={isFormOpen}
                    onClose={() => setIsFormOpen(false)}
                    transactionId={transactionId}
                    item={editingItem}
                    onSaveSuccess={handleFormSaveSuccess}
                />
            )}
             <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                        <AlertDialogDescription>
                            هل أنت متأكد من رغبتك في حذف البند "{itemToDelete?.description}"؟
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                             {isDeleting ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : 'نعم، قم بالحذف'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
