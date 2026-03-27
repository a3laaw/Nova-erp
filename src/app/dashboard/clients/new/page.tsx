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
import { doc, runTransaction, collection, serverTimestamp, query, where, getDocs, writeBatch, deleteField } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import type { Client } from '@/lib/types';
import { ClientForm } from '@/components/clients/client-form';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';
import { getTenantPath, cleanFirestoreData } from '@/lib/utils';

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
    const tenantId = currentUser?.currentCompanyId;

    const handleSave = useCallback(async (newClientData: Partial<Client>) => {
        if (!firestore || !currentUser) return;
        
        setIsSaving(true);
        let newClientId = '';

        try {
            const clientsCollectionPath = getTenantPath('clients', tenantId);
            
            // --- VALIDATION (Isolated to the current tenant) ---
            if (newClientData.mobile) {
                const mobileQuery = query(collection(firestore, clientsCollectionPath), where('mobile', '==', newClientData.mobile));
                const mobileSnapshot = await getDocs(mobileQuery);
                if (!mobileSnapshot.empty) {
                    throw new Error('رقم الهاتف هذا مسجل بالفعل لعميل آخر في هذه المنشأة.');
                }
            }

            await runTransaction(firestore, async (transaction) => {
                const currentYear = String(new Date().getFullYear());
                const counterPath = getTenantPath('counters/clientFiles', tenantId);
                const clientFileCounterRef = doc(firestore, counterPath);
                const clientFileCounterDoc = await transaction.get(clientFileCounterRef);
                
                let nextFileNumber = 1;
                if (clientFileCounterDoc.exists()) {
                    const counts = clientFileCounterDoc.data()?.counts || {};
                    nextFileNumber = (counts[currentYear] || 0) + 1;
                }
                
                transaction.set(clientFileCounterRef, { counts: { [currentYear]: nextFileNumber } }, { merge: true });
                const newFileId = `${nextFileNumber}/${currentYear}`;

                const finalClientData = {
                  ...newClientData,
                  fileId: newFileId,
                  fileNumber: nextFileNumber,
                  fileYear: parseInt(currentYear, 10),
                  status: 'new' as const,
                  transactionCounter: 0,
                  createdAt: serverTimestamp(),
                  isActive: true,
                  companyId: tenantId || null // 🛡️ التاج السيادي
                };

                const newClientRef = doc(collection(firestore, clientsCollectionPath));
                newClientId = newClientRef.id;
                transaction.set(newClientRef, cleanFirestoreData(finalClientData));

                if(fromAppointmentId) {
                    const apptPath = getTenantPath(`appointments/${fromAppointmentId}`, tenantId);
                    transaction.update(doc(firestore, apptPath), {
                        clientId: newClientId,
                        clientName: deleteField(),
                        clientMobile: deleteField(),
                    });
                }
            });

            toast({ title: 'نجاح التأسيس', description: 'تم إنشاء ملف العميل وحفظه في سجلات المنشأة.' });
            router.push(`/dashboard/clients/${newClientId}`);

        } catch (error: any) {
            toast({ title: "خطأ", description: error.message, variant: "destructive" });
            setIsSaving(false);
        }
    }, [firestore, currentUser, toast, router, fromAppointmentId, tenantId]);

    return (
        <Card className="max-w-2xl mx-auto rounded-[2.5rem] border-none shadow-2xl overflow-hidden" dir="rtl">
            <CardHeader className="bg-primary/5 pb-8 border-b">
                <CardTitle className="text-2xl font-black">إضافة عميل جديد</CardTitle>
                <CardDescription className="text-base font-medium">إنشاء ملف فني ومالي معزول للعميل في المنشأة الحالية.</CardDescription>
            </CardHeader>
            <CardContent className="p-8">
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
