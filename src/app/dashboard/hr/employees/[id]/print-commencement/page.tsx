'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDocument, useFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Employee } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Printer, ArrowRight } from 'lucide-react';
import { CommencementNotice } from '@/components/hr/notices/commencement-notice';

export default function PrintCommencementNoticePage() {
    const params = useParams();
    const router = useRouter();
    const { firestore } = useFirebase();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const employeeRef = useMemo(() => firestore && id ? doc(firestore, 'employees', id) : null, [firestore, id]);
    const { data: employee, loading: employeeLoading } = useDocument<Employee>(firestore, employeeRef?.path || null);

    const handlePrint = () => window.print();

    if (employeeLoading) return <div className="p-8 max-w-4xl mx-auto space-y-8"><Skeleton className="h-64 w-full rounded-[2.5rem]" /></div>;
    if (!employee) return <div className="text-center p-20">تعذر تحميل بيانات الموظف.</div>;

    return (
        <div className="space-y-6 max-w-4xl mx-auto p-4 sm:p-6" dir="rtl">
            <div className="flex justify-between items-center no-print bg-white/80 backdrop-blur-sm sticky top-0 z-10 p-4 border rounded-3xl shadow-sm mb-6">
                <Button variant="ghost" onClick={() => router.back()} className="font-bold gap-2">
                    <ArrowRight className="h-4 w-4"/> عودة للملف
                </Button>
                <Button onClick={handlePrint} className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 rounded-xl font-black gap-2">
                    <Printer className="h-4 w-4"/> طباعة إشعار المباشرة
                </Button>
            </div>
            <CommencementNotice employee={employee} />
        </div>
    );
}
