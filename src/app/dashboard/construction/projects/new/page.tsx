
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
import { doc, runTransaction, collection, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import type { ConstructionProject } from '@/lib/types';
import { ProjectForm } from '@/components/construction/project-form';

export default function NewProjectPage() {
    const router = useRouter();
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    
    const handleSave = useCallback(async (newProjectData: Omit<ConstructionProject, 'id' | 'projectId' | 'createdAt'>) => {
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
                transaction.set(newProjectRef, finalProjectData);
            });
            
            toast({ title: 'نجاح', description: 'تم إنشاء المشروع بنجاح.' });
            router.push('/dashboard/construction/projects');
            
        } catch (error) {
            console.error("Error creating project:", error);
            const errorMessage = error instanceof Error ? error.message : 'فشل إنشاء المشروع.';
            toast({ title: "خطأ", description: errorMessage, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    }, [firestore, currentUser, toast, router]);

    return (
        <Card className="max-w-4xl mx-auto" dir="rtl">
            <CardHeader>
                <CardTitle>إنشاء مشروع مقاولات جديد</CardTitle>
                <CardDescription>أدخل تفاصيل المشروع التنفيذي لبدء إدارته.</CardDescription>
            </CardHeader>
            <CardContent>
                <ProjectForm
                    onSave={handleSave}
                    onClose={() => router.back()}
                    isSaving={isSaving}
                />
            </CardContent>
        </Card>
    );
}

