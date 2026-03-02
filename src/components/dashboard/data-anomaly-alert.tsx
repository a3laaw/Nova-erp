
'use client';

import { useState, useMemo } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import type { JournalEntry, PurchaseOrder, RequestForQuotation, CashReceipt } from '@/lib/types';
import { cn } from '@/lib/utils';
import { doc, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

interface Anomaly {
  type: 'inventory' | 'accounting' | 'procurement';
  title: string;
  count: number;
  description: string;
  link: string;
  variant: 'destructive' | 'warning';
  ids: string[]; // المعرفات التي تسببت في الخلل للقيام بتجاوزها
}

/**
 * مكون تنبيهات الخلل المطور:
 * يسمح للمدير بإجراء "تجاوز" (Bypass) للتنبيهات الإجرائية التي لا تؤثر مالياً
 * لضمان تركيز الرقابة على المشاكل الحقيقية فقط.
 */
export function DataAnomalyAlert() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [isBypassing, setIsBypassing] = useState(false);

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

    // 1. فحص فجوات المخزون (GRNs vs JEs) - استبعاد ما تم تجاوزه
    const orphanedGrns = grns.filter(doc => (!doc.journalEntryId || !allJeIds.has(doc.journalEntryId)) && !doc.isBypassed);
    if (orphanedGrns.length > 0) {
      found.push({
        type: 'inventory',
        title: 'خلل مالي في استلام البضاعة',
        count: orphanedGrns.length,
        description: `يوجد ${orphanedGrns.length} إذن استلام بضاعة لا يملك أثراً مالياً، مما يسبب تضارباً في أرصدة الموردين والمخزون.`,
        link: '/dashboard/warehouse/grns',
        variant: 'destructive',
        ids: orphanedGrns.map((d: any) => d.id)
      });
    }

    // 2. فحص فجوات دورة المشتريات (أوامر شراء بدون طلب تسعير) - استبعاد ما تم تجاوزه
    const directPurchases = pos.filter(doc => (!doc.rfqId || !allRfqIds.has(doc.rfqId)) && !doc.isBypassed);
    if (directPurchases.length > 0) {
      found.push({
        type: 'procurement',
        title: 'تنبيه إجرائي: شراء مباشر',
        count: directPurchases.length,
        description: `يوجد ${directPurchases.length} أمر شراء تم إصدارها مباشرة دون طلب تسعير (RFQ). يمكنك تجاوزها إذا كانت طارئة.`,
        link: '/dashboard/purchasing/purchase-orders',
        variant: 'warning',
        ids: directPurchases.map((d: any) => d.id)
      });
    }

    // 3. فحص فجوات سندات القبض - استبعاد ما تم تجاوزه
    const orphanedReceipts = receipts.filter(doc => (!doc.journalEntryId || !allJeIds.has(doc.journalEntryId)) && !doc.isBypassed);
    if (orphanedReceipts.length > 0) {
      found.push({
        type: 'accounting',
        title: 'خلل مالي في سندات القبض',
        count: orphanedReceipts.length,
        description: `يوجد ${orphanedReceipts.length} سند قبض لم يولّد قيداً محاسبيًا، مما يؤدي لعدم تحديث مديونية العميل.`,
        link: '/dashboard/accounting/cash-receipts',
        variant: 'destructive',
        ids: orphanedReceipts.map((d: any) => d.id)
      });
    }

    return found;
  }, [jes, grns, rfqs, pos, receipts, jesLoading, grnsLoading, rfqsLoading, posLoading, receiptsLoading]);

  const handleBypass = async (type: Anomaly['type'], ids: string[]) => {
    if (!firestore || ids.length === 0) return;
    setIsBypassing(true);
    
    try {
        const batch = writeBatch(firestore);
        const collectionName = type === 'inventory' ? 'grns' : type === 'procurement' ? 'purchaseOrders' : 'cashReceipts';
        
        ids.forEach(id => {
            const docRef = doc(firestore, collectionName, id);
            batch.update(docRef, { isBypassed: true });
        });

        await batch.commit();
        toast({ title: 'تم التجاوز', description: 'تم إخفاء التنبيهات المحددة بنجاح من لوحة التحكم.' });
    } catch (e) {
        console.error("Bypass error:", e);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تنفيذ إجراء التجاوز.' });
    } finally {
        setIsBypassing(false);
    }
  };

  if (jesLoading) return <Skeleton className="h-20 w-full mb-4 rounded-xl" />;
  if (anomalies.length === 0) return null;

  return (
    <div className="space-y-3 mb-6 no-print" dir="rtl">
      {anomalies.map((anomaly, idx) => (
        <Alert 
            key={idx} 
            variant={anomaly.variant === 'destructive' ? 'destructive' : 'default'} 
            className={cn(
                "border-2 shadow-lg transition-all duration-500",
                anomaly.variant === 'destructive' ? "bg-red-50 border-red-500 shadow-red-100" : "bg-amber-50 border-amber-500 shadow-amber-100"
            )}
        >
          <ShieldAlert className={cn("h-5 w-5", anomaly.variant === 'destructive' ? "text-red-600" : "text-amber-600")} />
          <AlertTitle className={cn("font-black flex items-center justify-between", anomaly.variant === 'destructive' ? "text-red-700" : "text-amber-700")}>
            <span className="flex items-center gap-2">{anomaly.title}</span>
            <Badge variant={anomaly.variant === 'destructive' ? 'destructive' : 'secondary'} className="rounded-full">
                {anomaly.variant === 'destructive' ? 'خلل مالي حاد' : 'ملاحظة إجرائية'}
            </Badge>
          </AlertTitle>
          <AlertDescription className={cn("mt-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4", anomaly.variant === 'destructive' ? "text-red-600" : "text-amber-700")}>
            <p className="max-w-xl font-medium leading-relaxed">{anomaly.description}</p>
            <div className="flex gap-2 shrink-0">
                <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleBypass(anomaly.type, anomaly.ids)} 
                    disabled={isBypassing}
                    className="h-8 rounded-lg border border-current hover:bg-current hover:text-white transition-all font-bold gap-1"
                >
                    {isBypassing ? <Loader2 className="h-3 w-3 animate-spin"/> : <CheckCircle2 className="h-3 w-3" />}
                    تجاوز
                </Button>
                <Button asChild size="sm" variant="outline" className="h-8 border-current bg-background shadow-sm hover:shadow-none font-bold">
                    <Link href={anomaly.link}>مراجعة وحل ({anomaly.count})</Link>
                </Button>
            </div>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
