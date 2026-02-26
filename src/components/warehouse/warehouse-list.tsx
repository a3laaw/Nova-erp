
'use client';

import { useMemo, useState } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, orderBy, doc, deleteDoc, where, getDocs } from 'firebase/firestore';
import type { Warehouse, ConstructionProject } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Pencil, Trash2, MapPin, Building } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface WarehouseListProps {
    onEdit: (warehouse: Warehouse) => void;
}

export function WarehouseList({ onEdit }: WarehouseListProps) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [itemToDelete, setItemToDelete] = useState<Warehouse | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { data: warehouses, loading: warehousesLoading } = useSubscription<Warehouse>(firestore, 'warehouses', [orderBy('name')]);
    const { data: projects } = useSubscription<ConstructionProject>(firestore, 'projects');
    const projectsMap = useMemo(() => new Map(projects.map(p => [p.id, p.projectName])), [projects]);

    const handleDelete = async () => {
        if (!itemToDelete || !firestore) return;
        setIsDeleting(true);
        try {
            // Check if there are stock items in this warehouse before deleting (MVP simulation)
            await deleteDoc(doc(firestore, 'warehouses', itemToDelete.id!));
            toast({ title: 'نجاح', description: 'تم حذف المستودع بنجاح.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف المستودع.' });
        } finally {
            setIsDeleting(false);
            setItemToDelete(null);
        }
    };

    if (warehousesLoading) return <Skeleton className="h-48 w-full rounded-xl" />;

    return (
        <>
            <div className="border rounded-xl overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead>اسم المستودع</TableHead>
                            <TableHead>الموقع / المشروع المرتبط</TableHead>
                            <TableHead>النوع</TableHead>
                            <TableHead className="w-[100px] text-center">الإجراءات</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {warehouses.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                                    لا توجد مستودعات معرفة حالياً.
                                </TableCell>
                            </TableRow>
                        ) : (
                            warehouses.map(warehouse => (
                                <TableRow key={warehouse.id}>
                                    <TableCell className="font-bold flex items-center gap-2">
                                        {warehouse.name}
                                        {warehouse.isDefault && <Badge className="bg-green-100 text-green-800 border-green-200">الافتراضي</Badge>}
                                    </TableCell>
                                    <TableCell>
                                        {warehouse.projectId ? (
                                            <div className="flex items-center gap-2 text-blue-600">
                                                <Building className="h-4 w-4" />
                                                <span>{projectsMap.get(warehouse.projectId) || 'مشروع غير معروف'}</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <MapPin className="h-4 w-4" />
                                                <span>{warehouse.location || 'مخزن عام'}</span>
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">
                                            {warehouse.projectId ? 'مخزن موقع' : 'مخزن رئيسي'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" dir="rtl">
                                                <DropdownMenuLabel>خيارات المستودع</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => onEdit(warehouse)}><Pencil className="ml-2 h-4 w-4" /> تعديل</DropdownMenuItem>
                                                {!warehouse.isDefault && (
                                                    <DropdownMenuItem onClick={() => setItemToDelete(warehouse)} className="text-destructive"><Trash2 className="ml-2 h-4 w-4" /> حذف</DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد حذف المستودع؟</AlertDialogTitle>
                        <AlertDialogDescription>سيتم حذف المستودع "{itemToDelete?.name}" نهائياً. تأكد من خلوه من أي أرصدة مخزنية قبل الحذف.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                            {isDeleting ? <Loader2 className="animate-spin h-4 w-4" /> : 'حذف نهائي'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
