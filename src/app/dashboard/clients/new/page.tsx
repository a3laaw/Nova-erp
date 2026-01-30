'use client';

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useFirebase } from '@/firebase';
import { doc, runTransaction, collection, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import type { Client } from '@/lib/types';
import { ClientForm } from '@/components/clients/client-form';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';

export default function NewClientPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    
    const [isSaving, setIsSaving] = useState(false);
    
    const initialData = {
        nameAr: searchParams.get('nameAr') || '',
        mobile: searchParams.get('mobile') || '',
        assignedEngineer: searchParams.get('engineerId') || '',
    };
    
    const handleSave = useCallback(async (newClientData: Partial<Client>) => {
        if (!firestore || !currentUser) return;
        
        setIsSaving(true);
        let newClientId = '';

        try {
            await runTransaction(firestore, async (transaction) => {
                const currentYear = String(new Date().getFullYear());
                const clientFileCounterRef = doc(firestore, 'counters', 'clientFiles');
                const clientFileCounterDoc = await transaction.get(clientFileCounterRef);
                
                let nextFileNumber = 1;
                if (clientFileCounterDoc.exists()) {
                    const counts = clientFileCounterDoc.data()?.counts || {};
                    nextFileNumber = (counts[currentYear] || 0) + 1;
                }
                
                transaction.set(clientFileCounterRef, { counts: { [currentYear]: nextFileNumber } }, { merge: true });
                const newFileId = `${nextFileNumber}/${currentYear}`;

                const finalClientData: Omit<Client, 'id'> = {
                  ...(newClientData as Omit<Client, 'id' | 'fileId' | 'fileNumber' | 'fileYear' | 'status' | 'createdAt' | 'isActive'>),
                  fileId: newFileId,
                  fileNumber: nextFileNumber,
                  fileYear: parseInt(currentYear, 10),
                  status: 'new',
                  transactionCounter: 0,
                  createdAt: serverTimestamp(),
                  isActive: true,
                };

                const newClientRef = doc(collection(firestore, 'clients'));
                newClientId = newClientRef.id;
                transaction.set(newClientRef, finalClientData);

                const fromAppointmentId = searchParams.get('fromAppointmentId');
                if(fromAppointmentId) {
                    const apptRef = doc(firestore, 'appointments', fromAppointmentId);
                    transaction.update(apptRef, {
                        clientId: newClientId,
                        clientName: null,
                        clientMobile: null,
                    });
                }
            });

            toast({ title: 'نجاح', description: 'تمت إضافة العميل بنجاح.' });

            if (newClientData.assignedEngineer) {
                const targetUserId = await findUserIdByEmployeeId(firestore, newClientData.assignedEngineer);
                if (targetUserId && targetUserId !== currentUser.id) {
                    await createNotification(firestore, {
                        userId: targetUserId,
                        title: 'تم إسناد عميل جديد لك',
                        body: `قام ${currentUser.fullName} بإسناد العميل "${newClientData.nameAr}" إليك.`,
                        link: `/dashboard/clients/${newClientId}`
                    });
                }
            }

            router.push(`/dashboard/clients/${newClientId}`);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'فشل إضافة العميل.';
            toast({ title: "خطأ", description: errorMessage, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    }, [firestore, currentUser, toast, router, searchParams]);

    return (
        <Card className="max-w-2xl mx-auto" dir="rtl">
            <CardHeader>
                <CardTitle>إضافة عميل جديد</CardTitle>
                <CardDescription>قم بتعبئة بيانات العميل الجديد لإنشاء ملف له في النظام.</CardDescription>
            </CardHeader>
            <CardContent>
                <ClientForm
                    initialData={initialData}
                    onSave={handleSave}
                    onClose={() => router.back()}
                    isSaving={isSaving}
                />
            </CardContent>
        </Card>
    );
}
