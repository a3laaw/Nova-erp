
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
import { collection, query, orderBy, doc, deleteDoc, where } from 'firebase/firestore';
import type { Item, ItemCategory } from '@/lib/types';
import { formatCurrency, cn } from '@/lib/utils';
import { Package, MoreHorizontal, Pencil, Trash2, Search, PlusCircle, History } from 'lucide-react';
import { Badge } from '../ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Input } from '../ui/input';
import { searchItems } from '@/lib/cache/fuse-search';
import { ItemForm } from './item-form';
import Link from 'next/link';

interface ItemsListProps {
  selectedCategoryId: string | null;
}

const getItemTypeDisplay = (item: Item): { label: string; color: string } => {
    if (item.itemType === 'service') {
        return { label: 'خدمة', color: 'bg-purple-100 text-purple-800 border-purple-200' };
    }
    if (item.inventoryTracked) {
        return { label: 'صنف مخزني', color: 'bg-blue-100 text-blue-800 border-blue-200' };
    }
    return { label: 'صنف استهلاكي', color: 'bg-orange-100 text-orange-800 border-orange-200' };
};


export function ItemsList({ selectedCategoryId }: ItemsListProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();
  
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
    return constraints;
  }, [selectedCategoryId]);

  const { data: items, loading: itemsLoading, error: itemsError } = useSubscription<Item>(firestore, 'items', itemsQueryConstraints);
  const { data: categories, loading: categoriesLoading, error: categoriesError } = useSubscription<ItemCategory>(firestore, 'itemCategories');

  const loading = itemsLoading || categoriesLoading;

  const categoryMap = useMemo(() => {
    if (!categories) return new Map();
    return new Map(categories.map(cat => [cat.id, cat]));
  }, [categories]);

  const filteredItems = useMemo(() => {
    let augmentedItems = (items || []).map(item => {
        const cat = categoryMap.get(item.categoryId);
        return {
            ...item,
            categoryName: cat?.name || 'غير مصنف'
        };
    });

    return searchItems(augmentedItems, searchQuery).sort((a,b) => a.name.localeCompare(b.name, 'ar'));
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
      return <div className="text-center py-10 text-destructive font-bold">فشل تحميل بيانات الأصناف.</div>;
  }

  return (
    <>
        <div className="flex flex-col gap-4 mb-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="ابحث بالاسم، الكود (SKU)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 rtl:pr-10 h-11 rounded-xl shadow-sm"
                    />
                </div>
                <Button onClick={handleAdd} className="h-11 px-6 rounded-xl font-bold gap-2">
                    <PlusCircle className="h-5 w-5"/> إضافة صنف جديد
                </Button>
            </div>
        </div>

        <div className="border rounded-2xl overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>الكود (SKU)</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>الفئة</TableHead>
                <TableHead className="text-left">سعر البيع</TableHead>
                <TableHead className="text-center w-[100px]">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {loading ? (
                    Array.from({length: 5}).map((_, i) => (
                        <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-14 w-full" /></TableCell></TableRow>
                    ))
                ) : filteredItems.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={6} className="h-48 text-center">
                            <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                                <Package className="h-12 w-12 opacity-20" />
                                <p className="font-bold">{searchQuery ? 'لا توجد نتائج تطابق بحثك.' : 'لم يتم إضافة أي أصناف بعد.'}</p>
                            </div>
                        </TableCell>
                    </TableRow>
                ) : (
                    filteredItems.map((item) => {
                        const typeDisplay = getItemTypeDisplay(item);
                        return (
                            <TableRow key={item.id} className="group hover:bg-muted/30 transition-colors">
                                <TableCell className="font-bold text-foreground/80">
                                    {item.name}
                                </TableCell>
                                <TableCell className="font-mono text-xs opacity-60">{item.sku}</TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={cn("px-2 font-bold", typeDisplay.color)}>
                                        {typeDisplay.label}
                                    </Badge>
                                </TableCell>
                                <TableCell>{item.categoryName as string}</TableCell>
                                <TableCell className="text-left font-mono font-bold text-primary">{formatCurrency(item.sellingPrice || 0)}</TableCell>
                                <TableCell className="text-center">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full"><MoreHorizontal className="h-4 w-4" /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" dir="rtl" className="w-48">
                                            <DropdownMenuLabel>خيارات الصنف</DropdownMenuLabel>
                                            <DropdownMenuItem onClick={() => handleEdit(item)}>
                                                <Pencil className="ml-2 h-4 w-4"/> تعديل البيانات
                                            </DropdownMenuItem>
                                            <DropdownMenuItem asChild>
                                                <Link href={`/dashboard/warehouse/reports/item-movement?itemId=${item.id}`}>
                                                    <History className="ml-2 h-4 w-4" /> حركة الصنف
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={() => setItemToDelete(item)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                                <Trash2 className="ml-2 h-4 w-4"/> حذف الصنف
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        );
                    })
                )}
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
                    <AlertDialogTitle className="text-destructive font-black text-xl">تأكيد حذف الصنف؟</AlertDialogTitle>
                    <AlertDialogDescription>
                        هل أنت متأكد من رغبتك في حذف الصنف <span className="font-bold text-foreground">"{itemToDelete?.name}"</span>؟ 
                        سيتم حذف كافة البيانات المرتبطة به ولا يمكن التراجع عن هذا الإجراء.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting} className="rounded-xl">إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90 rounded-xl font-bold">
                        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin ml-2"/> : 'نعم، حذف نهائي'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
  );
}
