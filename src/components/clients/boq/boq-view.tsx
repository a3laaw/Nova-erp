'use client';

import { useState, useMemo } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { BoqItem } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { BoqItemForm } from './boq-item-form';
import { BoqDataTable } from './boq-data-table';
import { getBoqColumns } from './boq-columns';

interface BoqViewProps {
  transactionId: string;
}

export function BoqView({ transactionId }: BoqViewProps) {
    const { firestore } = useFirebase();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<BoqItem | null>(null);

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

    const handleAddItem = () => {
        setEditingItem(null);
        setIsFormOpen(true);
    };

    const handleEditItem = (item: BoqItem) => {
        setEditingItem(item);
        setIsFormOpen(true);
    };

    const columns = useMemo(() => getBoqColumns({ onEdit: handleEditItem, onDelete: () => {} }), []);

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
                />
            )}
        </>
    );
}
