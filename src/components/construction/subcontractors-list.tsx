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
import { useFirebase } from '@/firebase';
import { useSubscription } from '@/hooks/use-subscription';
import { collection, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import type { Subcontractor } from '@/lib/types';
import { MoreHorizontal, Pencil, Trash2, Search, PlusCircle, Star } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Input } from '../ui/input';
import Fuse from 'fuse.js';
import { SubcontractorForm } from './subcontractor-form';

export function SubcontractorsList() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  
  const [itemToDelete, setItemToDelete] = useState<Subcontractor | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Subcontractor | null>(null);

  const subcontractorsQuery = useMemo(() => [orderBy('name', 'asc')], []);
  const { data: subcontractors, loading, error } = useSubscription<Subcontractor>(firestore, 'subcontractors', subcontractorsQuery);

  const fuse = new Fuse(subcontractors, {
    keys: ['name', 'type', 'contactPerson', 'phone'],
    threshold: 0.4,
  });

  const filteredItems = useMemo(() => {
    if (!searchQuery) return subcontractors;
    return fuse.search(searchQuery).map(result => result.item);
  }, [subcontractors, searchQuery]);

  const handleDelete = async () => {
    if (!itemToDelete || !firestore) return;
    setIsDeleting(true);
    try {
        await deleteDoc(doc(firestore, 'subcontractors', itemToDelete.id!));
        toast({ title: 'نجاح', description: 'تم حذف المقاول بنجاح.' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف المقاول.' });
    } finally {
        setIsDeleting(false);
        setItemToDelete(null);
    }
  };

  const handleAdd = () => {
    setSelectedItem(null);
    setIsFormOpen(true);
  };
  
  const handleEdit = (item: Subcontractor) => {
    setSelectedItem(item);
    setIsFormOpen(true);
  };

  if (error) {
      return <div className="text-center py-10 text-destructive">فشل تحميل قائمة المقاولين.</div>;
  }

  return (
    <>
        <div className="flex justify-between items-center mb-4">
            <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="ابحث بالاسم، النوع، جهة الاتصال..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 rtl:pr-10"
                />
            </div>
            <Button onClick={handleAdd} size="sm"><PlusCircle className="ml-2 h-4"/> إضافة مقاول</Button>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>اسم المقاول</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>جهة الاتصال</TableHead>
                <TableHead>الهاتف</TableHead>
                <TableHead className="text-center">التقييم</TableHead>
                <TableHead>الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {loading && Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                ))}
                {!loading && filteredItems.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="h-24 text-center">لا توجد بيانات.</TableCell></TableRow>
                )}
                {!loading && filteredItems.map((item) => (
                    <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.type}</TableCell>
                        <TableCell>{item.contactPerson || '-'}</TableCell>
                        <TableCell>{item.phone || '-'}</TableCell>
                        <TableCell className="text-center">
                            <div className="flex justify-center items-center gap-1">
                                {item.performanceRating || '-'}
                                {item.performanceRating && <Star className="h-4 w-4 text-yellow-400 fill-yellow-400"/>}
                            </div>
                        </TableCell>
                        <TableCell>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" dir="rtl">
                                    <DropdownMenuItem onClick={() => handleEdit(item)}><Pencil className="ml-2 h-4"/> تعديل</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setItemToDelete(item)} className="text-destructive focus:text-destructive"><Trash2 className="ml-2 h-4"/> حذف</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
        
        {isFormOpen && (
            <SubcontractorForm
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                subcontractor={selectedItem}
            />
        )}
        
         <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
            <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                    <AlertDialogTitle>هل أنت متأكد من الحذف؟</AlertDialogTitle>
                    <AlertDialogDescription>سيتم حذف المقاول "{itemToDelete?.name}" بشكل دائم.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                        {isDeleting ? 'جاري الحذف...' : 'نعم، قم بالحذف'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
  );
}
