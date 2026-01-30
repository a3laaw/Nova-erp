'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, PlusCircle, FileText, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

import { useLanguage } from '@/context/language-context';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, orderBy, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import type { Contract, ContractTemplate } from '@/lib/types';
import { ContractTemplateForm } from '@/components/settings/contract-template-form';


// --- Sub-component for listing created contracts ---
function CreatedContractsList() {
  const { language } = useLanguage();
  const { firestore } = useFirebase();

  const contractsQueryConstraints = useMemo(() => {
    return [orderBy('createdAt', 'desc')];
  }, []);

  const { data: contracts, loading, error } = useSubscription<Contract>(firestore, 'contracts', contractsQueryConstraints);

  const formatDate = (dateValue: any) => {
    if (!dateValue) return '-';
    try {
        const date = dateValue.toDate();
        return format(date, 'dd/MM/yyyy');
    } catch(e) {
        return '-';
    }
  };

  const t = language === 'ar' ? {
    noContracts: 'لا توجد عقود محفوظة بعد.',
    contractTitle: 'عنوان العقد',
    clientName: 'اسم العميل',
    contractDate: 'تاريخ العقد',
    totalAmount: 'القيمة الإجمالية',
    actions: 'الإجراءات',
  } : {
    noContracts: 'No saved contracts yet.',
    contractTitle: 'Contract Title',
    clientName: 'Client Name',
    contractDate: 'Contract Date',
    totalAmount: 'Total Amount',
    actions: 'Actions',
  };

  return (
    <>
        <div className="border rounded-lg">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>{t.contractTitle}</TableHead>
                        <TableHead>{t.clientName}</TableHead>
                        <TableHead>{t.contractDate}</TableHead>
                        <TableHead className="text-left">{t.totalAmount}</TableHead>
                        <TableHead><span className="sr-only">{t.actions}</span></TableHead>
                    </TableRow>
                </TableHeader>
                 <TableBody>
                    {loading && Array.from({length: 3}).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell colSpan={5}><Skeleton className="h-6 w-full" /></TableCell>
                        </TableRow>
                    ))}
                    {!loading && contracts.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center">
                                {t.noContracts}
                            </TableCell>
                        </TableRow>
                    )}
                    {!loading && contracts.map(contract => (
                        <TableRow key={contract.id}>
                            <TableCell className="font-medium">{contract.title}</TableCell>
                            <TableCell>
                                <Link href={`/dashboard/clients/${contract.clientId}`} className="hover:underline">
                                    {contract.clientName}
                                </Link>
                            </TableCell>
                            <TableCell>{formatDate(contract.contractDate)}</TableCell>
                            <TableCell className="text-left font-mono">{formatCurrency(contract.financials.totalAmount - contract.financials.discount)}</TableCell>
                            <TableCell className="text-center">
                                <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    </>
  );
}

// --- Sub-component for managing contract templates ---
function ContractTemplateManager() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<ContractTemplate | null>(null);

  const fetchTemplates = useCallback(async () => {
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
  }, [firestore, toast]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

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
        <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
                إدارة نماذج العقود المستخدمة كنقاط انطلاق لإنشاء عقود العملاء.
            </p>
            <Button onClick={handleAdd} size="sm" className="gap-1">
                <PlusCircle className="ml-2 h-4 w-4" />
                إضافة نموذج جديد
            </Button>
        </div>
        
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

// --- Main Page Component ---
export default function ContractsPage() {
  const { language } = useLanguage();

  const t = language === 'ar' ? {
    title: 'إدارة العقود',
    description: 'عرض العقود التي تم إنشاؤها وإدارة النماذج القابلة لإعادة الاستخدام. يتم إنشاء العقود الجديدة من داخل صفحة العميل.',
    contracts: 'العقود المنشأة',
    templates: 'نماذج العقود',
  } : {
    title: 'Contract Management',
    description: 'View created contracts and manage reusable templates. New contracts are created from the client page.',
    contracts: 'Created Contracts',
    templates: 'Contract Templates',
  };

  return (
    <Card dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="contracts" dir="rtl">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="contracts">{t.contracts}</TabsTrigger>
            <TabsTrigger value="templates">{t.templates}</TabsTrigger>
          </TabsList>
          <TabsContent value="contracts" className="mt-4">
            <CreatedContractsList />
          </TabsContent>
          <TabsContent value="templates" className="mt-4">
            <ContractTemplateManager />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
