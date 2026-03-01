
'use client';

import React, { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Pencil, Trash2, FileSignature, Construction, Briefcase } from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import type { ContractTemplate } from '@/lib/types';
import { ContractTemplateForm } from '@/components/settings/contract-template-form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

function TemplateList({
  templates,
  onEdit,
  onDelete,
  loading,
  emptyMessage,
  accentColor,
}: {
  templates: ContractTemplate[];
  onEdit: (template: ContractTemplate) => void;
  onDelete: (template: ContractTemplate) => void;
  loading: boolean;
  emptyMessage: string;
  accentColor: string;
}) {
  return (
    <div className="space-y-3">
      {loading ? (
        Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
      ) : templates.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-3xl bg-muted/5">
          <FileSignature className="mx-auto h-12 w-12 text-muted-foreground opacity-20 mb-3" />
          <p className="text-muted-foreground font-medium">{emptyMessage}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(template => (
            <Card key={template.id} className={cn("group hover:shadow-md transition-all border-2 border-transparent rounded-2xl overflow-hidden", `hover:border-${accentColor}/20`)}>
              <CardHeader className="pb-3 bg-muted/10">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg font-black">{template.title}</CardTitle>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => onEdit(template)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-full" onClick={() => onDelete(template)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                <CardDescription className="line-clamp-2 text-xs min-h-[32px]">{template.description || 'لا يوجد وصف متاح لهذا النموذج.'}</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                <span>{template.financials?.milestones.length || 0} دفعات</span>
                <Badge variant="secondary" className="h-5 px-2">جاهز للاستخدام</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ContractsPage() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<ContractTemplate | null>(null);
  const [activeType, setActiveType] = useState<'Consulting' | 'Execution'>('Consulting');
  
  const templatesQuery = useMemo(() => {
    if (!firestore) return null;
    return [orderBy('title')];
  }, [firestore]);
  
  const { data: templates, loading } = useSubscription<ContractTemplate>(firestore, 'contractTemplates', templatesQuery || []);

  const { consultingTemplates, executionTemplates } = useMemo(() => {
      const consulting: ContractTemplate[] = [];
      const execution: ContractTemplate[] = [];
      (templates || []).forEach(t => {
          if (t.templateType === 'Execution') execution.push(t);
          else consulting.push(t);
      });
      return { consultingTemplates: consulting, executionTemplates: execution };
  }, [templates]);

  const handleAdd = () => {
    setSelectedTemplate(null);
    setIsFormOpen(true);
  };

  const handleEdit = (template: ContractTemplate) => {
    setSelectedTemplate(template);
    // Ensure we open in the correct mode based on the template
    setActiveType(template.templateType || 'Consulting');
    setIsFormOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!firestore || !templateToDelete) return;
    try {
      await deleteDoc(doc(firestore, 'contractTemplates', templateToDelete.id!));
      toast({ title: 'نجاح', description: 'تم حذف نموذج العقد بنجاح.' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف النموذج.' });
    } finally {
      setTemplateToDelete(null);
    }
  };
  
  return (
    <div className="space-y-6" dir="rtl">
      <Card className={cn(
        "rounded-3xl border-none shadow-sm transition-all duration-500",
        activeType === 'Consulting' 
          ? "bg-gradient-to-l from-white to-sky-50 dark:from-card dark:to-card" 
          : "bg-gradient-to-l from-white to-amber-50 dark:from-card dark:to-card"
      )}>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="space-y-1 text-center md:text-right">
              <CardTitle className="text-2xl font-black flex items-center justify-center md:justify-start gap-3">
                <FileSignature className={cn("h-7 w-7", activeType === 'Consulting' ? "text-primary" : "text-amber-600")} />
                مكتبة نماذج العقود
              </CardTitle>
              <CardDescription>إدارة وتوحيد صيغ العقود والدفعات المالية للشركة بناءً على أنواع العمل.</CardDescription>
            </div>
            <Button 
              onClick={handleAdd} 
              className={cn(
                "h-12 px-8 rounded-2xl font-black text-lg gap-2 shadow-xl transition-all",
                activeType === 'Consulting' ? "bg-primary shadow-primary/20" : "bg-amber-600 hover:bg-amber-700 shadow-amber-200"
              )}
            >
              <PlusCircle className="h-6 w-6" />
              إنشاء نموذج جديد
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Tabs 
        value={activeType} 
        onValueChange={(v) => setActiveType(v as any)} 
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2 h-auto p-1 bg-muted/50 rounded-2xl mb-8">
          <TabsTrigger 
            value="Consulting" 
            className="py-4 rounded-xl gap-2 font-bold data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg"
          >
            <Briefcase className="h-5 w-5" />
            عقود الاستشارات الهندسية
          </TabsTrigger>
          <TabsTrigger 
            value="Execution" 
            className="py-4 rounded-xl gap-2 font-bold data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:shadow-lg"
          >
            <Construction className="h-5 w-5" />
            عقود المقاولات والإنشاءات
          </TabsTrigger>
        </TabsList>

        <TabsContent value="Consulting" className="animate-in fade-in slide-in-from-right-4 duration-300">
          <TemplateList
            templates={consultingTemplates}
            loading={loading}
            onEdit={handleEdit}
            onDelete={setTemplateToDelete}
            accentColor="primary"
            emptyMessage="لا توجد نماذج عقود استشارية حالياً."
          />
        </TabsContent>

        <TabsContent value="Execution" className="animate-in fade-in slide-in-from-left-4 duration-300">
          <TemplateList
            templates={executionTemplates}
            loading={loading}
            onEdit={handleEdit}
            onDelete={setTemplateToDelete}
            accentColor="amber-600"
            emptyMessage="لا توجد نماذج عقود مقاولات حالياً."
          />
        </TabsContent>
      </Tabs>
      
      {isFormOpen && (
        <ContractTemplateForm
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSaveSuccess={() => {}}
          template={selectedTemplate}
          initialType={activeType}
        />
      )}

      <AlertDialog open={!!templateToDelete} onOpenChange={() => setTemplateToDelete(null)}>
        <AlertDialogContent dir="rtl" className="rounded-3xl">
            <AlertDialogHeader>
                <AlertDialogTitle className="text-xl font-black">حذف نموذج العقد؟</AlertDialogTitle>
                <AlertDialogDescription>
                    هل أنت متأكد من رغبتك في حذف النموذج "{templateToDelete?.title}"؟ لا يؤثر هذا على العقود الموقعة مسبقاً، ولكنه سيختفي من قائمة القوالب الجديدة.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
                <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90 rounded-xl font-bold">نعم، حذف</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
