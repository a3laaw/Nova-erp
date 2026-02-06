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

export default function NewEmployeePage() {
    const router = useRouter();
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    
    const [isSaving, setIsSaving] = useState(false);
    const [employeeNumber, setEmployeeNumber] = useState<string | null>(null);

    useEffect(() => {
        if (!firestore) return;
        const generateEmployeeNumber = async () => {
            try {
                const currentYear = new Date().getFullYear();
                const counterRef = doc(firestore, 'counters', 'employees');
                const counterDoc = await getDoc(counterRef);
                let nextNumber = 101;
                if (counterDoc.exists()) {
                    const counts = counterDoc.data()?.counts || {};
                    nextNumber = (counts[currentYear] || 100) + 1;
                }
                setEmployeeNumber(`${String(currentYear).slice(-2)}-${String(nextNumber).padStart(4, '0')}`);
            } catch (error) {
                console.error("Error generating employee number:", error);
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في توليد الرقم الوظيفي.' });
                setEmployeeNumber('Error');
            }
        };
        generateEmployeeNumber();
    }, [firestore, toast]);
    
    const handleSave = useCallback(async (newEmployeeData: Partial<Employee>) => {
        if (!firestore || !currentUser || !employeeNumber || employeeNumber === 'Error') {
             toast({ variant: 'destructive', title: 'خطأ', description: 'لا يمكن الحفظ، الرقم الوظيفي غير متاح.' });
             return;
        }
        
        setIsSaving(true);
        let newEmployeeId = '';

        try {
            // --- VALIDATION LOGIC ---
            if (newEmployeeData.mobile) {
                const mobileQuery = query(collection(firestore, 'employees'), where('mobile', '==', newEmployeeData.mobile));
                const mobileSnapshot = await getDocs(mobileQuery);
                if (!mobileSnapshot.empty) {
                    throw new Error('رقم الهاتف هذا مسجل بالفعل لموظف آخر.');
                }
            }
            if (newEmployeeData.civilId) {
                const civilIdQuery = query(collection(firestore, 'employees'), where('civilId', '==', newEmployeeData.civilId));
                const civilIdSnapshot = await getDocs(civilIdQuery);
                if (!civilIdSnapshot.empty) {
                    throw new Error('الرقم المدني هذا مسجل بالفعل لموظف آخر.');
                }
            }

            await runTransaction(firestore, async (transaction) => {
                const currentYear = new Date().getFullYear();
                const employeeCounterRef = doc(firestore, 'counters', 'employees');
                const employeeCounterDoc = await transaction.get(employeeCounterRef);
                
                let nextNumber = 101;
                if (employeeCounterDoc.exists()) {
                    const counts = employeeCounterDoc.data()?.counts || {};
                    nextNumber = (counts[currentYear] || 100) + 1;
                }
                
                transaction.set(employeeCounterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
                
                const newEmployeeNumber = `${String(currentYear).slice(-2)}-${String(nextNumber).padStart(4, '0')}`;

                if (newEmployeeNumber !== employeeNumber) {
                    console.warn(`Race condition detected for employee number. UI showed ${employeeNumber}, saved as ${newEmployeeNumber}`);
                }

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
                };

                const newEmployeeRef = doc(collection(firestore, 'employees'));
                newEmployeeId = newEmployeeRef.id;
                transaction.set(newEmployeeRef, finalEmployeeData);
            });

            toast({ title: 'نجاح', description: 'تمت إضافة الموظف بنجاح.' });
            router.push(`/dashboard/hr/employees`);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'فشل إضافة الموظف.';
            toast({ title: "خطأ", description: errorMessage, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    }, [firestore, currentUser, toast, router, employeeNumber]);

    return (
        <Card className="max-w-4xl mx-auto" dir="rtl">
            <CardHeader>
                <CardTitle>إضافة موظف جديد</CardTitle>
                <CardDescription>قم بتعبئة بيانات الموظف الجديد لإنشاء ملف له في النظام.</CardDescription>
            </CardHeader>
            <CardContent>
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
