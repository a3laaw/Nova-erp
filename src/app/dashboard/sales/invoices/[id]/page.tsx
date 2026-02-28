
'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { InventoryAdjustment, Client } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Printer, ArrowRight, FileText } from 'lucide-react';
import { SalesInvoiceView } from '@/components/sales/sales-invoice-view';

export default function SalesInvoicePage() {
    const params = useParams();
    const router = useRouter();
    const { firestore } = useFirebase();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    // الفاتورة هي في الأصل إذن صرف بضاعة مباعة
    const issueRef = useMemo(() => (firestore && id ? doc(firestore, 'inventoryAdjustments', id) : null), [firestore, id]);
    const { data: issue, loading: issueLoading } = useDocument<InventoryAdjustment>(firestore, issueRef?.path || null);

    const clientRef = useMemo(() => (firestore && issue?.clientId ? doc(firestore, 'clients', issue.clientId) : null), [firestore, issue?.clientId]);
    const { data: client, loading: clientLoading } = useDocument<Client>(firestore, clientRef?.path || null);

    const handlePrint = () => window.print();

    if (issueLoading || clientLoading) {
        return (
            <div className="p-8 max-w-4xl mx-auto space-y-8" dir="rtl">
                <Skeleton className="h-32 w-full rounded-2xl" />
                <Skeleton className="h-96 w-full rounded-2xl" />
            </div>
        );
    }

    if (!issue) return <div className="text-center py-20">لم يتم العثور على بيانات الفاتورة.</div>;

    return (
        <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6" dir="rtl">
            <div className="flex justify-between items-center no-print bg-background/80 backdrop-blur-sm sticky top-0 z-10 py-4 border-b">
                <Button variant="ghost" onClick={() => router.back()} className="gap-2">
                    <ArrowRight className="h-4 w-4"/> عودة
                </Button>
                <div className="flex gap-2">
                    <Button onClick={handlePrint} className="gap-2 shadow-lg shadow-primary/20 rounded-xl font-bold">
                        <Printer className="h-4 w-4"/> طباعة الفاتورة
                    </Button>
                </div>
            </div>

            <SalesInvoiceView invoice={issue} client={client} />
        </div>
    );
}
