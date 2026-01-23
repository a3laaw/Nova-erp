'use client';
import { useState, useEffect } from 'react';
import { useFirebase } from '@/firebase';
import { collection, getDocs, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import type { ContractTemplate } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, MoreHorizontal, FileText, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ContractTemplateForm } from './contract-template-form'; 

export function ContractTemplateManager() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<ContractTemplate | null>(null);

  const fetchTemplates = async () => {
    if (!firestore) return;
    setLoading(true);
    try {
      const q = query(collection(firestore, 'contractTemplates'), orderBy('title'));
      const snapshot = await getDocs(q);
      setTemplates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContractTemplate)));
    } catch (e) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب نماذج العقود.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [firestore]);

  const handleAdd = () => {
    setSelectedTemplate(null);
    setIsFormOpen(true);
  };

  const handleEdit = (template: ContractTemplate) => {
    setSelectedTemplate(template);
    setIsFormOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!firestore || !templateToDelete) return;
    try {
      await deleteDoc(doc(firestore, 'contractTemplates', templateToDelete.id!));
      toast({ title: 'نجاح', description: 'تم حذف النموذج بنجاح.' });
      setTemplates(prev => prev.filter(t => t.id !== templateToDelete.id));
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
          <div className="flex items-center justify-between">
              <div>
                  <CardTitle>نماذج العقود</CardTitle>
                  <CardDescription>
                  إدارة نماذج العقود المستخدمة في النظام كنقاط انطلاق لإنشاء عقود العملاء.
                  </CardDescription>
              </div>
              <Button onClick={handleAdd} size="sm" className="gap-1">
                  <PlusCircle className="ml-2 h-4 w-4" />
                  إضافة نموذج جديد
              </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="text-lg font-semibold mt-4">لا توجد نماذج عقود بعد</h3>
              <p className="text-muted-foreground mt-2">
                  انقر على "إضافة نموذج جديد" للبدء في إنشاء أول نموذج عقد لك.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {templates.map(template => (
                <Card key={template.id} className="flex flex-col">
                  <CardHeader>
                    <CardTitle className="flex justify-between items-start">
                      {template.title}
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 -mt-2 -mr-2"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" dir="rtl">
                              <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => handleEdit(template)}>تعديل</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setTemplateToDelete(template)} className="text-destructive">حذف</DropdownMenuItem>
                          </DropdownMenuContent>
                      </DropdownMenu>
                    </CardTitle>
                    <CardDescription className="line-clamp-2">{template.description || 'لا يوجد وصف'}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-xs text-muted-foreground">مرتبط بـ {template.transactionTypes?.length || 0} أنواع معاملات</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {isFormOpen && (
        <ContractTemplateForm
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSaveSuccess={fetchTemplates}
          template={selectedTemplate}
        />
      )}

      <AlertDialog open={!!templateToDelete} onOpenChange={() => setTemplateToDelete(null)}>
        <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
                <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                <AlertDialogDescription>
                    هل أنت متأكد من رغبتك في حذف النموذج "{templateToDelete?.title}"؟ لا يمكن التراجع عن هذا الإجراء.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">نعم، قم بالحذف</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
