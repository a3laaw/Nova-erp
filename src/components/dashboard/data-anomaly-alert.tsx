'use client';

import { useState, useEffect, useCallback } from 'react';
import { useFirebase } from '@/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, RefreshCw, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface Anomaly {
  type: 'inventory' | 'accounting' | 'payroll';
  title: string;
  count: number;
  description: string;
  link: string;
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
      // 1. جلب كافة القيود المحاسبية للمقارنة
      const jesSnap = await getDocs(collection(firestore, 'journalEntries'));
      const allJeIds = new Set(jesSnap.docs.map(d => d.id));

      // 2. فحص فجوات المخزون (GRNs vs JEs)
      const grnsSnap = await getDocs(collection(firestore, 'grns'));
      const orphanedGrns = grnsSnap.docs.filter(doc => {
        const data = doc.data();
        // إذن استلام بضاعة يملك ID قيد ولكن القيد غير موجود فعلياً
        return data.journalEntryId && !allJeIds.has(data.journalEntryId);
      });

      if (orphanedGrns.length > 0) {
        foundAnomalies.push({
          type: 'inventory',
          title: 'خلل في قيود المخزون',
          count: orphanedGrns.length,
          description: `تم اكتشاف ${orphanedGrns.length} إذن استلام بضاعة تم حذف قيودها المحاسبية، مما يسبب عدم تطابق بين رصيد المخزن والحسابات العامة.`,
          link: '/dashboard/warehouse/grns'
        });
      }

      // 3. فحص فجوات سندات القبض
      const receiptsSnap = await getDocs(collection(firestore, 'cashReceipts'));
      const orphanedReceipts = receiptsSnap.docs.filter(doc => {
        const data = doc.data();
        return data.journalEntryId && !allJeIds.has(data.journalEntryId);
      });

      if (orphanedReceipts.length > 0) {
        foundAnomalies.push({
          type: 'accounting',
          title: 'خلل في قيود التحصيل',
          count: orphanedReceipts.length,
          description: `يوجد سندات قبض بدون قيود مالية مقابلة في الدفاتر، مما يعني أن مديونيات العملاء المسجلة غير دقيقة.`,
          link: '/dashboard/accounting/cash-receipts'
        });
      }

      // 4. فحص فجوات سندات الصرف
      const paymentsSnap = await getDocs(collection(firestore, 'paymentVouchers'));
      const orphanedPayments = paymentsSnap.docs.filter(doc => {
        const data = doc.data();
        return data.journalEntryId && !allJeIds.has(data.journalEntryId);
      });

      if (orphanedPayments.length > 0) {
        foundAnomalies.push({
          type: 'accounting',
          title: 'خلل في قيود المصروفات',
          count: orphanedPayments.length,
          description: `يوجد سندات صرف تم حذف قيودها، مما يسبب تضارباً في أرصدة البنوك والمصروفات الإدارية.`,
          link: '/dashboard/accounting/payment-vouchers'
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
    <div className="space-y-3 mb-6 animate-in fade-in slide-in-from-top-4 duration-500 no-print" dir="rtl">
      {anomalies.map((anomaly, idx) => (
        <Alert key={idx} variant="destructive" className="border-2 border-red-500 bg-red-50 dark:bg-red-950/20 shadow-lg shadow-red-100">
          <ShieldAlert className="h-5 w-5 !text-red-600" />
          <AlertTitle className="font-black text-red-700 dark:text-red-400 flex items-center justify-between">
            <span className="flex items-center gap-2">تنبيه خلل في سلامة البيانات: {anomaly.title}</span>
            <Badge variant="destructive" className="animate-pulse">خطير</Badge>
          </AlertTitle>
          <AlertDescription className="text-red-600 dark:text-red-300 mt-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <p className="max-w-xl font-medium leading-relaxed">{anomaly.description}</p>
            <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={checkIntegrity} className="h-8 border-red-200 text-red-700 hover:bg-red-100">
                    <RefreshCw className="h-3 w-3 ml-1" /> فحص مجدداً
                </Button>
                <Button asChild size="sm" className="h-8 bg-red-600 hover:bg-red-700 font-bold">
                    <Link href={anomaly.link}>مراجعة وحل المشكلة ({anomaly.count})</Link>
                </Button>
            </div>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}