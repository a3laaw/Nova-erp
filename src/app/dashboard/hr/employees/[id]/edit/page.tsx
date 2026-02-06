'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useFirebase, useDocument } from '@/firebase';
import { doc, updateDoc, collection, query, where, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/auth-context';
import type { Employee } from '@/lib/types';
import { EmployeeForm } from '@/components/hr/employee-form';
import { cleanFirestoreData } from '@/lib/utils';

export default function EditEmployeePage() {
    const router = useRouter();
    const params = useParams();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    
    const [isSaving, setIsSaving] = useState(false);

    const employeeRef = useMemo(() => {
        if (!firestore || !id) return null;
        return doc(firestore, 'employees', id);
    }, [firestore, id]);

    const { data: employee, loading, error } = useDocument<Employee>(firestore, employeeRef ? employeeRef.path : null);

    const handleSave = useCallback(async (updatedData: Partial<Employee>) => {
        if (!firestore || !currentUser || !id || !employee) return;
        
        setIsSaving(true);
        const batch = writeBatch(firestore);
        const employeeRefDoc = doc(firestore, 'employees', id);

        const changes: string[] = [];
        const fieldMappings: { key: keyof Employee; label: string }[] = [
             { key: 'fullName', label: 'الاسم الكامل' },
             { key: 'nameEn', label: 'الاسم بالإنجليزية' },
             { key: 'civilId', label: 'الرقم المدني' },
             { key: 'mobile', label: 'رقم الجوال' },
             { key: 'department', label: 'القسم' },
             { key: 'jobTitle', label: 'المسمى الوظيفي' },
             { key: 'basicSalary', label: 'الراتب الأساسي' },
             { key: 'contractType', label: 'نوع العقد' },
        ];

        fieldMappings.forEach(({ key, label }) => {
            const oldValue = String(employee[key] || '');
            const newValue = String(updatedData[key] || '');
            if (newValue !== oldValue) {
                changes.push(`تحديث ${label}: من "${oldValue || '-'}" إلى "${newValue || '-'}"`);
            }
        });

        try {
            batch.update(employeeRefDoc, cleanFirestoreData(updatedData));

            if (changes.length > 0) {
                 const logRef = doc(collection(firestore, `employees/${id}/auditLogs`));
                 batch.set(logRef, {
                    changeType: 'DataUpdate',
                    field: 'Multiple',
                    newValue: changes.join('\n'),
                    oldValue: 'Previous State',
                    effectiveDate: serverTimestamp(),
                    changedBy: currentUser.id,
                    notes: 'تحديث بيانات الموظف من نموذج التعديل.'
                 });
            }

            await batch.commit();

            toast({ title: 'نجاح', description: 'تم تحديث بيانات الموظف بنجاح.' });
            router.push(`/dashboard/hr/employees`);
        } catch (error) {
            console.error("Error updating employee:", error);
            toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: 'لم يتم حفظ التعديلات.' });
        } finally {
            setIsSaving(false);
        }
    }, [firestore, currentUser, id, employee, router, toast]);

    if (loading) {
        return (
             <Card className="max-w-4xl mx-auto" dir="rtl">
                <CardHeader>
                     <Skeleton className="h-8 w-48" />
                     <Skeleton className="h-4 w-64 mt-2" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-96 w-full" />
                </CardContent>
            </Card>
        )
    }

    if (error || !employee) {
        return (
            <Card dir="rtl">
                <CardHeader>
                    <CardTitle>خطأ</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-destructive">فشل تحميل بيانات الموظف أو أنه غير موجود.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="max-w-4xl mx-auto" dir="rtl">
            <CardHeader>
                <CardTitle>تعديل بيانات الموظف</CardTitle>
                <CardDescription>
                    تعديل الملف الشخصي لـ <span className="font-bold">{employee.fullName}</span>.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <EmployeeForm 
                    initialData={employee}
                    onSave={handleSave}
                    onClose={() => router.back()}
                    isSaving={isSaving}
                />
            </CardContent>
        </Card>
    );
}
