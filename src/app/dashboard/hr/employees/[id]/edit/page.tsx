'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, X } from 'lucide-react';
import { useFirebase, useDocument } from '@/firebase';
import { doc, updateDoc, collection, query, where, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/auth-context';
import type { Employee, AuditLog } from '@/lib/types';
import { EmployeeForm } from '@/components/hr/employee-form';
import { cleanFirestoreData, formatCurrency } from '@/lib/utils';
import { toFirestoreDate } from '@/services/date-converter';
import { format } from 'date-fns';

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

        if (updatedData.iban && updatedData.iban.trim() !== '') {
            const ibanQuery = query(
                collection(firestore, 'employees'),
                where('iban', '==', updatedData.iban.trim())
            );
            const ibanSnapshot = await getDocs(ibanQuery);
            const ibanDuplicates = ibanSnapshot.docs.filter(d => d.id !== id);
            if (ibanDuplicates.length > 0) {
                toast({ variant: 'destructive', title: 'خطأ', description: 'رقم الـ IBAN هذا مسجل بالفعل لموظف آخر.' });
                setIsSaving(false);
                return;
            }
        }

        const batch = writeBatch(firestore);
        const employeeRefDoc = doc(firestore, 'employees', id);

        const changesToLog: Omit<AuditLog, 'id' | 'changedBy' | 'effectiveDate'>[] = [];

        const fieldMappings: { key: keyof Employee; changeType: AuditLog['changeType'], label: string, isCurrency?: boolean }[] = [
            { key: 'fullName', changeType: 'DataUpdate', label: 'الاسم الكامل' },
            { key: 'nameEn', changeType: 'DataUpdate', label: 'الاسم بالإنجليزية' },
            { key: 'civilId', changeType: 'DataUpdate', label: 'الرقم المدني' },
            { key: 'mobile', changeType: 'DataUpdate', label: 'رقم الجوال' },
            { key: 'department', changeType: 'JobChange', label: 'القسم' },
            { key: 'jobTitle', changeType: 'JobChange', label: 'المسمى الوظيفي' },
            { key: 'basicSalary', changeType: 'SalaryChange', label: 'الراتب الأساسي', isCurrency: true },
            { key: 'housingAllowance', changeType: 'SalaryChange', label: 'بدل السكن', isCurrency: true },
            { key: 'transportAllowance', changeType: 'SalaryChange', label: 'بدل المواصلات', isCurrency: true },
            { key: 'contractType', changeType: 'JobChange', label: 'نوع العقد' },
            { key: 'contractPercentage', changeType: 'JobChange', label: 'نسبة العقد' },
            { key: 'residencyExpiry', changeType: 'ResidencyUpdate', label: 'تاريخ انتهاء الإقامة' },
        ];

        const contractTypeTranslations: Record<string, string> = {
            permanent: 'دائم',
            temporary: 'مؤقت',
            subcontractor: 'مقاول باطن',
            percentage: 'نسبة من العقود',
            'part-time': 'دوام جزئي',
        };

        fieldMappings.forEach(({ key, label, isCurrency, changeType }) => {
            const oldValue = employee[key];
            const newValue = updatedData[key];

            const formatValue = (val: any) => {
                if (isCurrency) {
                    return formatCurrency(Number(val || 0));
                }
                if (val === null || val === undefined || val === '') return '-';
                if (key === 'contractType') {
                    return contractTypeTranslations[val as string] || val;
                }
                if (key.toLowerCase().includes('date') || key.toLowerCase().includes('expiry')) {
                    const date = toFirestoreDate(val);
                    return date ? format(date, 'dd/MM/yyyy') : '-';
                }
                return String(val);
            };

            const oldStr = formatValue(oldValue);
            const newStr = formatValue(newValue);
            
            if (oldStr !== newStr) {
                changesToLog.push({
                    changeType,
                    field: label,
                    oldValue: oldStr,
                    newValue: newStr,
                    notes: `تحديث ${label}: من "${oldStr}" إلى "${newStr}".`
                });
            }
        });
        
        try {
            const updatePayload = { ...updatedData };
            batch.update(employeeRefDoc, cleanFirestoreData(updatePayload));

            if (changesToLog.length > 0) {
                 const logCollectionRef = collection(firestore, `employees/${id}/auditLogs`);
                 changesToLog.forEach(logEntry => {
                     const logRef = doc(logCollectionRef);
                     batch.set(logRef, {
                        ...logEntry,
                        effectiveDate: serverTimestamp(),
                        changedBy: currentUser.fullName,
                     });
                 });
            }

            await batch.commit();

            toast({ title: 'نجاح', description: 'تم تحديث بيانات الموظف بنجاح.' });
            router.push(`/dashboard/hr/employees/${id}`);
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

    if (employee.status === 'terminated') {
        return (
            <Card dir="rtl" className="max-w-4xl mx-auto">
                <CardHeader>
                    <CardTitle>غير مسموح</CardTitle>
                    <CardDescription>لا يمكن تعديل بيانات موظف منتهي الخدمة.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button variant="outline" onClick={() => router.back()}>عودة</Button>
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
