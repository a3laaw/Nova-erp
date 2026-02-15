'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useFirebase, useDocument } from '@/firebase';
import { doc, updateDoc, writeBatch, serverTimestamp, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/auth-context';
import type { ConstructionProject } from '@/lib/types';
import { ProjectForm } from '@/components/construction/project-form';
import { cleanFirestoreData } from '@/lib/utils';

export default function EditProjectPage() {
    const router = useRouter();
    const params = useParams();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    
    const [isSaving, setIsSaving] = useState(false);

    const projectRef = useMemo(() => {
        if (!firestore || !id) return null;
        return doc(firestore, 'projects', id);
    }, [firestore, id]);

    const { data: project, loading, error } = useDocument<ConstructionProject>(firestore, projectRef ? projectRef.path : null);

    const handleSave = useCallback(async (updatedData: Omit<ConstructionProject, 'id' | 'projectId' | 'createdAt'>) => {
        if (!firestore || !currentUser || !id || !project) return;
        
        setIsSaving(true);
        try {
            const updatePayload = { ...updatedData };
            await updateDoc(projectRef!, cleanFirestoreData(updatePayload));
            toast({ title: 'نجاح', description: 'تم تحديث بيانات المشروع بنجاح.' });
            router.push('/dashboard/construction/projects');
        } catch (error) {
            console.error("Error updating project:", error);
            toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: 'لم يتم حفظ التعديلات.' });
        } finally {
            setIsSaving(false);
        }
    }, [firestore, currentUser, id, project, projectRef, router, toast]);

    if (loading) {
        return (
             <Card className="max-w-4xl mx-auto" dir="rtl">
                <CardHeader>
                     <Skeleton className="h-8 w-48" />
                     <Skeleton className="h-4 w-64 mt-2" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-96 w-full" />
                </CardContent>
            </Card>
        )
    }
    
    if (error || !project) {
        return <p className="text-center text-destructive">خطأ في تحميل بيانات المشروع.</p>;
    }

    return (
        <Card className="max-w-4xl mx-auto" dir="rtl">
            <CardHeader>
                <CardTitle>تعديل مشروع مقاولات</CardTitle>
                <CardDescription>
                    تعديل تفاصيل المشروع: {project.projectName}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ProjectForm
                    initialData={project}
                    onSave={handleSave}
                    onClose={() => router.back()}
                    isSaving={isSaving}
                />
            </CardContent>
        </Card>
    );
}
