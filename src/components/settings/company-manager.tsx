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
import { MoreHorizontal, PlusCircle, ArrowRight, Building } from 'lucide-react';
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
import type { Company } from '@/lib/types';
import { CompanyForm } from './company-form';

interface CompanyManagerProps {
    onBack?: () => void;
}

export function CompanyManager({ onBack }: CompanyManagerProps) {
    const { firestore } = useFirebase();
    const { toast } = useToast();

    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

    const fetchCompanies = useCallback(async () => {
        if (!firestore) return;
        setLoading(true);
        try {
            const companiesSnapshot = await getDocs(query(collection(firestore, 'companies'), orderBy('name')));
            setCompanies(companiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Company)));
        } catch (error) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب قائمة الشركات.' });
        } finally {
            setLoading(false);
        }
    }, [firestore, toast]);

    useEffect(() => {
        fetchCompanies();
    }, [fetchCompanies]);

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
            toast({ title: 'نجاح', description: 'تم حذف الشركة.' });
            fetchCompanies();
        } catch (error) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف الشركة.' });
        } finally {
            setCompanyToDelete(null);
        }
    };

    const handleSave = async (data: Partial<Company>) => {
        if (!firestore) return;
        try {
            if (selectedCompany) { // Editing
                const companyRef = doc(firestore, 'companies', selectedCompany.id!);
                await updateDoc(companyRef, data);
                toast({ title: 'نجاح', description: 'تم تحديث بيانات الشركة.' });
            } else { // Creating
                await addDoc(collection(firestore, 'companies'), data);
                toast({ title: 'نجاح', description: 'تمت إضافة الشركة.' });
            }
            setIsFormOpen(false);
            fetchCompanies();
        } catch (error) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ بيانات الشركة.' });
        }
    };

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Building />
                        <CardTitle>إدارة الشركات</CardTitle>
                    </div>
                    {onBack && <Button onClick={onBack} variant="outline"><ArrowRight className="ml-2 h-4 w-4" /> العودة</Button>}
                </CardHeader>
                <CardContent>
                    <div className="flex justify-end mb-4">
                        <Button onClick={handleAdd} size="sm"><PlusCircle className="ml-2 h-4 w-4" /> إضافة شركة</Button>
                    </div>
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>اسم الشركة (العربية)</TableHead>
                                    <TableHead>الاسم (الإنجليزية)</TableHead>
                                    <TableHead>الهاتف</TableHead>
                                    <TableHead>العنوان</TableHead>
                                    <TableHead><span className="sr-only">الإجراءات</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    Array.from({ length: 2 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell colSpan={5}><Skeleton className="h-6 w-full" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : companies.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center h-24">لا توجد شركات</TableCell>
                                    </TableRow>
                                ) : (
                                    companies.map(company => (
                                        <TableRow key={company.id}>
                                            <TableCell className="font-medium">{company.name}</TableCell>
                                            <TableCell>{company.nameEn || '-'}</TableCell>
                                            <TableCell>{company.phone || '-'}</TableCell>
                                            <TableCell className="text-xs">{company.address || '-'}</TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" dir="rtl">
                                                        <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => handleEdit(company)}>تعديل</DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => setCompanyToDelete(company)} className="text-destructive">حذف</DropdownMenuItem>
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
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                        <AlertDialogDescription>سيتم حذف الشركة بشكل دائم. لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
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
