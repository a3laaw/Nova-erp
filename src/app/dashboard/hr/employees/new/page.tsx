'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useFirebase } from '@/firebase';
import { doc, runTransaction, collection, serverTimestamp, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import type { Employee, UserProfile } from '@/lib/types';
import { EmployeeForm } from '@/components/hr/employee-form';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';

export default function NewEmployeePage() {
    const router = useRouter();
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    
    const [isSaving, setIsSaving] = useState(false);
    
    const handleSaveEmployee = async (employeeData: Partial<Employee>, userData: Partial<UserProfile>) => {
        if (!firestore || !currentUser) return;
        
        setIsSaving(true);
        let newEmployeeId = '';

        try {
            await runTransaction(firestore, async (transaction) => {
                // 1. Get new Employee Number
                const currentYear = String(new Date().getFullYear());
                const employeeCounterRef = doc(firestore, 'counters', 'employees');
                const employeeCounterDoc = await transaction.get(employeeCounterRef);
                
                let nextEmployeeNumber = 1;
                if (employeeCounterDoc.exists()) {
                    const counts = employeeCounterDoc.data()?.counts || {};
                    nextEmployeeNumber = (counts[currentYear] || 0) + 1;
                }
                
                // 2. Prepare Employee Document
                const newEmployeeRef = doc(collection(firestore, 'employees'));
                newEmployeeId = newEmployeeRef.id;

                const finalEmployeeData: Partial<Employee> = {
                    ...employeeData,
                    employeeNumber: `${currentYear}-${String(nextEmployeeNumber).padStart(4, '0')}`,
                    createdAt: serverTimestamp(),
                    status: 'active',
                };
                transaction.set(newEmployeeRef, finalEmployeeData);
                
                // 3. Prepare User Document
                const newUserRef = doc(collection(firestore, 'users'));
                const finalUserData: Partial<UserProfile> = {
                    ...userData,
                    employeeId: newEmployeeId,
                    email: `${userData.username}@scoop.local`,
                    isActive: false, // Always created as inactive
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.id,
                };
                transaction.set(newUserRef, finalUserData);

                // 4. Update the counter
                transaction.set(employeeCounterRef, { counts: { [currentYear]: nextEmployeeNumber } }, { merge: true });

                // 5. Create an initial Audit Log
                const auditLogRef = doc(collection(firestore, `employees/${newEmployeeId}/auditLogs`));
                transaction.set(auditLogRef, {
                    changeType: 'Creation',
                    field: 'self',
                    oldValue: null,
                    newValue: `${employeeData.fullName} hired as ${employeeData.jobTitle}`,
                    effectiveDate: employeeData.hireDate || serverTimestamp(),
                    changedBy: currentUser.id,
                    notes: 'إنشاء ملف موظف جديد في النظام.'
                });
            });

            toast({ title: 'نجاح', description: 'تمت إضافة الموظف وإنشاء حسابه بنجاح.' });
            
            // Post-transaction notifications
            if (currentUser.id) {
                await createNotification(firestore, {
                    userId: currentUser.id,
                    title: 'تم إنشاء ملف موظف',
                    body: `لقد قمت بإضافة الموظف "${employeeData.fullName}" بنجاح.`,
                    link: `/dashboard/hr/employees/${newEmployeeId}`
                });
            }

            router.push(`/dashboard/hr/employees`);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'فشل إضافة الموظف.';
            toast({ title: "خطأ", description: errorMessage, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="max-w-3xl mx-auto" dir="rtl">
            <CardHeader>
                <CardTitle>إضافة موظف جديد</CardTitle>
                <CardDescription>قم بتعبئة بيانات الموظف الجديد لإنشاء ملف وظيفي وحساب دخول له.</CardDescription>
            </CardHeader>
            <CardContent>
                <EmployeeForm 
                    onSave={handleSaveEmployee} 
                    onClose={() => router.back()}
                    isSaving={isSaving}
                />
            </CardContent>
        </Card>
    );
}
