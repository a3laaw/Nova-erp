'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { MoreHorizontal, PlusCircle, ArrowRight, Building, Copy, Pencil, Trash2, Building2 } from 'lucide-react';
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
} from "@/components/ui/alert-dialog";
import { useFirebase, useSubscription } from '@/firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import type { Company } from '@/lib/types';
import { CompanyForm } from './company-form';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';

interface CompanyManagerProps {
    onBack?: () => void;
}

export function CompanyManager({ onBack }: CompanyManagerProps) {
    const { firestore } = useFirebase();
    const { toast } = useToast();

    const { data: companies, loading, error } = useSubscription<Company>(firestore, 'companies', [orderBy('name')]);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: 'تم النسخ', description: 'تم نسخ معرف الشركة بنجاح.' });
    };

    const handleAdd = () => {
        setSelectedCompany(null);
        setIsFormOpen(true);
    };

    const handleEdit = (company: Company) => {
        setSelectedCompany(company);
        setIsFormOpen(true);
    };

    const handleDelete = async () => {
        if (!firestore || !companyToDelete) return;
        try {
            await deleteDoc(doc(firestore, 'companies', companyToDelete.id!));
            toast({ title: 'نجاح', description: 'تم حذف الشركة بنجاح.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'خطأ في الحذف' });
        } finally {
            setCompanyToDelete(null);
        }
    };

    const handleSave = async (data: Partial<Company>) => {
        if (!firestore) return;
        try {
            if (selectedCompany) { 
                await updateDoc(doc(firestore, 'companies', selectedCompany.id!), data);
                toast({ title: 'نجاح', description: 'تم تحديث بيانات الشركة.' });
            } else { 
                await addDoc(collection(firestore, 'companies'), data);
                toast({ title: 'نجاح', description: 'تمت إضافة الشركة بنجاح.' });
            }
            setIsFormOpen(false);
        } catch (error) {
            toast({ variant: 'destructive', title: 'خطأ في الحفظ' });
        }
    };

    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-sm bg-gradient-to-l from-white to-cyan-50 dark:from-card dark:to-card">
                <CardHeader className="pb-8 px-8 border-b">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-cyan-600/10 rounded-2xl text-cyan-600 shadow-inner">
                                <Building2 className="h-8 w-8" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl font-black text-cyan-900">إدارة الشركات والفروع</CardTitle>
                                <CardDescription className="text-base font-medium">تعريف الهيكل التنظيمي للشركة الأم والشركات التابعة أو الفروع.</CardDescription>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {onBack && <Button onClick={onBack} variant="ghost" className="rounded-xl font-bold gap-2 text-cyan-700 hover:bg-cyan-50"><ArrowRight className="h-4 w-4" /> العودة</Button>}
                            <Button onClick={handleAdd} className="h-11 px-8 rounded-2xl font-black text-lg gap-2 shadow-xl shadow-cyan-100 bg-cyan-600 hover:bg-cyan-700">
                                <PlusCircle className="h-5 w-5" /> إضافة منشأة جديدة
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card className="rounded-[3rem] border-none shadow-xl overflow-hidden bg-white">
                <CardContent className="pt-10">
                    <div className="border-2 rounded-[2rem] overflow-hidden shadow-inner bg-card">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow className="h-14">
                                    <TableHead className="px-10 font-black text-gray-800">اسم المنشأة</TableHead>
                                    <TableHead className="font-black text-gray-800">النشاط</TableHead>
                                    <TableHead className="font-black text-gray-800">المعرف الفريد (ID)</TableHead>
                                    <TableHead className="text-center font-black text-gray-800">الارتباط</TableHead>
                                    <TableHead className="w-[100px] text-center"><span className="sr-only">الإجراءات</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    Array.from({ length: 2 }).map((_, i) => (
                                        <TableRow key={i}><TableCell colSpan={5} className="px-10 py-6"><Skeleton className="h-10 w-full rounded-2xl"/></TableCell></TableRow>
                                    ))
                                ) : companies.length === 0 ? (
                                    <TableRow><TableCell colSpan={5} className="h-64 text-center text-muted-foreground italic font-bold">لا توجد شركات مسجلة حالياً.</TableCell></TableRow>
                                ) : (
                                    companies.map(company => (
                                        <TableRow key={company.id} className="hover:bg-cyan-50/30 transition-colors h-24 border-b last:border-0 group">
                                            <TableCell className="px-10">
                                                <div className="flex flex-col">
                                                    <span className="font-black text-gray-800 text-lg">{company.name}</span>
                                                    <span className="text-[10px] text-muted-foreground font-mono">{company.nameEn}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="bg-white text-cyan-700 border-cyan-100 font-bold px-3">
                                                    {company.activityType || 'نشاط عام'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 bg-muted/50 w-fit px-3 py-1 rounded-xl border group-hover:bg-white transition-colors">
                                                    <span className="font-mono text-[10px] text-muted-foreground">{company.id}</span>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-cyan-600" onClick={() => copyToClipboard(company.id!)}>
                                                        <Copy className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {company.parentCompanyId ? (
                                                    <div className="flex flex-col items-center">
                                                        <Badge variant="secondary" className="text-[8px] h-4">شركة تابعة</Badge>
                                                        <span className="font-mono text-[9px] mt-1 opacity-40">{company.parentCompanyId.substring(0,8)}...</span>
                                                    </div>
                                                ) : <Badge variant="outline" className="bg-slate-50 opacity-40">منشأة رئيسية</Badge>}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-11 w-11 rounded-2xl border bg-white shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"><MoreHorizontal className="h-5 w-5" /></Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" dir="rtl" className="rounded-2xl shadow-2xl border-none p-2">
                                                        <DropdownMenuLabel className="font-black px-3 py-2">خيارات المنشأة</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => handleEdit(company)} className="gap-2 rounded-xl py-3 font-bold">
                                                            <Pencil className="h-4 w-4 text-primary"/> تعديل البيانات
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => setCompanyToDelete(company)} className="text-destructive gap-2 rounded-xl py-3 font-bold focus:bg-red-50">
                                                            <Trash2 className="h-4 w-4" /> حذف المنشأة نهائياً
                                                        </DropdownMenuItem>
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
                <CompanyForm
                    isOpen={isFormOpen}
                    onClose={() => setIsFormOpen(false)}
                    onSave={handleSave}
                    company={selectedCompany}
                />
            )}

            <AlertDialog open={!!companyToDelete} onOpenChange={() => setCompanyToDelete(null)}>
                <AlertDialogContent dir="rtl" className="rounded-[2.5rem] p-10 border-none shadow-2xl">
                    <AlertDialogHeader>
                        <div className="p-3 bg-red-100 rounded-2xl text-red-600 w-fit mb-4 shadow-inner"><Building className="h-10 w-10"/></div>
                        <AlertDialogTitle className="text-2xl font-black text-red-700">تأكيد حذف المنشأة؟</AlertDialogTitle>
                        <AlertDialogDescription className="text-lg font-medium leading-relaxed">
                            سيتم حذف شركة <strong>"{companyToDelete?.name}"</strong> بشكل نهائي. تأكد من عدم وجود حركات مالية أو موظفين مرتبطين بهذه الشركة قبل الحذف.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-8 gap-3">
                        <AlertDialogCancel className="rounded-xl font-bold h-12 px-8">إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 rounded-xl font-black h-12 px-12 shadow-lg">نعم، حذف نهائي</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}