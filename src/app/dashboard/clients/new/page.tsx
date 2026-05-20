'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useFirebase } from '@/firebase';
import { doc, runTransaction, collection, serverTimestamp, query, where, getDocs, deleteField } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import type { Client } from '@/lib/types';
import { ClientForm } from '@/components/clients/client-form';
import { getTenantPath, cleanFirestoreData } from '@/lib/utils';

/**
 * صفحة إضافة عميل جديد:
 * تم إصلاح محرك المزامنة لضمان تسجيل رقم الجوال والاسم القادمين من الميدان بشكل آلي.
 */
export default function NewClientPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    
    const [isSaving, setIsSaving] = useState(false);
    
    // 🛡️ استخلاص البيانات القادمة من رادار المواعيد لضمان المزامنة
    const initialData = useMemo(() => ({
        nameAr: searchParams.get('nameAr') || '',
        mobile: searchParams.get('mobile') || '',
        assignedEngineer: searchParams.get('engineerId') || '',
    }), [searchParams]);
    
    const fromAppointmentId = searchParams.get('fromAppointmentId');
    const tenantId = currentUser?.currentCompanyId;

    const handleSave = useCallback(async (newClientData: Partial<Client>) => {
        if (!firestore || !currentUser || !tenantId) return;
        
        setIsSaving(true);
        const clientsCollectionPath = getTenantPath('clients', tenantId);

        try {
            const mobileQuery = query(collection(firestore, clientsCollectionPath), where('mobile', '==', newClientData.mobile));
            const mobileSnapshot = await getDocs(mobileQuery);
            if (!mobileSnapshot.empty) {
                throw new Error('رقم الهاتف هذا مسجل بالفعل لعميل آخر في هذه المنشأة الموحدة.');
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
                  companyId: tenantId
                };

                const newClientRef = doc(collection(firestore, clientsCollectionPath));
                const newClientId = newClientRef.id;
                transaction.set(newClientRef, cleanFirestoreData(finalClientData));

                // الربط التلقائي للمواعيد السابقة والحالية بالملف الرسمي الجديد
                const apptsPath = getTenantPath('appointments', tenantId);
                const apptsQuery = query(collection(firestore, apptsPath), where('clientMobile', '==', newClientData.mobile));
                const apptsSnapshot = await getDocs(apptsQuery);

                apptsSnapshot.forEach(apptDoc => {
                    transaction.update(apptDoc.ref, {
                        clientId: newClientId,
                        clientName: deleteField(),
                        clientMobile: deleteField(),
                        updatedAt: serverTimestamp()
                    });
                });
            });

            toast({ title: 'نجاح المزامنة', description: 'تم إنشاء ملف العميل وربط تاريخه الميداني آلياً.' });
            router.push(`/dashboard/clients`);

        } catch (error: any) {
            toast({ title: "فشل الحفظ", description: error.message, variant: "destructive" });
            setIsSaving(false);
        }
    }, [firestore, currentUser, toast, router, tenantId]);

    return (
        <Card className="max-w-2xl mx-auto rounded-[2.5rem] border-none shadow-2xl overflow-hidden" dir="rtl">
            <CardHeader className="bg-primary/5 pb-8 border-b">
                <CardTitle className="text-2xl font-black">إكمال بيانات الملف الرسمي</CardTitle>
                <CardDescription className="text-base font-medium">سيقوم النظام آلياً بدمج كافة المواعيد السابقة المرتبطة بهذا الرقم في السجل الرسمي.</CardDescription>
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

import { useMemo } from 'react';