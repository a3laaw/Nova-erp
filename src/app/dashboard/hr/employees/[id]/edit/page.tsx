'use client';

import { useState, useMemo, useCallback } from 'react';
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
import { Label } from '@/components/ui/label';
import { Save, X, Loader2 } from 'lucide-react';
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

    // جلب بيانات الموظف بشكل لحظي ومستقر
    const { data: employee, loading, error } = useDocument<Employee>(firestore, employeeRef ? employeeRef.path : null);

    const handleSave = useCallback(async (updatedData: Partial<Employee>) => {
        if (!firestore || !currentUser || !id || !employee) return;
        
        setIsSaving(true);

        // التحقق من تكرار IBAN لضمان فرادة الحسابات البنكية
        if (updatedData.iban && updatedData.iban.trim() !== '') {
            const ibanQuery = query(
                collection(firestore, 'employees'),
                where('iban', '==', updatedData.iban.trim())
            );
            const ibanSnapshot = await getDocs(ibanQuery);
            const ibanDuplicates = ibanSnapshot.docs.filter(d => d.id !== id);
            if (ibanDuplicates.length > 0) {
                toast({ variant: 'destructive', title: 'خطأ في الحساب البنكي', description: 'رقم الـ IBAN هذا مسجل بالفعل لموظف آخر.' });
                setIsSaving(false);
                return;
            }
        }

        const batch = writeBatch(firestore);
        const employeeRefDoc = doc(firestore, 'employees', id);

        const changesToLog: Omit<AuditLog, 'id' | 'changedBy' | 'effectiveDate'>[] = [];

        // قائمة الحقول المراد تتبع تغييراتها في سجل التدقيق
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
            'piece-rate': 'بالقطعة',
            special: 'دوام خاص',
            day_laborer: 'عامل يومية'
        };

        fieldMappings.forEach(({ key, label, isCurrency, changeType }) => {
            let oldValue = employee[key];
            // معالجة البيانات القديمة التي قد تستخدم nameAr بدلاً من fullName
            if (key === 'fullName' && oldValue === undefined) {
                oldValue = (employee as any).nameAr;
            }

            const newValue = updatedData[key];

            const formatValue = (val: any) => {
                if (isCurrency) return formatCurrency(Number(val || 0));
                if (val === null || val === undefined || val === '') return '-';
                if (key === 'contractType') return contractTypeTranslations[val as string] || val;
                if (typeof val === 'object' || String(key).toLowerCase().includes('date') || String(key).toLowerCase().includes('expiry')) {
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
            batch.update(employeeRefDoc, cleanFirestoreData(updatedData));

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
            toast({ title: 'تم الحفظ', description: 'تم تحديث بيانات الموظف وسجل التدقيق بنجاح.' });
            router.push(`/dashboard/hr/employees/${id}`);
        } catch (error) {
            console.error("Error updating employee:", error);
            toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: 'لم يتم حفظ التعديلات، يرجى المحاولة مرة أخرى.' });
        } finally {
            setIsSaving(false);
        }
    }, [firestore, currentUser, id, employee, router, toast]);

    if (loading) {
        return (
             <Card className="max-w-4xl mx-auto" dir="rtl">
                <CardHeader>
                     <Skeleton className="h-8 w-48" />
                     <Skeleton className="h-4 w-32 mt-2" />
                </CardHeader>
                <CardContent className="space-y-6">
                    <Skeleton className="h-64 w-full rounded-2xl" />
                </CardContent>
            </Card>
        )
    }

    if (error || !employee) {
        return (
            <Card dir="rtl" className="max-w-4xl mx-auto">
                <CardHeader><CardTitle>خطأ في الوصول</CardTitle></CardHeader>
                <CardContent><p className="text-destructive">تعذر تحميل بيانات الموظف، قد يكون الرابط غير صحيح.</p></CardContent>
                <CardFooter><Button onClick={() => router.back()} variant="outline">العودة للخلف</Button></CardFooter>
            </Card>
        );
    }

    if (employee.status === 'terminated') {
        return (
            <Card dir="rtl" className="max-w-4xl mx-auto">
                <CardHeader>
                    <CardTitle>ملف منتهي الخدمة</CardTitle>
                    <CardDescription>لا يمكن تعديل بيانات موظف تم إنهاء خدمته مسبقاً.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button variant="outline" onClick={() => router.back()}>العودة لقائمة الموظفين</Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="max-w-4xl mx-auto" dir="rtl">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>تعديل بيانات الموظف</CardTitle>
                        <CardDescription>
                            تعديل الملف الشخصي لـ <span className="font-bold text-primary">{employee.fullName || (employee as any).nameAr}</span>.
                        </CardDescription>
                    </div>
                    <div className="text-right bg-muted/50 px-4 py-2 rounded-xl border">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">رقم الملف الوظيفي</Label>
                        <div className="font-mono text-lg font-semibold text-primary">
                            {employee.employeeNumber}
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {/* استخدام الـ key يضمن إعادة بناء النموذج بالبيانات الجديدة فور وصولها */}
                <EmployeeForm 
                    key={employee.id} 
                    initialData={employee}
                    onSave={handleSave}
                    onClose={() => router.back()}
                    isSaving={isSaving}
                />
            </CardContent>
        </Card>
    );
}
