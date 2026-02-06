
          
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
import { cleanFirestoreData } from '@/lib/utils'; // IMPROVED: Import the data cleaning utility.

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
                const counterRef = doc(firestore, 'counters', 'employees');
                const counterDoc = await getDoc(counterRef);
                let nextNumber = 101;
                if (counterDoc.exists()) {
                    nextNumber = (counterDoc.data()?.lastNumber || 100) + 1;
                }
                setEmployeeNumber(String(nextNumber));
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
                const employeeCounterRef = doc(firestore, 'counters', 'employees');
                const employeeCounterDoc = await transaction.get(employeeCounterRef);
                
                let nextNumber = 101;
                if (employeeCounterDoc.exists()) {
                    nextNumber = (employeeCounterDoc.data()?.lastNumber || 100) + 1;
                }
                
                transaction.set(employeeCounterRef, { lastNumber: nextNumber }, { merge: true });
                
                const newEmployeeNumber = String(nextNumber);

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
                // FIXED: Use cleanFirestoreData to prevent 'undefined' values from being sent.
                transaction.set(newEmployeeRef, cleanFirestoreData(finalEmployeeData));
            });

            toast({ title: 'نجاح', description: 'تمت إضافة الموظف بنجاح.' });

            const adminHRUsersQuery = query(collection(firestore, 'users'), where('role', 'in', ['Admin', 'HR']));
            const querySnapshot = await getDocs(adminHRUsersQuery);
            
            const notificationPromises: Promise<void>[] = [];
            querySnapshot.forEach(userDoc => {
                const userId = userDoc.id;
                if (userId !== currentUser.id) {
                    const notificationPromise = createNotification(firestore, {
                        userId: userId,
                        title: 'تمت إضافة موظف جديد',
                        body: `قام ${currentUser.fullName} بإضافة الموظف الجديد "${newEmployeeData.fullName}".`,
                        link: `/dashboard/hr/employees`
                    });
                    notificationPromises.push(notificationPromise);
                }
            });

            await Promise.all(notificationPromises);
            
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

          
      