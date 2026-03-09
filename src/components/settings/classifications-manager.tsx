'use client';

import { useState, useMemo } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc, writeBatch, getDocs, query } from 'firebase/firestore';
import type { ItemCategory } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PlusCircle, Pencil, Trash2, Loader2, Save, Plus, Minus, DownloadCloud } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { InlineSearchList } from '../ui/inline-search-list';
import { defaultItemCategories } from '@/lib/default-reference-data';

interface CategoryNode extends ItemCategory {
  children: CategoryNode[];
}

function CategoryItem({
  node, level, onEdit, onDelete, onAddSub, openCategories, setOpenCategories,
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
      if (newSet.has(node.id!)) newSet.delete(node.id!);
      else newSet.add(node.id!);
      return newSet;
    });
  };

  return (
    <div style={{ paddingRight: `${level * 1.5}rem` }}>
      <div className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 group">
        <div className="flex items-center gap-2 cursor-pointer flex-grow" onClick={toggleOpen}>
          {node.children.length > 0 ? (
            <Button variant="ghost" size="icon" className="h-6 w-6">
              {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </Button>
          ) : (
            <span className="w-6 h-6 inline-block ml-2" />
          )}
          <span className={cn("font-medium", node.children.length === 0 && "ml-2")}>{node.name}</span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onAddSub(node)} title="إضافة فئة فرعية">
            <PlusCircle className="h-4 w-4 text-primary" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(node)} title="تعديل">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(node)} title="حذف">
            <Trash2 className="h-4 w-4" />
          </Button>
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
        categories.forEach(cat => { map.set(cat.id!, { ...cat, children: [] }); });
        categories.forEach(cat => {
            if (cat.parentCategoryId && map.has(cat.parentCategoryId))
                map.get(cat.parentCategoryId)!.children.push(map.get(cat.id!)!);
            else roots.push(map.get(cat.id!)!);
        });
        const sortRecursive = (nodes: any[]) => {
            nodes.sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name, 'ar'));
            nodes.forEach(node => { if (node.children.length > 0) sortRecursive(node.children); });
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

    const closeDialog = () => {
        setIsDialogOpen(false);
        setItemName('');
        setEditingItem(null);
        setParentCategory(null);
    };

    const openAdd = () => {
        setEditingItem(null);
        setParentCategory(null);
        setItemName('');
        setIsDialogOpen(true);
    };

    const openEdit = (i: ItemCategory) => {
        setEditingItem(i);
        setItemName(i.name || '');
        setParentCategory(categories.find(c => c.id === i.parentCategoryId) || null);
        setIsDialogOpen(true);
    };

    const openAddSub = (p: ItemCategory) => {
        setEditingItem(null);
        setParentCategory(p);
        setItemName('');
        setIsDialogOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = itemName.trim();
        if (!firestore || !trimmedName) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'اسم الفئة مطلوب.' });
            return;
        }
        setIsSaving(true);
        try {
            const dataToSave = {
                name: trimmedName,
                parentCategoryId: parentCategory?.id || null
            };
            if (editingItem) {
                await updateDoc(doc(firestore, 'itemCategories', editingItem.id!), dataToSave);
            } else {
                const currentList = parentCategory
                    ? categories.filter(c => c.parentCategoryId === parentCategory.id)
                    : categories.filter(c => !c.parentCategoryId);
                await addDoc(collection(firestore, 'itemCategories'), { ...dataToSave, order: currentList.length });
            }
            toast({ title: 'تم الحفظ بنجاح' });
            closeDialog();
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ في الحفظ' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!firestore || !itemToDelete) return;
        setIsSaving(true);
        try {
            await deleteDoc(doc(firestore, 'itemCategories', itemToDelete.id!));
            toast({ title: 'نجاح' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ' });
        } finally {
            setIsSaving(false);
            setItemToDelete(null);
        }
    };

    const handleImportDefaults = async () => {
        if (!firestore) return;
        setIsImporting(true);
        try {
            const batch = writeBatch(firestore);
            const existingSnap = await getDocs(query(collection(firestore, 'itemCategories')));
            existingSnap.forEach(d => batch.delete(d.ref));
            for (const category of defaultItemCategories) {
                batch.set(doc(collection(firestore, 'itemCategories')), {
                    name: category.name,
                    parentCategoryId: category.parentCategoryId,
                    order: category.order
                });
            }
            await batch.commit();
            toast({ title: 'نجاح الاستيراد' });
        } finally {
            setIsImporting(false);
            setIsImportConfirmOpen(false);
        }
    };

    const categoryOptions = useMemo(() => {
        if (!categories) return [];
        return categories
            .filter(cat => cat.id !== editingItem?.id)
            .map(cat => ({ value: cat.id!, label: cat.name }));
    }, [categories, editingItem]);

    return (
        <Card dir="rtl">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>إدارة فئات الأصناف</CardTitle>
                        <CardDescription>تنظيم الأصناف في هيكل شجري مبسط (الفئة والفئة الأب).</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setIsImportConfirmOpen(true)} disabled={isImporting}>
                            {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <DownloadCloud className="ml-2 h-4" />} استيراد الافتراضي
                        </Button>
                        <Button onClick={openAdd}>
                            <PlusCircle className="ml-2 h-4" /> إضافة فئة رئيسية
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="border rounded-xl p-4 bg-card shadow-sm min-h-[400px]">
                    {loading ? (
                        <Loader2 className="animate-spin mx-auto h-8 w-8 text-primary mt-20" />
                    ) : categoryTree.length === 0 ? (
                        <p className="text-center text-muted-foreground p-12">لا توجد فئات.</p>
                    ) : (
                        categoryTree.map(node => (
                            <CategoryItem
                                key={node.id}
                                node={node}
                                level={0}
                                onEdit={openEdit}
                                onDelete={setItemToDelete}
                                onAddSub={openAddSub}
                                openCategories={openCategories}
                                setOpenCategories={setOpenCategories}
                            />
                        ))
                    )}
                </div>
            </CardContent>

            <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
                <DialogContent dir="rtl" className="max-w-md">
                    <form onSubmit={handleSave}>
                        <DialogHeader>
                            <DialogTitle>{editingItem ? 'تعديل فئة' : 'إضافة فئة جديدة'}</DialogTitle>
                        </DialogHeader>
                        <div className="py-4 space-y-6">
                            <div className="grid gap-2">
                                <Label>الفئة الأب (اختياري)</Label>
                                <InlineSearchList
                                    value={parentCategory?.id || ''}
                                    onSelect={v => setParentCategory(categories.find(c => c.id === v) || null)}
                                    options={categoryOptions}
                                    placeholder="فئة رئيسية (بدون أب)"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="item-name">اسم الفئة *</Label>
                                <Input
                                    id="item-name"
                                    value={itemName}
                                    onChange={e => setItemName(e.target.value)}
                                    required
                                    placeholder="مثال: مواد غذائية، كابلات كهربائية..."
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={closeDialog} disabled={isSaving}>إلغاء</Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                                حفظ الفئة
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
                <AlertDialogContent dir="rtl" className="rounded-3xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد الحذف؟</AlertDialogTitle>
                        <AlertDialogDescription>سيتم حذف الفئة "{itemToDelete?.name}" نهائياً.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={isSaving} className="bg-destructive hover:bg-destructive/90">
                            {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : 'نعم، حذف'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={isImportConfirmOpen} onOpenChange={setIsImportConfirmOpen}>
                <AlertDialogContent dir="rtl" className="rounded-3xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد الاستيراد؟</AlertDialogTitle>
                        <AlertDialogDescription>سيقوم هذا الإجراء بمسح الفئات الحالية واستبدالها بالافتراضية لضمان توافق النظام.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleImportDefaults} disabled={isImporting} className="bg-destructive">استيراد</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}