
'use client';

import { Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { EmployeeDossier } from '@/components/hr/employee-dossier';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState } from 'react';
import { generateReport, ReportData } from '@/services/report-generator';
import { parseISO } from 'date-fns';

function EmployeeReportContent() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const firestore = useFirestore();
    const { toast } = useToast();

    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const asOfDate = searchParams.get('asOf') || new Date().toISOString().split('T')[0];

    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id || !firestore) {
            setError('معلومات غير كافية لتوليد التقرير.');
            setLoading(false);
            return;
        }

        const fetchReport = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await generateReport(firestore, 'EmployeeDossier', { asOfDate, employeeId: id });
                if (data.type !== 'EmployeeDossier') {
                    throw new Error('نوع التقرير غير صحيح.');
                }
                setReportData(data);
            } catch (e: any) {
                setError(e.message || 'فشل تحميل بيانات التقرير.');
                toast({ variant: 'destructive', title: 'خطأ', description: e.message });
            } finally {
                setLoading(false);
            }
        };

        fetchReport();

    }, [id, asOfDate, firestore, toast]);


    if (loading) {
        return (
          <div className="p-8 space-y-6" dir="rtl">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        );
    }

    if (error) {
         return (
            <div className="p-8 text-center" dir='rtl'>
                <p className='text-destructive'>{error}</p>
                <Button onClick={() => router.back()} className="mt-4">العودة</Button>
            </div>
        )
    }

    if (!reportData || reportData.type !== 'EmployeeDossier') {
        return (
             <div className="p-8 text-center" dir='rtl'>
                <p className='text-muted-foreground'>لم يتم العثور على بيانات التقرير.</p>
                <Button onClick={() => router.back()} className="mt-4">العودة</Button>
            </div>
        )
    }

    return (
        <div className="bg-background min-h-screen">
            <EmployeeDossier employee={reportData.employee} reportDate={parseISO(asOfDate)} />
        </div>
    );
}


export default function EmployeeReportPage() {
    return (
        <Suspense fallback={<Skeleton className="h-screen w-full" />}>
            <EmployeeReportContent />
        </Suspense>
    );
}
