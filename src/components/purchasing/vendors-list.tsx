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
import type { Vendor } from '@/lib/types';
import { Building, MoreHorizontal, Pencil, Trash2, Search, PlusCircle } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Input } from '../ui/input';
import { searchVendors } from '@/lib/cache/fuse-search';
import { VendorForm } from './vendor-form';

export function VendorsList() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  
  const [itemToDelete, setItemToDelete] = useState<Vendor | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

  const vendorsQueryConstraints = useMemo(() => [orderBy('name', 'asc')], []);
  const { data: vendors, loading, error } = useSubscription<Vendor>(firestore, 'vendors', vendorsQueryConstraints);

  const filteredVendors = useMemo(() => {
    return searchVendors(vendors, searchQuery);
  }, [vendors, searchQuery]);

  const handleDelete = async () => {
    if (!itemToDelete || !firestore) return;
    setIsDeleting(true);
    try {
        await deleteDoc(doc(firestore, 'vendors', itemToDelete.id!));
        toast({ title: 'نجاح', description: 'تم حذف المورد بنجاح.' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف المورد.' });
    } finally {
        setIsDeleting(false);
        setItemToDelete(null);
    }
  };

  const handleAdd = () => {
    setSelectedVendor(null);
    setIsFormOpen(true);
  };
  
  const handleEdit = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setIsFormOpen(true);
  };

  if (error) {
      return <div className="text-center py-10 text-destructive">فشل تحميل قائمة الموردين.</div>;
  }

  return (
    <>
        <div className="flex justify-between items-center mb-4">
            <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="ابحث بالاسم، جهة الاتصال..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 rtl:pr-10"
                />
            </div>
            <Button onClick={handleAdd} size="sm"><PlusCircle className="ml-2 h-4"/> إضافة مورد جديد</Button>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>اسم المورد</TableHead>
                <TableHead>جهة الاتصال</TableHead>
                <TableHead>الهاتف</TableHead>
                <TableHead>البريد الإلكتروني</TableHead>
                <TableHead>الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {loading && Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                ))}
                {!loading && filteredVendors.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={5}>
                            <div className="p-8 text-center border-2 border-dashed rounded-lg">
                                <Building className="mx-auto h-12 w-12 text-muted-foreground" />
                                <h3 className="mt-4 text-lg font-medium">لا يوجد موردون</h3>
                                <p className="mt-2 text-sm text-muted-foreground">ابدأ بإضافة مورد جديد ليظهر هنا.</p>
                            </div>
                        </TableCell>
                    </TableRow>
                ) : (
                    filteredVendors.map((vendor) => (
                        <TableRow key={vendor.id}>
                            <TableCell className="font-medium">{vendor.name}</TableCell>
                            <TableCell>{vendor.contactPerson || '-'}</TableCell>
                            <TableCell>{vendor.phone || '-'}</TableCell>
                            <TableCell>{vendor.email || '-'}</TableCell>
                            <TableCell>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" dir="rtl">
                                        <DropdownMenuItem onClick={() => handleEdit(vendor)}><Pencil className="ml-2 h-4 w-4"/> تعديل</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setItemToDelete(vendor)} className="text-destructive focus:text-destructive"><Trash2 className="ml-2 h-4 w-4" /> حذف</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))
                )}
            </TableBody>
          </Table>
        </div>
        
        <VendorForm
            isOpen={isFormOpen}
            onClose={() => setIsFormOpen(false)}
            vendor={selectedVendor}
        />
        
         <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
            <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                    <AlertDialogTitle>هل أنت متأكد من الحذف؟</AlertDialogTitle>
                    <AlertDialogDescription>سيتم حذف المورد "{itemToDelete?.name}" بشكل دائم.</AlertDialogDescription>
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
