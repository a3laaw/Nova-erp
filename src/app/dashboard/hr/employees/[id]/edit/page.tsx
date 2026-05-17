'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Save, X, Loader2 } from 'lucide-react';
import { useFirebase, useDocument } from '@/firebase';
import { doc, updateDoc, collection, query, where, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/auth-context';
import type { Employee } from '@/lib/types';
import { EmployeeForm } from '@/components/hr/employee-form';
import { cleanFirestoreData, formatCurrency, getTenantPath } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function EditEmployeePage() {
    const router = useRouter();
    const params = useParams();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    
    const tenantId = currentUser?.currentCompanyId;
    const [isSaving, setIsSaving] = useState(false);

    // 🛡️ توجيه مسار الاستماع للمنظومة المعزولة
    const employeePath = useMemo(() => getTenantPath(`employees/${id}`, tenantId), [id, tenantId]);
    const { data: employee, loading } = useDocument<Employee>(firestore, employeePath);

    const handleSave = useCallback(async (updatedData: Partial<Employee>) => {
        if (!firestore || !currentUser || !id || !employee || !tenantId) return;
        
        setIsSaving(true);

        const batch = writeBatch(firestore);
        const finalEmployeePath = getTenantPath(`employees/${id}`, tenantId);
        const employeeRefDoc = doc(firestore, finalEmployeePath);

        const changesToLog: any[] = [];
        const fieldMappings: { key: keyof Employee; label: string; isCurrency?: boolean }[] = [
            { key: 'fullName', label: 'الاسم الكامل' },
            { key: 'civilId', label: 'الرقم المدني' },
            { key: 'mobile', label: 'رقم الجوال' },
            { key: 'basicSalary', label: 'الراتب الأساسي', isCurrency: true },
            { key: 'jobTitle', label: 'المسمى الوظيفي' },
            { key: 'department', label: 'القسم' }
        ];

        fieldMappings.forEach(({ key, label, isCurrency }) => {
            const oldValue = employee[key];
            const newValue = updatedData[key];
            const oldStr = isCurrency ? formatCurrency(Number(oldValue || 0)) : String(oldValue || '-');
            const newStr = isCurrency ? formatCurrency(Number(newValue || 0)) : String(newValue || '-');
            
            if (oldStr !== newStr) {
                changesToLog.push({
                    changeType: 'DataUpdate',
                    field: label,
                    oldValue: oldStr,
                    newValue: newStr,
                    notes: `تحديث ${label}: من "${oldStr}" إلى "${newStr}".`
                });
            }
        });
        
        try {
            const safeData = cleanFirestoreData(updatedData);
            batch.update(employeeRefDoc, safeData);

            if (changesToLog.length > 0) {
                 const auditLogPath = getTenantPath(`employees/${id}/auditLogs`, tenantId);
                 const logCollectionRef = collection(firestore, auditLogPath);
                 changesToLog.forEach(logEntry => {
                     const logRef = doc(logCollectionRef);
                     batch.set(logRef, {
                        ...logEntry,
                        effectiveDate: serverTimestamp(),
                        changedBy: currentUser.fullName,
                        companyId: tenantId
                     });
                 });
            }

            await batch.commit().catch(async (serverError) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: finalEmployeePath,
                    operation: 'update',
                    requestResourceData: safeData
                }));
                throw serverError;
            });

            toast({ title: 'تم الحفظ', description: 'تم ترحيل تعديلات الملف الوظيفي وسجل التدقيق.' });
            router.push(`/dashboard/hr/employees/${id}`);
        } catch (error: any) {
            console.error("Save Error:", error);
            toast({ variant: 'destructive', title: 'عائق صلاحيات', description: error.message || 'فشل ترحيل التعديلات.' });
            setIsSaving(false);
        }
    }, [firestore, currentUser, id, employee, tenantId, router, toast]);

    if (loading) return <div className="p-8 max-w-4xl mx-auto"><Skeleton className="h-96 w-full rounded-[2.5rem]" /></div>;

    return (
        <Card className="max-w-4xl mx-auto rounded-[2.5rem] border-none shadow-2xl overflow-hidden" dir="rtl">
            <CardHeader className="bg-primary/5 pb-8 border-b">
                <CardTitle className="text-2xl font-black">تعديل ملف الموظف</CardTitle>
                <CardDescription className="font-bold">تحديث البيانات الوظيفية والمالية لـ {employee?.fullName}.</CardDescription>
            </CardHeader>
            <CardContent className="p-8">
                <EmployeeForm 
                    initialData={employee}
                    onSave={handleSave}
                    onClose={() => router.back()}
                    isSaving={isSaving}
                    employeeNumber={employee?.employeeNumber}
                />
            </CardContent>
        </Card>
    );
}
