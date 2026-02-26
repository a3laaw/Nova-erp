'use client';
import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Ban, Loader2, MoreHorizontal, Eye, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useFirebase, useSubscription } from '@/firebase';
import { where, orderBy, doc, deleteDoc } from 'firebase/firestore';
import type { InventoryAdjustment } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { toFirestoreDate } from '@/services/date-converter';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

export default function AdjustmentsPage() {
    const { firestore } = useFirebase();
    const router = useRouter();
    const { toast } = useToast();
    const [itemToDelete, setItemToDelete] = useState<any | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    
    const adjQuery = useMemo(() => [
        where('type', 'in', ['damage', 'theft', 'other']),
        orderBy('date', 'desc')
    ], []);
    
    const { data: adjustments, loading } = useSubscription<InventoryAdjustment>(firestore, 'inventoryAdjustments', adjQuery);

    const typeTranslations: Record<string, string> = {
        damage: 'تلف مواد',
        theft: 'فقد / سرقة',
        other: 'تسوية أخرى'
    };

    const handleDelete = async () => {
        if (!itemToDelete || !firestore) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(firestore, 'inventoryAdjustments', itemToDelete.id!));
            toast({ title: 'نجاح', description: 'تم حذف إذن التسوية بنجاح.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف الإذن.' });
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
                            <Ban className="text-destructive" />
                            تسويات المخزون (تلف / فقد)
                        </CardTitle>
                        <CardDescription>تسجيل ومعالجة المواد التالفة أو المفقودة لضمان دقة الجرد.</CardDescription>
                    </div>
                    <Button asChild variant="destructive" size="sm">
                        <Link href="/dashboard/warehouse/adjustments/new">
                            <PlusCircle className="ml-2 h-4 w-4" />
                            تسجيل تسوية جديدة
                        </Link>
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>رقم الإذن</TableHead>
                                <TableHead>التاريخ</TableHead>
                                <TableHead>النوع</TableHead>
                                <TableHead>الملاحظات</TableHead>
                                <TableHead className="text-left">قيمة الخسارة</TableHead>
                                <TableHead className="w-[80px]"><span className="sr-only">الإجراءات</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading && adjustments.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="text-center p-8"><Loader2 className="animate-spin mx-auto text-primary"/></TableCell></TableRow>
                            ) : adjustments.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">لا توجد تسويات مسجلة.</TableCell></TableRow>
                            ) : (
                                adjustments.map(adj => (
                                    <TableRow key={adj.id}>
                                        <TableCell className="font-mono font-bold text-primary">
                                            <Link href={`/dashboard/warehouse/adjustments/${adj.id}`} className="hover:underline">
                                                {adj.adjustmentNumber}
                                            </Link>
                                        </TableCell>
                                        <TableCell>{toFirestoreDate(adj.date) ? format(toFirestoreDate(adj.date)!, 'dd/MM/yyyy') : '-'}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={adj.type === 'theft' ? 'bg-red-50 text-red-700' : ''}>
                                                {typeTranslations[adj.type] || adj.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">{adj.notes || '-'}</TableCell>
                                        <TableCell className="text-left font-mono text-red-600">
                                            {formatCurrency(adj.items?.reduce((sum, i) => sum + i.totalCost, 0) || 0)}
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" dir="rtl">
                                                    <DropdownMenuItem onClick={() => router.push(`/dashboard/warehouse/adjustments/${adj.id}`)}>
                                                        <Eye className="ml-2 h-4 w-4" /> عرض / طباعة
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => setItemToDelete(adj)} className="text-destructive">
                                                        <Trash2 className="ml-2 h-4 w-4" /> حذف
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
                        <AlertDialogTitle>تأكيد حذف إذن التسوية؟</AlertDialogTitle>
                        <AlertDialogDescription>سيتم حذف سجل التسوية من النظام. يرجى التأكد من مراجعة القيد المحاسبي المرتبط يدوياً.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                            {isDeleting ? 'جاري الحذف...' : 'نعم، حذف'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}
