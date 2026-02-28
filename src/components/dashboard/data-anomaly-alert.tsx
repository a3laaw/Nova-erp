
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import type { JournalEntry, PurchaseOrder, RequestForQuotation, CashReceipt } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Anomaly {
  type: 'inventory' | 'accounting' | 'procurement';
  title: string;
  count: number;
  description: string;
  link: string;
  variant: 'destructive' | 'warning';
}

export function DataAnomalyAlert() {
  const { firestore } = useFirebase();

  // جلب كافة البيانات المطلوبة للمراجعة بشكل لحظي
  const { data: jes, loading: jesLoading } = useSubscription<JournalEntry>(firestore, 'journalEntries');
  const { data: grns, loading: grnsLoading } = useSubscription<any>(firestore, 'grns');
  const { data: rfqs, loading: rfqsLoading } = useSubscription<RequestForQuotation>(firestore, 'rfqs');
  const { data: pos, loading: posLoading } = useSubscription<PurchaseOrder>(firestore, 'purchaseOrders');
  const { data: receipts, loading: receiptsLoading } = useSubscription<CashReceipt>(firestore, 'cashReceipts');

  const anomalies = useMemo(() => {
    if (jesLoading || grnsLoading || rfqsLoading || posLoading || receiptsLoading) return [];
    
    const found: Anomaly[] = [];
    const allJeIds = new Set(jes.map(d => d.id));
    const allRfqIds = new Set(rfqs.map(d => d.id));

    // 1. فحص فجوات المخزون (GRNs vs JEs)
    const orphanedGrns = grns.filter(doc => !doc.journalEntryId || !allJeIds.has(doc.journalEntryId));
    if (orphanedGrns.length > 0) {
      found.push({
        type: 'inventory',
        title: 'خلل مالي في استلام البضاعة',
        count: orphanedGrns.length,
        description: `يوجد ${orphanedGrns.length} إذن استلام بضاعة لا يملك أثراً مالياً، مما يسبب تضارباً في أرصدة الموردين والمخزون.`,
        link: '/dashboard/warehouse/grns',
        variant: 'destructive'
      });
    }

    // 2. فحص فجوات دورة المشتريات (أوامر شراء بدون طلب تسعير)
    const directPurchases = pos.filter(doc => !doc.rfqId || !allRfqIds.has(doc.rfqId));
    if (directPurchases.length > 0) {
      found.push({
        type: 'procurement',
        title: 'تنبيه إجرائي: شراء مباشر',
        count: directPurchases.length,
        description: `يوجد ${directPurchases.length} أمر شراء تم إصدارها مباشرة دون طلب تسعير (RFQ).`,
        link: '/dashboard/purchasing/purchase-orders',
        variant: 'warning'
      });
    }

    // 3. فحص فجوات سندات القبض
    const orphanedReceipts = receipts.filter(doc => !doc.journalEntryId || !allJeIds.has(doc.journalEntryId));
    if (orphanedReceipts.length > 0) {
      found.push({
        type: 'accounting',
        title: 'خلل مالي في سندات القبض',
        count: orphanedReceipts.length,
        description: `يوجد ${orphanedReceipts.length} سند قبض لم يولّد قيداً محاسبيًا، مما يؤدي لعدم تحديث مديونية العميل.`,
        link: '/dashboard/accounting/cash-receipts',
        variant: 'destructive'
      });
    }

    return found;
  }, [jes, grns, rfqs, pos, receipts, jesLoading, grnsLoading, rfqsLoading, posLoading, receiptsLoading]);

  if (jesLoading) return <Skeleton className="h-20 w-full mb-4 rounded-xl" />;
  if (anomalies.length === 0) return null;

  return (
    <div className="space-y-3 mb-6 no-print" dir="rtl">
      {anomalies.map((anomaly, idx) => (
        <Alert 
            key={idx} 
            variant={anomaly.variant === 'destructive' ? 'destructive' : 'default'} 
            className={cn(
                "border-2 shadow-lg",
                anomaly.variant === 'destructive' ? "bg-red-50 border-red-500 shadow-red-100" : "bg-amber-50 border-amber-500 shadow-amber-100"
            )}
        >
          <ShieldAlert className={cn("h-5 w-5", anomaly.variant === 'destructive' ? "text-red-600" : "text-amber-600")} />
          <AlertTitle className={cn("font-black flex items-center justify-between", anomaly.variant === 'destructive' ? "text-red-700" : "text-amber-700")}>
            <span className="flex items-center gap-2">{anomaly.title}</span>
            <Badge variant={anomaly.variant === 'destructive' ? 'destructive' : 'secondary'}>
                {anomaly.variant === 'destructive' ? 'خلل مالي حاد' : 'ملاحظة إجرائية'}
            </Badge>
          </AlertTitle>
          <AlertDescription className={cn("mt-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4", anomaly.variant === 'destructive' ? "text-red-600" : "text-amber-700")}>
            <p className="max-w-xl font-medium leading-relaxed">{anomaly.description}</p>
            <div className="flex gap-2 shrink-0">
                <Button asChild size="sm" variant="outline" className="h-8 border-current bg-transparent">
                    <Link href={anomaly.link}>مراجعة وحل ({anomaly.count})</Link>
                </Button>
            </div>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
