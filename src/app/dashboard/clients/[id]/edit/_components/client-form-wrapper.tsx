'use client';

import { useCallback, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useFirebase, useDocument } from '@/firebase';
import { doc, writeBatch, serverTimestamp, collection } from 'firebase/firestore';
import { useAuth } from '@/context/auth-context';
import { ClientForm } from '@/components/clients/client-form';
import { getTenantPath, cleanFirestoreData } from '@/lib/utils';
import { PageHeader, PageHeaderTitle, PageHeaderDescription } from '@/components/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import type { Client } from '@/lib/types';

export function ClientFormWrapper() {
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;

  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  
  const [isSaving, setIsSaving] = useState(false);

  const tenantId = currentUser?.currentCompanyId;

  // ✅ PATTERN: Use useDocument for real-time data fetching
  const clientPath = useMemo(() => 
    (clientId && tenantId) ? getTenantPath(`clients/${clientId}`, tenantId) : null,
    [clientId, tenantId]
  );

  const { data: initialData, loading: isLoading, error } = useDocument<Client>(firestore, clientPath);

  // ✅ PATTERN: Use writeBatch for atomic updates with history logging
  const handleSave = useCallback(async (updatedData: any) => {
    if (!firestore || !currentUser || !tenantId || !clientId) return;

    setIsSaving(true);
    const batch = writeBatch(firestore);

    try {
      // 1. Update the client document
      const clientRef = doc(firestore, getTenantPath(`clients/${clientId}`, tenantId)!);
      const dataToSave = {
        ...updatedData,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.id,
      };
      batch.update(clientRef, cleanFirestoreData(dataToSave));

      // 2. Create a history log entry
      const historyRef = doc(collection(firestore, getTenantPath(`clients/${clientId}/history`, tenantId)!));
      batch.set(historyRef, {
        type: 'log',
        content: `قام ${currentUser.fullName} بتحديث البيانات الأساسية للعميل.`,
        createdAt: serverTimestamp(),
        userId: currentUser.id,
        userName: currentUser.fullName,
        userAvatar: currentUser.avatarUrl,
        companyId: tenantId
      });

      await batch.commit();

      toast({ title: '✅ تم التحديث بنجاح', description: 'تم حفظ بيانات العميل وتوثيق التغيير في السجل.' });
      router.push(`/dashboard/clients/${clientId}`);

    } catch (error: any) {
      toast({ title: "فشل الحفظ", description: "حدث خطأ أثناء محاولة تحديث البيانات.", variant: "destructive" });
      // You might want to use the errorEmitter here in a real scenario
      console.error("Failed to update client:", error);
    } finally {
      setIsSaving(false);
    }
  }, [firestore, currentUser, toast, router, tenantId, clientId]);

  if (isLoading) {
    return (
        <div className="space-y-4" dir="rtl">
            <PageHeader>
              <Skeleton className="h-10 w-1/2" />
              <Skeleton className="h-6 w-3/4" />
            </PageHeader>
            <div className="space-y-8 pt-4">
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
            </div>
        </div>
    );
  }

  if (error || !initialData) {
      toast({ variant: 'destructive', title: 'خطأ فادح', description: 'لم نتمكن من العثور على العميل المطلوب أو تحميل بياناته.' });
      router.push('/dashboard/clients');
      return null; 
  }

  return (
    <div dir="rtl">
      <PageHeader>
        <PageHeaderTitle>تعديل بيانات العميل</PageHeaderTitle>
        <PageHeaderDescription>
          تحديث المعلومات الأساسية لملف العميل: {initialData?.nameAr}
        </PageHeaderDescription>
      </PageHeader>

      <ClientForm
        onSave={handleSave}
        onClose={() => router.push(`/dashboard/clients/${clientId}`)}
        initialData={initialData}
        isSaving={isSaving}
      />
    </div>
  );
}
