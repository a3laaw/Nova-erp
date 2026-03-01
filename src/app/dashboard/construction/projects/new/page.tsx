
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
import { doc, runTransaction, collection, serverTimestamp, getDocs, query, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import type { ConstructionProject } from '@/lib/types';
import { ProjectForm } from '@/components/construction/project-form';
import { cleanFirestoreData } from '@/lib/utils';

export default function NewProjectPage() {
    const router = useRouter();
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    
    const handleSave = useCallback(async (newProjectData: any) => {
        if (!firestore || !currentUser) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'لا يمكن الاتصال بقاعدة البيانات أو تحديد المستخدم.' });
            return;
        }

        setIsSaving(true);
        let newProjectId = '';

        try {
            await runTransaction(firestore, async (transaction) => {
                const currentYear = new Date().getFullYear();
                const counterRef = doc(firestore, 'counters', 'constructionProjects');
                const counterDoc = await transaction.get(counterRef);
                
                let nextNumber = 1;
                if (counterDoc.exists()) {
                    const counts = counterDoc.data()?.counts || {};
                    nextNumber = (counts[currentYear] || 0) + 1;
                }
                
                transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
                const newId = `PRJ-${currentYear}-${String(nextNumber).padStart(4, '0')}`;

                const finalProjectData = {
                    ...newProjectData,
                    projectId: newId,
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.id,
                };
                
                const newProjectRef = doc(collection(firestore, 'projects'));
                newProjectId = newProjectRef.id;
                transaction.set(newProjectRef, cleanFirestoreData(finalProjectData));

                // --- استنساخ مراحل العمل الشجرية من القالب المختار ---
                if (newProjectData.constructionTypeId) {
                    const stagesRef = collection(firestore, `construction_types/${newProjectData.constructionTypeId}/stages`);
                    const stagesSnap = await getDocs(query(stagesRef, orderBy('order')));
                    
                    if (!stagesSnap.empty) {
                        // سنقوم بنسخ المراحل إلى مجموعة فرعية داخل المشروع الفعلي
                        // ملاحظة: في Firestore، المجموعات الفرعية لا تُنسخ مباشرة، بل ننشئ سجلات جديدة
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
                }
            });
            
            toast({ title: 'نجاح', description: 'تم إنشاء المشروع واستنساخ مراحل العمل بنجاح.' });
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
                <CardDescription className="text-base">أدخل تفاصيل المشروع التنفيذي لبدء إدارته بنظام الـ WBS المعتمد.</CardDescription>
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
