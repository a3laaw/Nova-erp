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
import { collection, query, orderBy, doc, deleteDoc, where } from 'firebase/firestore';
import type { Item, ItemCategory } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Package, MoreHorizontal, Pencil, Trash2, Search, PlusCircle } from 'lucide-react';
import { Badge } from '../ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Input } from '../ui/input';
import { searchItems } from '@/lib/cache/fuse-search';
import { ItemForm } from './item-form';

interface ItemsListProps {
  selectedCategoryId: string | null;
}

const getItemTypeDisplay = (item: Item): { label: string; color: string } => {
    if (item.itemType === 'service') {
        return { label: 'خدمة', color: 'bg-purple-100 text-purple-800' };
    }
    if (item.inventoryTracked) {
        return { label: 'منتج مخزني', color: 'bg-blue-100 text-blue-800' };
    }
    return { label: 'منتج استهلاكي', color: 'bg-orange-100 text-orange-800' };
};


export function ItemsList({ selectedCategoryId }: ItemsListProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');

  const itemsQueryConstraints = useMemo(() => {
    const constraints = [];
    if (selectedCategoryId) {
      constraints.push(where('categoryId', '==', selectedCategoryId));
    }
    // No need to order here, will sort client-side after augmenting.
    return constraints;
  }, [selectedCategoryId]);

  const { data: items, loading: itemsLoading, error: itemsError } = useSubscription<Item>(firestore, 'items', itemsQueryConstraints);
  const { data: categories, loading: categoriesLoading, error: categoriesError } = useSubscription<ItemCategory>(firestore, 'itemCategories');

  const loading = itemsLoading || categoriesLoading;

  const categoryMap = useMemo(() => {
    if (!categories) return new Map();
    return new Map(categories.map(cat => [cat.id, cat.name]));
  }, [categories]);

  const filteredItems = useMemo(() => {
    const augmentedItems = (items || []).map(item => ({
        ...item,
        categoryName: categoryMap.get(item.categoryId) || 'غير مصنف'
    })).sort((a,b) => a.name.localeCompare(b.name, 'ar'));

    return searchItems(augmentedItems, searchQuery);
  }, [items, searchQuery, categoryMap]);
  
  const handleDelete = async () => {
    if (!itemToDelete || !firestore) return;
    setIsDeleting(true);
    try {
        await deleteDoc(doc(firestore, 'items', itemToDelete.id!));
        toast({ title: 'نجاح', description: 'تم حذف الصنف بنجاح.' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف الصنف.' });
    } finally {
        setIsDeleting(false);
        setItemToDelete(null);
    }
  };
  
  const handleAdd = () => {
    setSelectedItem(null);
    setIsFormOpen(true);
  };
  
  const handleEdit = (item: Item) => {
    setSelectedItem(item);
    setIsFormOpen(true);
  };
  
  if (itemsError || categoriesError) {
      return <div className="text-center py-10 text-destructive">فشل تحميل البيانات.</div>;
  }

  return (
    <>
        <div className="flex justify-between items-center mb-4">
            <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="ابحث بالاسم، الكود (SKU)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 rtl:pr-10"
                />
            </div>
            <Button onClick={handleAdd} size="sm"><PlusCircle className="ml-2 h-4"/> إضافة صنف جديد</Button>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>الكود (SKU)</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>التصنيف</TableHead>
                <TableHead className="text-left">سعر البيع</TableHead>
                <TableHead className="text-left">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {loading && Array.from({length: 5}).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                ))}
                {!loading && filteredItems.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                            {searchQuery ? 'لا توجد نتائج تطابق بحثك.' : 'لم يتم إضافة أي أصناف بعد.'}
                        </TableCell>
                    </TableRow>
                )}
                {!loading && filteredItems.map((item) => {
                    const typeDisplay = getItemTypeDisplay(item);
                    return (
                        <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell className="font-mono">{item.sku}</TableCell>
                            <TableCell>
                                <Badge variant="outline" className={typeDisplay.color}>
                                    {typeDisplay.label}
                                </Badge>
                            </TableCell>
                            <TableCell>{item.categoryName as string}</TableCell>
                            <TableCell className="text-left font-mono">{formatCurrency(item.sellingPrice || 0)}</TableCell>
                            <TableCell className="text-left">
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
                    );
                })}
            </TableBody>
          </Table>
        </div>
        
        {isFormOpen && (
            <ItemForm 
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                item={selectedItem}
                categories={categories}
            />
        )}
        
        <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
            <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                    <AlertDialogTitle>هل أنت متأكد من الحذف؟</AlertDialogTitle>
                    <AlertDialogDescription>سيتم حذف الصنف "{itemToDelete?.name}" بشكل دائم.</AlertDialogDescription>
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
