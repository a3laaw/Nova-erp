'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useFirebase } from '@/firebase';
import { doc, runTransaction, collection, serverTimestamp, getDocs, query, orderBy, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import type { ConstructionProject } from '@/lib/types';
import { ProjectForm } from '@/components/construction/project-form';
import { cleanFirestoreData } from '@/lib/utils';

/**
 * صفحة إنشاء مشروع مقاولات جديد:
 * تم تعديلها لتكون "هيكل فني" فقط تماشياً مع الدورة المستندية الاحترافية.
 * الخطوات اللاحقة: إنشاء عرض سعر -> قبول العرض -> إنشاء العقد المحاسبي وربطه بالمشروع.
 */
export default function NewProjectPage() {
    const router = useRouter();
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = useCallback(async (newProjectData: any) => {
        if (!firestore || !currentUser) return;

        setIsSaving(true);
        let newProjectId = '';

        try {
            await runTransaction(firestore, async (transaction) => {
                const currentYear = new Date().getFullYear();
                
                // 1. توليد رقم المشروع التسلسلي
                const counterRef = doc(firestore, 'counters', 'constructionProjects');
                const counterDoc = await transaction.get(counterRef);
                let nextNumber = 1;
                if (counterDoc.exists()) {
                    const counts = counterDoc.data()?.counts || {};
                    nextNumber = (counts[currentYear] || 0) + 1;
                }
                
                const newId = `PRJ-${currentYear}-${String(nextNumber).padStart(4, '0')}`;
                const newProjectRef = doc(collection(firestore, 'projects'));
                newProjectId = newProjectRef.id;

                // 2. حفظ بيانات المشروع الأساسية (بدون أثر مالي فوري)
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
                transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });

                // 3. استنساخ مراحل العمل الشجرية (WBS) إذا وجدت
                if (newProjectData.constructionTypeId) {
                    const stagesRef = collection(firestore, `construction_types/${newProjectData.constructionTypeId}/stages`);
                    const stagesSnap = await getDocs(query(stagesRef, orderBy('order')));
                    
                    for (const stageDoc of stagesSnap.docs) {
                        const templateStage = stageDoc.data();
                        const projectStageRef = doc(collection(firestore, `projects/${newProjectId}/stages`));
                        transaction.set(projectStageRef, {
                            ...templateStage,
                            templateStageId: stageDoc.id,
                            status: 'pending',
                            progress: 0,
                            createdAt: serverTimestamp(),
                        });
                    }
                }
            });
            
            toast({ title: 'تم إنشاء هيكل المشروع', description: 'تم التأسيس الفني بنجاح. يمكنك الآن البدء بإصدار عروض الأسعار المرتبطة.' });
            router.push(`/dashboard/construction/projects/${newProjectId}`);
            
        } catch (error) {
            console.error("Error creating project:", error);
            const errorMessage = error instanceof Error ? error.message : 'فشل إنشاء المشروع.';
            toast({ title: "خطأ", description: errorMessage, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    }, [firestore, currentUser, toast, router]);

    return (
        <Card className="max-w-4xl mx-auto rounded-3xl shadow-xl overflow-hidden border-none" dir="rtl">
            <CardHeader className="bg-primary/5 pb-8">
                <CardTitle className="text-3xl font-black">إنشاء مشروع مقاولات جديد</CardTitle>
                <CardDescription className="text-base font-medium">أدخل التفاصيل الفنية للمشروع وتتبع حصص التموين. يتم إنشاء العقد المالي في مرحلة لاحقة عبر عروض الأسعار.</CardDescription>
            </CardHeader>
            <CardContent className="p-8">
                <ProjectForm
                    onSave={handleSave}
                    onClose={() => router.back()}
                    isSaving={isSaving}
                />
            </CardContent>
        </Card>
    );
}
