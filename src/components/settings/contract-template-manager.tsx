'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { MoreHorizontal, PlusCircle, ArrowRight, FileText } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
} from "@/components/ui/alert-dialog";
import { useFirebase } from '@/firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import type { ContractTemplate } from '@/lib/types';
import { ContractTemplateForm } from './contract-template-form';

interface ContractTemplateManagerProps {
    onBack: () => void;
}

export function ContractTemplateManager({ onBack }: ContractTemplateManagerProps) {
    const { firestore } = useFirebase();
    const { toast } = useToast();

    const [templates, setTemplates] = useState<ContractTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [templateToDelete, setTemplateToDelete] = useState<ContractTemplate | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null);

    const fetchTemplates = useCallback(async () => {
        if (!firestore) return;
        setLoading(true);
        try {
            const templatesSnapshot = await getDocs(query(collection(firestore, 'contractTemplates'), orderBy('title')));
            setTemplates(templatesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContractTemplate)));
        } catch (error) {
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

    const handleDelete = async () => {
        if (!firestore || !templateToDelete) return;
        try {
            await deleteDoc(doc(firestore, 'contractTemplates', templateToDelete.id!));
            toast({ title: 'نجاح', description: 'تم حذف النموذج.' });
            fetchTemplates();
        } catch (error) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف النموذج.' });
        } finally {
            setTemplateToDelete(null);
        }
    };

    const handleSave = async (data: Partial<ContractTemplate>) => {
        if (!firestore) return;
        try {
            if (selectedTemplate) {
                const templateRef = doc(firestore, 'contractTemplates', selectedTemplate.id!);
                await updateDoc(templateRef, data);
                toast({ title: 'نجاح', description: 'تم تحديث النموذج.' });
            } else {
                await addDoc(collection(firestore, 'contractTemplates'), data);
                toast({ title: 'نجاح', description: 'تمت إضافة النموذج.' });
            }
            setIsFormOpen(false);
            fetchTemplates();
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ النموذج.' });
        }
    };

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                        <FileText />
                        <CardTitle>إدارة نماذج العقود</CardTitle>
                    </div>
                    <Button onClick={onBack} variant="outline"><ArrowRight className="ml-2 h-4 w-4" /> العودة</Button>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-end mb-4">
                        <Button onClick={handleAdd} size="sm"><PlusCircle className="ml-2 h-4 w-4" /> إضافة نموذج</Button>
                    </div>
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>عنوان النموذج</TableHead>
                                    <TableHead>أنواع المعاملات المرتبطة</TableHead>
                                    <TableHead>عدد البنود</TableHead>
                                    <TableHead><span className="sr-only">الإجراءات</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    Array.from({ length: 2 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell colSpan={4}><Skeleton className="h-6 w-full" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : templates.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center h-24">لا توجد نماذج عقود</TableCell>
                                    </TableRow>
                                ) : (
                                    templates.map(template => (
                                        <TableRow key={template.id}>
                                            <TableCell className="font-medium">{template.title}</TableCell>
                                            <TableCell className="text-xs">{(template.transactionTypes || []).join(', ')}</TableCell>
                                            <TableCell>{template.clauses?.length || 0}</TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" dir="rtl">
                                                        <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => handleEdit(template)}>تعديل</DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => setTemplateToDelete(template)} className="text-destructive">حذف</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {isFormOpen && (
                <ContractTemplateForm
                    isOpen={isFormOpen}
                    onClose={() => setIsFormOpen(false)}
                    onSave={handleSave}
                    template={selectedTemplate}
                />
            )}

            <AlertDialog open={!!templateToDelete} onOpenChange={() => setTemplateToDelete(null)}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                        <AlertDialogDescription>سيتم حذف النموذج بشكل دائم. لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">نعم، حذف</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
