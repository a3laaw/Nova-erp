'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, FileText, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import type { ContractTemplate } from '@/lib/types';
import { ContractTemplateForm } from '@/components/settings/contract-template-form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

function TemplateListCard({
  title,
  templates,
  onAdd,
  onEdit,
  onDelete,
  loading,
}: {
  title: string;
  templates: ContractTemplate[];
  onAdd: () => void;
  onEdit: (template: ContractTemplate) => void;
  onDelete: (template: ContractTemplate) => void;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        <Button size="sm" onClick={onAdd}><PlusCircle className="ml-2 h-4 w-4" /> إضافة نموذج</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        {!loading && templates.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">لا توجد نماذج.</div>
        )}
        {!loading && templates.map(template => (
          <div key={template.id} className="flex items-center justify-between p-2 border rounded-md">
            <div>
              <p className="font-semibold">{template.title}</p>
              <p className="text-xs text-muted-foreground">{template.description || 'لا يوجد وصف'}</p>
            </div>
            <div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(template)}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(template)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function ContractsPage() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<ContractTemplate | null>(null);
  const [initialTemplateType, setInitialTemplateType] = useState<'Consulting' | 'Execution'>('Consulting');
  
  const templatesQuery = useMemo(() => {
    if (!firestore) return null;
    return [orderBy('title')];
  }, [firestore]);
  
  // The hook will automatically update when a document is deleted.
  const { data: templates, loading } = useSubscription<ContractTemplate>(firestore, 'contractTemplates', templatesQuery || []);

  const { consultingTemplates, executionTemplates } = useMemo(() => {
      const consulting: ContractTemplate[] = [];
      const execution: ContractTemplate[] = [];
      (templates || []).forEach(t => {
          if (t.templateType === 'Execution') {
              execution.push(t);
          } else {
              consulting.push(t);
          }
      });
      return { consultingTemplates: consulting, executionTemplates: execution };
  }, [templates]);

  const handleAdd = (type: 'Consulting' | 'Execution') => {
    setSelectedTemplate(null);
    setInitialTemplateType(type);
    setIsFormOpen(true);
  };

  const handleEdit = (template: ContractTemplate) => {
    setSelectedTemplate(template);
    setInitialTemplateType(template.templateType || 'Consulting');
    setIsFormOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!firestore || !templateToDelete) return;
    try {
      await deleteDoc(doc(firestore, 'contractTemplates', templateToDelete.id!));
      toast({ title: 'نجاح', description: 'تم حذف النموذج.' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف النموذج.' });
    } finally {
      setTemplateToDelete(null);
    }
  };
  
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>إدارة نماذج العقود</CardTitle>
          <CardDescription>
            أنشئ وأدر نماذج العقود الاستشارية والتنفيذية لإعادة استخدامها عند إنشاء عقود العملاء.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <TemplateListCard
            title="نماذج عقود الاستشارات"
            templates={consultingTemplates}
            loading={loading}
            onAdd={() => handleAdd('Consulting')}
            onEdit={handleEdit}
            onDelete={setTemplateToDelete}
          />
          <TemplateListCard
            title="نماذج عقود التنفيذ"
            templates={executionTemplates}
            loading={loading}
            onAdd={() => handleAdd('Execution')}
            onEdit={handleEdit}
            onDelete={setTemplateToDelete}
          />
        </CardContent>
      </Card>
      
      {isFormOpen && (
        <ContractTemplateForm
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSaveSuccess={() => { /* Real-time, so no refetch needed */ }}
          template={selectedTemplate}
          initialType={initialTemplateType}
        />
      )}

      <AlertDialog open={!!templateToDelete} onOpenChange={() => setTemplateToDelete(null)}>
        <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
                <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                <AlertDialogDescription>
                    هل أنت متأكد من رغبتك في حذف النموذج "{templateToDelete?.title}"؟
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">حذف</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

    