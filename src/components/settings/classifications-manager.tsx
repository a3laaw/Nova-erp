'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, orderBy, doc, addDoc, updateDoc, deleteDoc, writeBatch, getDocs, collectionGroup } from 'firebase/firestore';
import type { ItemCategory } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from '../ui/scroll-area';
import { PlusCircle, Pencil, Trash2, Loader2, Save, Folder, FolderOpen, DownloadCloud } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { InlineSearchList } from '../ui/inline-search-list';
import { defaultItemCategories } from '@/lib/default-reference-data';

interface CategoryNode extends ItemCategory {
  children: CategoryNode[];
}

function CategoryItem({
  node,
  level,
  onEdit,
  onDelete,
  onAddSub,
  openCategories,
  setOpenCategories,
}: {
  node: CategoryNode;
  level: number;
  onEdit: (item: ItemCategory) => void;
  onDelete: (item: ItemCategory) => void;
  onAddSub: (parent: ItemCategory) => void;
  openCategories: Set<string>;
  setOpenCategories: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  const isOpen = openCategories.has(node.id!);

  const toggleOpen = () => {
    setOpenCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(node.id!)) {
        newSet.delete(node.id!);
      } else {
        newSet.add(node.id!);
      }
      return newSet;
    });
  };

  return (
    <div style={{ paddingRight: `${level * 1.5}rem` }}>
      <div className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 group">
        <div className="flex items-center gap-2 cursor-pointer" onClick={toggleOpen}>
          {node.children.length > 0 && (
            <Button variant="ghost" size="icon" className="h-6 w-6">
              {isOpen ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
            </Button>
          )}
          <span className={cn("font-medium", node.children.length === 0 && "ml-10")}>{node.name}</span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onAddSub(node)}><PlusCircle className="h-4 w-4 text-primary" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(node)}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(node)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
      {isOpen && node.children.map(child => (
        <CategoryItem
          key={child.id}
          node={child}
          level={level + 1}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddSub={onAddSub}
          openCategories={openCategories}
          setOpenCategories={setOpenCategories}
        />
      ))}
    </div>
  );
}

export function ClassificationsManager() {
    const { firestore } = useFirebase();
    const { toast } = useToast();

    const { data: categories, loading } = useSubscription<ItemCategory>(firestore, 'itemCategories');
    const [openCategories, setOpenCategories] = useState(new Set<string>());

    const categoryTree = useMemo(() => {
        if (!categories) return [];
        const map = new Map<string, ItemCategory & { children: any[] }>();
        const roots: (ItemCategory & { children: any[] })[] = [];

        categories.forEach(cat => {
            map.set(cat.id!, { ...cat, children: [] });
        });

        categories.forEach(cat => {
            if (cat.parentCategoryId && map.has(cat.parentCategoryId)) {
                map.get(cat.parentCategoryId)!.children.push(map.get(cat.id!)!);
            } else {
                roots.push(map.get(cat.id!)!);
            }
        });

        const sortRecursive = (nodes: (ItemCategory & { children: any[] })[]) => {
            nodes.sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name, 'ar'));
            nodes.forEach(node => {
                if (node.children.length > 0) {
                    sortRecursive(node.children);
                }
            });
        };
        sortRecursive(roots);

        return roots;
    }, [categories]);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<ItemCategory | null>(null);
    const [itemToDelete, setItemToDelete] = useState<ItemCategory | null>(null);
    const [parentCategory, setParentCategory] = useState<ItemCategory | null>(null);
    const [itemName, setItemName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);
    
    const categoryOptions = useMemo(() => {
        if (!categories) return [];
        return categories
          .filter(cat => cat.id !== editingItem?.id) // Prevent self-parenting
          .map(cat => ({ value: cat.id!, label: cat.name }));
    }, [categories, editingItem]);

    const openDialog = (item: ItemCategory | null, parent: ItemCategory | null = null) => {
        setEditingItem(item);
        setParentCategory(parent);
        setItemName(item?.name || '');
        setIsDialogOpen(true);
    };

    const closeDialog = () => {
        setIsDialogOpen(false);
        setEditingItem(null);
        setParentCategory(null);
        setItemName('');
    };

    const handleSave = async () => {
        if (!firestore || !itemName.trim()) return;
        setIsSaving(true);
        try {
            const dataToSave: Partial<ItemCategory> = { name: itemName };
            if (parentCategory) {
                dataToSave.parentCategoryId = parentCategory.id;
            } else {
                dataToSave.parentCategoryId = null;
            }

            if (editingItem) {
                if(parentCategory && parentCategory.id === editingItem.id) {
                    toast({variant: 'destructive', title: 'خطأ', description: 'لا يمكن أن تكون الفئة أبًا لنفسها.'});
                    setIsSaving(false);
                    return;
                }
                await updateDoc(doc(firestore, 'itemCategories', editingItem.id!), dataToSave);
                toast({ title: 'نجاح', description: 'تم تحديث التصنيف.' });
            } else {
                const currentList = parentCategory ? categories.filter(c => c.parentCategoryId === parentCategory.id) : categories.filter(c => !c.parentCategoryId);
                dataToSave.order = currentList.length;
                await addDoc(collection(firestore, 'itemCategories'), dataToSave);
                toast({ title: 'نجاح', description: 'تمت إضافة التصنيف.' });
            }
            closeDialog();
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ التصنيف.' });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDelete = async () => {
        if (!firestore || !itemToDelete) return;
        setIsSaving(true);
        try {
            // Simple delete, not handling children for now to keep it simple.
            await deleteDoc(doc(firestore, 'itemCategories', itemToDelete.id!));
            toast({ title: 'نجاح', description: 'تم حذف التصنيف.' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف التصنيف. قد يكون مرتبطًا بأصناف أخرى.' });
        } finally {
            setIsSaving(false);
            setItemToDelete(null);
        }
    };
    
    const handleImportDefaults = async () => {
        if(!firestore) return;
        setIsImporting(true);
        try {
            const batch = writeBatch(firestore);
            const existingSnap = await getDocs(query(collection(firestore, 'itemCategories')));
            existingSnap.forEach(doc => batch.delete(doc.ref));

            for (const category of defaultItemCategories) {
                const docRef = doc(collection(firestore, 'itemCategories'));
                batch.set(docRef, category);
            }
            await batch.commit();
            toast({ title: 'نجاح', description: 'تم استيراد التصنيفات الافتراضية.' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل استيراد التصنيفات.' });
        } finally {
            setIsImporting(false);
            setIsImportConfirmOpen(false);
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>إدارة التصنيفات</CardTitle>
                <CardDescription>
                    تنظيم الأصناف في هيكل شجري لتسهيل البحث والتصنيف.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex justify-between items-center mb-4">
                     <Button variant="outline" size="sm" onClick={() => setIsImportConfirmOpen(true)} disabled={isImporting}>
                        {isImporting ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <DownloadCloud className="ml-2 h-4"/>} استيراد التصنيفات الافتراضية
                    </Button>
                    <Button onClick={() => openDialog(null)}><PlusCircle className="ml-2 h-4"/> إضافة تصنيف رئيسي</Button>
                </div>
                <div className="border rounded-lg p-2 min-h-[300px]">
                    {loading && <div className="text-center p-8"><Loader2 className="animate-spin" /></div>}
                    {!loading && categoryTree.length === 0 && <p className="text-center text-muted-foreground p-8">لا توجد تصنيفات معرفة. ابدأ بإضافة تصنيف رئيسي.</p>}
                    {!loading && categoryTree.map(node => (
                        <CategoryItem 
                            key={node.id} 
                            node={node} 
                            level={0}
                            onEdit={item => openDialog(item)}
                            onDelete={setItemToDelete}
                            onAddSub={parent => openDialog(null, parent)}
                            openCategories={openCategories}
                            setOpenCategories={setOpenCategories}
                        />
                    ))}
                </div>
            </CardContent>

            <Dialog open={isDialogOpen} onOpenChange={closeDialog}>
                <DialogContent dir="rtl">
                    <DialogHeader>
                        <DialogTitle>{editingItem ? 'تعديل تصنيف' : 'إضافة تصنيف جديد'}</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="grid gap-2">
                            <Label>الفئة الأب (اختياري)</Label>
                            <InlineSearchList 
                                value={parentCategory?.id || ''}
                                onSelect={(val) => setParentCategory(categories.find(c => c.id === val) || null)}
                                options={categoryOptions}
                                placeholder="اتركه فارغًا ليكون تصنيفًا رئيسيًا"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="item-name">اسم التصنيف <span className="text-destructive">*</span></Label>
                            <Input id="item-name" value={itemName} onChange={(e) => setItemName(e.target.value)} required />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeDialog} disabled={isSaving}>إلغاء</Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                             {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4"/>}
                            حفظ
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>هل أنت متأكد من الحذف؟</AlertDialogTitle>
                        <AlertDialogDescription>
                            سيتم حذف التصنيف "{itemToDelete?.name}" بشكل دائم.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSaving}>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={isSaving} className="bg-destructive hover:bg-destructive/90">
                             {isSaving ? 'جاري الحذف...' : 'نعم، قم بالحذف'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={isImportConfirmOpen} onOpenChange={setIsImportConfirmOpen}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد استيراد التصنيفات الافتراضية؟</AlertDialogTitle>
                        <AlertDialogDescription>
                            سيؤدي هذا الإجراء إلى مسح جميع التصنيفات الحالية واستبدالها بالقائمة الافتراضية.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isImporting}>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleImportDefaults} disabled={isImporting} className="bg-destructive hover:bg-destructive/90">
                            {isImporting ? 'جاري الاستيراد...' : 'نعم، قم بالاستيراد'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}
