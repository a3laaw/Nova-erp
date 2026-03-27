'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useFirebase } from '@/firebase';
import { doc, runTransaction, collection, serverTimestamp, query, where, getDocs, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import type { Employee } from '@/lib/types';
import { EmployeeForm } from '@/components/hr/employee-form';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';
import { cleanFirestoreData, getTenantPath } from '@/lib/utils';

export default function NewEmployeePage() {
    const router = useRouter();
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    
    const [isSaving, setIsSaving] = useState(false);
    const [employeeNumber, setEmployeeNumber] = useState<string | null>(null);

    const tenantId = currentUser?.currentCompanyId;

    useEffect(() => {
        if (!firestore) return;
        const generateEmployeeNumber = async () => {
            try {
                const counterPath = getTenantPath('counters/employees', tenantId);
                const counterRef = doc(firestore, counterPath);
                const counterDoc = await getDoc(counterRef);
                let nextNumber = 101;
                if (counterDoc.exists()) {
                    nextNumber = (counterDoc.data()?.lastNumber || 100) + 1;
                }
                setEmployeeNumber(String(nextNumber));
            } catch (error) {
                console.error("Error generating employee number:", error);
                setEmployeeNumber('Error');
            }
        };
        generateEmployeeNumber();
    }, [firestore, tenantId]);
    
    const handleSave = useCallback(async (newEmployeeData: Partial<Employee>) => {
        if (!firestore || !currentUser || !employeeNumber || employeeNumber === 'Error') {
             toast({ variant: 'destructive', title: 'خطأ', description: 'لا يمكن الحفظ، الرقم الوظيفي غير متاح.' });
             return;
        }
        
        setIsSaving(true);
        let newEmployeeId = '';

        try {
            const employeesCollectionPath = getTenantPath('employees', tenantId);
            
            // --- VALIDATION LOGIC (Isolating check to the tenant path) ---
            if (newEmployeeData.mobile) {
                const mobileQuery = query(collection(firestore, employeesCollectionPath), where('mobile', '==', newEmployeeData.mobile));
                const mobileSnapshot = await getDocs(mobileQuery);
                if (!mobileSnapshot.empty) {
                    throw new Error('رقم الهاتف هذا مسجل بالفعل لموظف آخر في هذه المنشأة.');
                }
            }

            await runTransaction(firestore, async (transaction) => {
                const counterPath = getTenantPath('counters/employees', tenantId);
                const employeeCounterRef = doc(firestore, counterPath);
                const employeeCounterDoc = await transaction.get(employeeCounterRef);
                
                let nextNumber = 101;
                if (employeeCounterDoc.exists()) {
                    nextNumber = (employeeCounterDoc.data()?.lastNumber || 100) + 1;
                }
                
                transaction.set(employeeCounterRef, { lastNumber: nextNumber }, { merge: true });
                
                const newEmployeeNumber = String(nextNumber);

                const finalEmployeeData = {
                  ...newEmployeeData,
                  employeeNumber: newEmployeeNumber,
                  status: 'active' as const,
                  createdAt: serverTimestamp(),
                  lastLeaveResetDate: new Date(),
                  annualLeaveBalance: 0,
                  annualLeaveAccrued: 0,
                  annualLeaveUsed: 0,
                  carriedLeaveDays: 0,
                  sickLeaveUsed: 0,
                  emergencyLeaveUsed: 0,
                  companyId: tenantId || null // 🛡️ التاج السيادي
                };

                const newEmployeeRef = doc(collection(firestore, employeesCollectionPath));
                newEmployeeId = newEmployeeRef.id;
                transaction.set(newEmployeeRef, cleanFirestoreData(finalEmployeeData));
            });

            toast({ title: 'نجاح', description: 'تمت إضافة الموظف بنجاح.' });
            router.push(`/dashboard/hr/employees`);
        } catch (error: any) {
            toast({ title: "خطأ", description: error.message, variant: "destructive" });
            setIsSaving(false);
        }
    }, [firestore, currentUser, toast, router, employeeNumber, tenantId]);

    return (
        <Card className="max-w-4xl mx-auto rounded-[2.5rem] border-none shadow-2xl overflow-hidden" dir="rtl">
            <CardHeader className="bg-primary/5 pb-8 border-b">
                <CardTitle className="text-2xl font-black">إضافة موظف جديد</CardTitle>
                <CardDescription className="text-base font-medium">قم بتعبئة بيانات الموظف الجديد لإنشاء ملف له في المنشأة الحالية.</CardDescription>
            </CardHeader>
            <CardContent className="p-8">
                <EmployeeForm
                    onSave={handleSave}
                    onClose={() => router.back()}
                    isSaving={isSaving}
                    employeeNumber={employeeNumber}
                />
            </CardContent>
        </Card>
    );
}
