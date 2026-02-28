
'use client';

import { useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, orderBy, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import type { SubcontractorCertificate } from '@/lib/types';
import { format } from 'date-fns';
import { formatCurrency, cn } from '@/lib/utils';
import { FileCheck, MoreHorizontal, Eye, Trash2, Loader2, Search, PlusCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { toFirestoreDate } from '@/services/date-converter';

const statusColors: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
};

const statusTranslations: Record<string, string> = {
    draft: 'مسودة مراجعة',
    approved: 'معتمد للصرف',
    cancelled: 'ملغي',
};

export default function SubcontractorCertificatesPage() {
  const { firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [itemToDelete, setItemToDelete] = useState<SubcontractorCertificate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: certificates, loading } = useSubscription<SubcontractorCertificate>(firestore, 'subcontractor_certificates', [orderBy('createdAt', 'desc')]);

  const filteredCerts = useMemo(() => {
    if (!certificates) return [];
    if (!searchQuery) return certificates;
    const lower = searchQuery.toLowerCase();
    return certificates.filter(c => 
        c.certificateNumber.toLowerCase().includes(lower) || 
        c.subcontractorName.toLowerCase().includes(lower) ||
        c.projectName?.toLowerCase().includes(lower)
    );
  }, [certificates, searchQuery]);

  const formatDate = (dateValue: any) => {
    const date = toFirestoreDate(dateValue);
    return date ? format(date, 'dd/MM/yyyy') : '-';
  };

  const handleDelete = async () => {
    if (!itemToDelete || !firestore) return;
    setIsDeleting(true);
    try {
        const batch = writeBatch(firestore);
        batch.delete(doc(firestore, 'subcontractor_certificates', itemToDelete.id!));
        if (itemToDelete.journalEntryId) {
            batch.delete(doc(firestore, 'journalEntries', itemToDelete.journalEntryId));
        }
        await batch.commit();
        toast({ title: 'نجاح', description: 'تم حذف شهادة الإنجاز والقيد المرتبط بها.' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف الشهادة.' });
    } finally {
        setIsDeleting(false);
        setItemToDelete(null);
    }
  };

  return (
    <Card dir="rtl">
        <CardHeader>
            <div className="flex items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <FileCheck className="text-primary" />
                        شهادات إنجاز أعمال مقاولي الباطن
                    </CardTitle>
                    <CardDescription>إدارة واعتماد مستحقات المقاولين بناءً على نسب الإنجاز الميدانية في المشاريع.</CardDescription>
                </div>
                <Button asChild>
                    <Link href="/dashboard/construction/subcontractors/certificates/new">
                        <PlusCircle className="ml-2 h-4 w-4" />
                        إصدار شهادة جديدة
                    </Link>
                </Button>
            </div>
        </CardHeader>
        <CardContent>
            <div className="flex items-center mb-6">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="ابحث برقم الشهادة، المقاول، أو المشروع..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            <div className="border rounded-2xl overflow-hidden shadow-sm">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead>رقم الشهادة</TableHead>
                            <TableHead>المقاول</TableHead>
                            <TableHead>المشروع</TableHead>
                            <TableHead>التاريخ</TableHead>
                            <TableHead className="text-left">قيمة الإنجاز</TableHead>
                            <TableHead>الحالة</TableHead>
                            <TableHead className="w-[80px]"><span className="sr-only">الإجراءات</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && certificates.length === 0 ? (
                            <TableRow><TableCell colSpan={7} className="text-center p-8"><Loader2 className="animate-spin mx-auto text-primary" /></TableCell></TableRow>
                        ) : filteredCerts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">لا توجد شهادات مسجلة.</TableCell>
                            </TableRow>
                        ) : (
                            filteredCerts.map((cert) => (
                                <TableRow key={cert.id} className="hover:bg-muted/30 transition-colors">
                                    <TableCell className="font-mono font-bold text-primary">
                                        <Link href={`/dashboard/construction/subcontractors/certificates/${cert.id}`} className="hover:underline">
                                            {cert.certificateNumber}
                                        </Link>
                                    </TableCell>
                                    <TableCell className="font-bold">{cert.subcontractorName}</TableCell>
                                    <TableCell className="text-xs">{cert.projectName}</TableCell>
                                    <TableCell>{formatDate(cert.date)}</TableCell>
                                    <TableCell className="text-left font-mono font-black">{formatCurrency(cert.amount)}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn("font-bold px-3", statusColors[cert.status])}>
                                            {statusTranslations[cert.status]}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" dir="rtl">
                                                <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/dashboard/construction/subcontractors/certificates/${cert.id}`}>
                                                        <Eye className="ml-2 h-4 w-4" /> عرض التفاصيل
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => setItemToDelete(cert)} className="text-destructive">
                                                    <Trash2 className="ml-2 h-4 w-4" /> حذف الشهادة
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

        <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
            <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                    <AlertDialogTitle>تأكيد حذف شهادة الإنجاز؟</AlertDialogTitle>
                    <AlertDialogDescription>سيتم حذف الشهادة نهائياً مع القيد المحاسبي المرتبط بها (في حال كونه مسودة). لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                        {isDeleting ? <Loader2 className="animate-spin ml-2 h-4 w-4"/> : 'نعم، حذف'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </Card>
  );
}
