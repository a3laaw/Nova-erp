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
import { doc, runTransaction, collection, serverTimestamp, updateDoc, query, where, getDocs, writeBatch, deleteField } from 'firebase/firestore';
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
    
    const fromAppointmentId = searchParams.get('fromAppointmentId');
    
    const handleSave = useCallback(async (newClientData: Partial<Client>) => {
        if (!firestore || !currentUser) return;
        
        setIsSaving(true);
        let newClientId = '';

        try {
            // --- NEW VALIDATION LOGIC ---
            if (newClientData.mobile) {
                const mobileQuery = query(collection(firestore, 'clients'), where('mobile', '==', newClientData.mobile));
                const mobileSnapshot = await getDocs(mobileQuery);
                if (!mobileSnapshot.empty) {
                    throw new Error('رقم الهاتف هذا مسجل بالفعل لعميل آخر.');
                }
                
                // This validation is only necessary if we are NOT coming from an appointment.
                if (!fromAppointmentId) {
                    const prospectiveClientQuery = query(collection(firestore, 'appointments'), where('clientMobile', '==', newClientData.mobile));
                    const prospectiveSnapshot = await getDocs(prospectiveClientQuery);
                    if (!prospectiveSnapshot.empty) {
                        throw new Error('رقم الهاتف هذا مستخدم لموعد عميل محتمل. الرجاء إنشاء ملف العميل من داخل الموعد.');
                    }
                }
            }
            // --- END OF VALIDATION ---

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

                // This logic is now superseded by the global appointment update below,
                // but we leave it inside the transaction for the `fromAppointmentId` case.
                if(fromAppointmentId) {
                    const apptRef = doc(firestore, 'appointments', fromAppointmentId);
                    transaction.update(apptRef, {
                        clientId: newClientId,
                        clientName: deleteField(),
                        clientMobile: deleteField(),
                    });
                }
            });

            toast({ title: 'نجاح', description: 'تمت إضافة العميل بنجاح.' });

            // After successful client creation, find and update all prospective appointments
            if (newClientData.mobile && newClientId) {
                const appointmentsRef = collection(firestore, 'appointments');
                const q = query(appointmentsRef, where('clientMobile', '==', newClientData.mobile));
                const appointmentsToUpdateSnap = await getDocs(q);

                if (!appointmentsToUpdateSnap.empty) {
                    const updateBatch = writeBatch(firestore);
                    appointmentsToUpdateSnap.forEach(apptDoc => {
                        const apptRef = doc(firestore, 'appointments', apptDoc.id);
                        updateBatch.update(apptRef, {
                            clientId: newClientId,
                            clientName: deleteField(),
                            clientMobile: deleteField()
                        });
                    });
                    await updateBatch.commit();
                    toast({ title: 'تحديث تلقائي', description: `تم ربط ${appointmentsToUpdateSnap.size} مواعيد محتملة بملف العميل الجديد.` });
                }
            }
            
            // Notification logic
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
    }, [firestore, currentUser, toast, router, fromAppointmentId]);

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
