
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useFirebase } from '@/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, RefreshCw, ShieldAlert, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

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
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);

  const checkIntegrity = useCallback(async () => {
    if (!firestore) return;
    setLoading(true);
    const foundAnomalies: Anomaly[] = [];

    try {
      // جلب البيانات اللازمة للفحص
      const jesSnap = await getDocs(collection(firestore, 'journalEntries'));
      const allJeIds = new Set(jesSnap.docs.map(d => d.id));
      
      const rfqsSnap = await getDocs(collection(firestore, 'rfqs'));
      const allRfqIds = new Set(rfqsSnap.docs.map(d => d.id));

      // 1. فحص فجوات المخزون (GRNs vs JEs)
      const grnsSnap = await getDocs(collection(firestore, 'grns'));
      const orphanedGrns = grnsSnap.docs.filter(doc => {
        const data = doc.data();
        return !data.journalEntryId || !allJeIds.has(data.journalEntryId);
      });

      if (orphanedGrns.length > 0) {
        foundAnomalies.push({
          type: 'inventory',
          title: 'خلل مالي في استلام البضاعة',
          count: orphanedGrns.length,
          description: `يوجد ${orphanedGrns.length} إذن استلام بضاعة لا يملك أثراً مالياً، مما يسبب تضارباً في أرصدة الموردين والمخزون.`,
          link: '/dashboard/warehouse/grns',
          variant: 'destructive'
        });
      }

      // 2. فحص فجوات دورة المشتريات (أوامر شراء بدون طلب تسعير)
      const posSnap = await getDocs(collection(firestore, 'purchaseOrders'));
      const directPurchases = posSnap.docs.filter(doc => {
        const data = doc.data();
        // خلل إجرائي: أمر شراء غير مرتبط بـ RFQ (شراء مباشر)
        return !data.rfqId || !allRfqIds.has(data.rfqId);
      });

      if (directPurchases.length > 0) {
        foundAnomalies.push({
          type: 'procurement',
          title: 'تنبيه إجرائي: شراء مباشر',
          count: directPurchases.length,
          description: `يوجد ${directPurchases.length} أمر شراء تم إصدارها مباشرة دون طلب تسعير (RFQ). يرجى مراجعة مبررات الشراء المباشر.`,
          link: '/dashboard/purchasing/purchase-orders',
          variant: 'warning'
        });
      }

      // 3. فحص فجوات سندات القبض
      const receiptsSnap = await getDocs(collection(firestore, 'cashReceipts'));
      const orphanedReceipts = receiptsSnap.docs.filter(doc => !doc.data().journalEntryId || !allJeIds.has(doc.data().journalEntryId));

      if (orphanedReceipts.length > 0) {
        foundAnomalies.push({
          type: 'accounting',
          title: 'خلل مالي في سندات القبض',
          count: orphanedReceipts.length,
          description: `يوجد ${orphanedReceipts.length} سند قبض لم يولّد قيداً محاسبياً، مما يؤدي لعدم تحديث مديونية العميل.`,
          link: '/dashboard/accounting/cash-receipts',
          variant: 'destructive'
        });
      }

      setAnomalies(foundAnomalies);
    } catch (error) {
      console.error("Integrity check failed:", error);
    } finally {
      setLoading(false);
    }
  }, [firestore]);

  useEffect(() => {
    checkIntegrity();
  }, [checkIntegrity]);

  if (loading) return <Skeleton className="h-20 w-full mb-4 rounded-xl" />;
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

function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(' ');
}
