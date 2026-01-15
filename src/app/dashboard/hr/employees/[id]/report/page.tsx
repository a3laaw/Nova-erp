'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { EmployeeDossier } from '@/components/hr/employee-dossier';
import { generateReport } from '@/services/report-generator';
import type { Employee } from '@/lib/types';
import { useFirebase } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';

export default function EmployeeReportPrintPage() {
    const params = useParams();
    const { firestore } = useFirebase();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    
    const [employee, setEmployee] = useState<Employee | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id || !firestore) {
            setError('معرف الموظف أو اتصال قاعدة البيانات غير متوفر.');
            setLoading(false);
            return;
        };

        const fetchReportData = async () => {
            setLoading(true);
            setError(null);
            try {
                const reportData = await generateReport(firestore, 'EmployeeDossier', {
                    asOfDate: new Date().toISOString().split('T')[0],
                    employeeId: id
                });
                
                if (reportData.type === 'EmployeeDossier' && reportData.employee) {
                    setEmployee(reportData.employee);
                } else {
                     throw new Error('لم يتم العثور على بيانات التقرير للموظف المحدد.');
                }
            } catch (err) {
                console.error("Error fetching report data for print:", err);
                const errorMessage = err instanceof Error ? err.message : 'حدث خطأ غير متوقع أثناء جلب بيانات التقرير.';
                setError(errorMessage);
            } finally {
                setLoading(false);
            }
        };

        fetchReportData();
    }, [id, firestore]);
    
    useEffect(() => {
        if (!loading && employee) {
            // Delay print slightly to ensure all content and styles are rendered
            const timer = setTimeout(() => {
                window.print();
                // Optional: close the window after printing dialog is closed
                // This can be unreliable, so it's often better to let the user close it.
                // setTimeout(() => window.close(), 1000);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [loading, employee]);

    if (loading) {
        return (
            <div className="p-8 space-y-6" dir='rtl'>
                <div className='flex justify-between items-start'>
                     <Skeleton className="h-10 w-1/3" />
                     <Skeleton className="h-10 w-1/4" />
                </div>
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
                <p className='text-center text-muted-foreground pt-10'>جاري تحضير التقرير للطباعة...</p>
            </div>
        );
    }
    
    if (error) {
        return <div className="p-8 text-center text-destructive" dir='rtl'>
            <h2 className='font-bold text-lg'>فشل تحميل التقرير</h2>
            <p>{error}</p>
        </div>;
    }

    if (!employee) {
        return <div className="p-8 text-center text-muted-foreground" dir='rtl'>لم يتم العثور على الموظف المحدد.</div>;
    }

    // This div ensures that only the dossier is visible, and no other UI elements from a potential layout
    return (
        <div>
           <EmployeeDossier employee={employee} reportDate={new Date()} />
        </div>
    );
}
