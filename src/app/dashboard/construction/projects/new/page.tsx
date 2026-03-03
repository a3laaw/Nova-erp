
'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirebase, useSubscription } from '@/firebase';
import { doc, runTransaction, collection, serverTimestamp, getDocs, query, orderBy, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import type { ConstructionProject, Employee, Department } from '@/lib/types';
import { ProjectForm } from '@/components/construction/project-form';
import { cleanFirestoreData } from '@/lib/utils';

export default function NewProjectPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const { data: employees = [] } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);
    const { data: departments = [] } = useSubscription<Department>(firestore, 'departments');

    const prefilledData = useMemo(() => {
        return {
            clientId: searchParams.get('clientId') || '',
            linkedTransactionId: searchParams.get('transactionId') || '',
        };
    }, [searchParams]);

    const handleSave = useCallback(async (newProjectData: any) => {
        if (!firestore || !currentUser) return;

        setIsSaving(true);
        try {
            await runTransaction(firestore, async (transaction) => {
                const currentYear = new Date().getFullYear();
                const counterRef = doc(firestore, 'counters', 'constructionProjects');
                const counterDoc = await transaction.get(counterRef);
                let nextNumber = (counterDoc.data()?.counts?.[currentYear] || 0) + 1;
                
                const newId = `PRJ-${currentYear}-${String(nextNumber).padStart(4, '0')}`;
                const newProjectRef = doc(collection(firestore, 'projects'));

                const finalProjectData = {
                    ...newProjectData,
                    projectId: newId,
                    progressPercentage: 0,
                    status: 'مخطط',
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.id,
                    companyId: currentUser.companyId || null
                };
                
                transaction.set(newProjectRef, cleanFirestoreData(finalProjectData));
                transaction.set(counterRef, { [`counts.${currentYear}`]: nextNumber }, { merge: true });

                // ربط المعاملة الأصلية بالـ BOQ والمشروع المنشأ
                if (newProjectData.linkedTransactionId) {
                    const txRef = doc(firestore, `clients/${newProjectData.clientId}/transactions/${newProjectData.linkedTransactionId}`);
                    transaction.update(txRef, { projectId: newProjectRef.id });
                }
            });
            
            toast({ title: 'تم التأسيس الفني', description: 'تم إنشاء هيكل المشروع وربطه بالعقد المعتمد بنجاح.' });
            router.push('/dashboard/construction/projects');
            
        } catch (error) {
            console.error(error);
            toast({ title: "خطأ", description: 'فشل تأسيس هيكل المشروع.', variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    }, [firestore, currentUser, toast, router]);

    return (
        <Card className="max-w-4xl mx-auto rounded-3xl shadow-xl overflow-hidden border-none" dir="rtl">
            <CardHeader className="bg-primary/5 pb-8">
                <CardTitle className="text-3xl font-black">تأسيس الهيكل الفني للمشروع</CardTitle>
                <CardDescription>الخطوة الأخيرة: أدخل المواصفات الإنشائية (المساحة، الأدوار، السرداب) لربطها بالعقد الموقّع.</CardDescription>
            </CardHeader>
            <CardContent className="p-8">
                <ProjectForm
                    initialData={prefilledData}
                    onSave={handleSave}
                    onClose={() => router.back()}
                    isSaving={isSaving}
                />
            </CardContent>
        </Card>
    );
}
