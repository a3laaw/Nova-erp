
'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Printer, ArrowRight } from 'lucide-react';
import { PurchaseInvoiceView } from '@/components/purchasing/purchase-invoice-view';
import type { Vendor } from '@/lib/types';

export default function PurchaseInvoicePage() {
    const params = useParams();
    const router = useRouter();
    const { firestore } = useFirebase();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    // الفاتورة هي في الأصل إذن استلام بضاعة (GRN)
    const grnRef = useMemo(() => (firestore && id ? doc(firestore, 'grns', id) : null), [firestore, id]);
    const { data: grn, loading: grnLoading } = useDocument<any>(firestore, grnRef?.path || null);

    const vendorRef = useMemo(() => (firestore && grn?.vendorId ? doc(firestore, 'vendors', grn.vendorId) : null), [firestore, grn?.vendorId]);
    const { data: vendor, loading: vendorLoading } = useDocument<Vendor>(firestore, vendorRef?.path || null);

    const handlePrint = () => window.print();

    if (grnLoading || vendorLoading) {
        return (
            <div className="p-8 max-w-4xl mx-auto space-y-8" dir="rtl">
                <Skeleton className="h-32 w-full rounded-2xl" />
                <Skeleton className="h-96 w-full rounded-2xl" />
            </div>
        );
    }

    if (!grn) return <div className="text-center py-20">لم يتم العثور على بيانات الفاتورة.</div>;

    return (
        <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6" dir="rtl">
            <div className="flex justify-between items-center no-print bg-background/80 backdrop-blur-sm sticky top-0 z-10 py-4 border-b">
                <Button variant="ghost" onClick={() => router.back()} className="gap-2">
                    <ArrowRight className="h-4 w-4"/> عودة
                </Button>
                <div className="flex gap-2">
                    <Button onClick={handlePrint} className="gap-2 shadow-lg shadow-blue-200 rounded-xl font-bold bg-blue-700 hover:bg-blue-800">
                        <Printer className="h-4 w-4"/> طباعة فاتورة المشتريات
                    </Button>
                </div>
            </div>

            <PurchaseInvoiceView grn={grn} vendor={vendor} />
        </div>
    );
}
