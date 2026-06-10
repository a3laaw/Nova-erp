'use client';

import { useState, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useFirebase } from '@/firebase';
import { doc, runTransaction, collection, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import type { Client } from '@/lib/types';
import { ClientForm } from '@/components/clients/client-form';
import { getTenantPath, cleanFirestoreData } from '@/lib/utils';
import { UserPlus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

function NewClientContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    
    const [isSaving, setIsSaving] = useState(false);
    
    const initialData = useMemo(() => ({
        nameAr: searchParams.get('nameAr') || '',
        mobile: searchParams.get('mobile') || '',
        assignedEngineer: searchParams.get('engineerId') || '',
    }), [searchParams]);
    
    const tenantId = currentUser?.currentCompanyId;

    const handleSave = useCallback(async (newClientData: Partial<Client>) => {
        if (!firestore || !currentUser || !tenantId) return;
        
        setIsSaving(true);
        const clientsCollectionPath = getTenantPath('clients', tenantId);

        try {
            const mobileQuery = query(collection(firestore, clientsCollectionPath), where('mobile', '==', newClientData.mobile));
            const mobileSnapshot = await getDocs(mobileQuery);
            if (!mobileSnapshot.empty) {
                throw new Error('رقم الهاتف هذا مسجل بالفعل لعميل آخر.');
            }

            await runTransaction(firestore, async (transaction) => {
                const counterRef = doc(firestore, getTenantPath('counters/clientFiles', tenantId)!);
                const counterDoc = await transaction.get(counterRef);
                
                const currentYear = new Date().getFullYear().toString();
                const counts = counterDoc.data()?.counts || {};
                const nextFileNumber = (counts[currentYear] || 0) + 1;
                
                transaction.set(counterRef, { counts: { [currentYear]: nextFileNumber } }, { merge: true });
                const newFileNumberFormatted = `${nextFileNumber}/${currentYear}`;

                const newClientRef = doc(collection(firestore, clientsCollectionPath));

                const finalClientData = {
                  ...newClientData,
                  id: newClientRef.id, // Make ID available for history path
                  fileNumber: newFileNumberFormatted,
                  status: 'active' as const,
                  createdAt: serverTimestamp(),
                  companyId: tenantId,
                  createdBy: currentUser.id,
                };

                transaction.set(newClientRef, cleanFirestoreData(finalClientData));

                // ✅ PATTERN: Add initial history log entry
                const historyRef = doc(collection(firestore, getTenantPath(`clients/${newClientRef.id}/history`, tenantId)!));
                transaction.set(historyRef, {
                    type: 'log',
                    content: `تم إنشاء ملف العميل بواسطة ${currentUser.fullName}.`,
                    createdAt: serverTimestamp(),
                    userId: currentUser.id,
                    userName: currentUser.fullName,
                    userAvatar: currentUser.avatarUrl,
                    companyId: tenantId
                });
            });

            toast({ title: '✅ نجاح', description: 'تم إنشاء ملف العميل الرسمي وتوثيقه في السجل.' });
            router.push(`/dashboard/clients`);

        } catch (error: any) {
            toast({ title: "فشل الحفظ", description: error.message, variant: "destructive" });
        }
        finally {
            setIsSaving(false);
        }
    }, [firestore, currentUser, toast, router, tenantId]);

    return (
        <Card className="max-w-4xl mx-auto rounded-[2rem] shadow-xl border" dir="rtl">
            <CardHeader className="border-b bg-gray-50 rounded-t-[2rem] p-6">
                <CardTitle className="flex items-center gap-3 text-xl font-bold">
                    <UserPlus className='h-7 w-7'/>
                    إنشاء ملف عميل رسمي
                </CardTitle>
                <CardDescription>إدخال بيانات عميل جديد لفتح ملف رسمي له في النظام.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
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

export default function NewClientPage() {
    return (
        <Suspense fallback={<div className="p-8 max-w-4xl mx-auto"><Skeleton className="h-[600px] w-full rounded-2xl" /></div>}>
            <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
              <NewClientContent />
            </div>
        </Suspense>
    );
}
