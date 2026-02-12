'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, doc, addDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import type { ItemCategory } from '@/lib/types';
import { Loader2, Plus, Pencil, Trash2, ChevronDown, ChevronLeft, Save } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';
import { InlineSearchList } from '../ui/inline-search-list';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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

interface CategoryNodeProps {
  category: ItemCategory & { children: any[] };
  allCategories: ItemCategory[];
  level: number;
  onAdd: (parentId: string | null) => void;
  onEdit: (category: ItemCategory) => void;
  onDelete: (category: ItemCategory) => void;
  openCategories: Set<string>;
  toggleCategory: (id: string) => void;
}

function CategoryNode({ category, allCategories, level, onAdd, onEdit, onDelete, openCategories, toggleCategory }: CategoryNodeProps) {
  const isOpen = openCategories.has(category.id!);
  return (
    <div>
      <div className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50">
        <div style={{ paddingRight: `${level * 1.5}rem` }} className="flex-grow flex items-center gap-1">
          {category.children.length > 0 && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleCategory(category.id!)}>
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          )}
           {!category.children.length && <div className="w-6 h-6"/>}
          <span className="font-medium">{category.name}</span>
        </div>
        <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onAdd(category.id!)}><Plus className="h-4 w-4 text-primary"/></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(category)}><Pencil className="h-4 w-4"/></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(category)}><Trash2 className="h-4 w-4"/></Button>
        </div>
      </div>
      {isOpen && category.children.length > 0 && (
        <div className="pr-6">
          {category.children.map(child => (
            <CategoryNode
              key={child.id}
              category={child}
              allCategories={allCategories}
              level={level + 1}
              onAdd={onAdd}
              onEdit={onEdit}
              onDelete={onDelete}
              openCategories={openCategories}
              toggleCategory={toggleCategory}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryForm({ isOpen, onClose, onSave, category, allCategories }: { isOpen: boolean, onClose: () => void, onSave: (data: any) => void, category: Partial<ItemCategory> | null, allCategories: ItemCategory[] }) {
    const isEditing = !!category?.id;
    const [name, setName] = useState('');
    const [parentCategoryId, setParentCategoryId] = useState<string | null>(null);

    useEffect(() => {
        if(category) {
            setName(category.name || '');
            setParentCategoryId(category.parentCategoryId || null);
        } else {
            setName('');
            setParentCategoryId(null);
        }
    }, [category]);
    
    const parentCategoryOptions = useMemo(() => {
        const buildOptions = (categories: ItemCategory[], parentId: string | null = null, prefix = '') => {
            let options: { value: string, label: string }[] = [];
            categories
                .filter(c => c.parentCategoryId === parentId)
                .forEach(c => {
                    // Prevent a category from being its own descendant
                    if (isEditing && (c.id === category?.id || c.parentCategoryId === category?.id)) return;
                    options.push({ value: c.id!, label: `${prefix}${c.name}` });
                    options = [...options, ...buildOptions(categories, c.id!, `${prefix}- `)];
                });
            return options;
        };
        return buildOptions(allCategories);
    }, [allCategories, isEditing, category]);
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ id: category?.id, name, parentCategoryId });
    };

    return (
         <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent dir="rtl">
                 <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{isEditing ? `تعديل فئة: ${category?.name}` : 'إضافة فئة جديدة'}</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">اسم الفئة</Label>
                            <Input id="name" value={name} onChange={e => setName(e.target.value)} required />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="parent">الفئة الأب (اختياري)</Label>
                            <InlineSearchList
                                value={parentCategoryId || ''}
                                onSelect={(v) => setParentCategoryId(v || null)}
                                options={parentCategoryOptions}
                                placeholder="اختر فئة أب..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
                        <Button type="submit">حفظ</Button>
                    </DialogFooter>
                 </form>
            </DialogContent>
        </Dialog>
    )
}

export function ItemCategoriesManager() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const { data: categories, loading, error } = useSubscription<ItemCategory>(firestore, 'itemCategories');
    
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Partial<ItemCategory> | null>(null);
    const [categoryToDelete, setCategoryToDelete] = useState<ItemCategory | null>(null);
    const [openCategories, setOpenCategories] = useState(new Set<string>());

    const categoryTree = useMemo(() => {
        if (!categories) return [];
        const map = new Map<string, ItemCategory & { children: any[] }>();
        const roots: (ItemCategory & { children: any[] })[] = [];

        categories.forEach(cat => map.set(cat.id!, { ...cat, children: [] }));
        
        categories.forEach(cat => {
            if (cat.parentCategoryId && map.has(cat.parentCategoryId)) {
                map.get(cat.parentCategoryId)!.children.push(map.get(cat.id!)!);
            } else {
                roots.push(map.get(cat.id!)!);
            }
        });
        return roots;
    }, [categories]);

    const toggleCategory = (id: string) => {
        setOpenCategories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };
    
    const handleAdd = (parentId: string | null = null) => {
        setEditingCategory({ parentCategoryId: parentId });
        setIsFormOpen(true);
    };

    const handleEdit = (category: ItemCategory) => {
        setEditingCategory(category);
        setIsFormOpen(true);
    };

    const handleDelete = (category: ItemCategory) => {
        setCategoryToDelete(category);
    };
    
    const handleConfirmDelete = async () => {
        if (!firestore || !categoryToDelete) return;
        try {
            await deleteDoc(doc(firestore, 'itemCategories', categoryToDelete.id!));
            toast({ title: 'نجاح', description: 'تم حذف الفئة.' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف الفئة.' });
        } finally {
            setCategoryToDelete(null);
        }
    };

    const handleSave = async (data: any) => {
        if (!firestore) return;
        try {
            if (data.id) { // Editing
                await updateDoc(doc(firestore, 'itemCategories', data.id), { name: data.name, parentCategoryId: data.parentCategoryId });
                toast({ title: 'نجاح', description: 'تم تحديث الفئة.' });
            } else { // Creating
                await addDoc(collection(firestore, 'itemCategories'), { name: data.name, parentCategoryId: data.parentCategoryId });
                toast({ title: 'نجاح', description: 'تمت إضافة الفئة.' });
            }
            setIsFormOpen(false);
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ الفئة.' });
        }
    };


    return (
        <Card>
            <CardHeader>
                <CardTitle>إدارة فئات الأصناف</CardTitle>
                <CardDescription>إنشاء وتعديل الهيكل الشجري لفئات الأصناف في المخزون.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex justify-end mb-4">
                    <Button onClick={() => handleAdd(null)}><PlusCircle className="ml-2 h-4"/> إضافة فئة رئيسية</Button>
                </div>
                <div className="border rounded-lg p-2 min-h-[300px]">
                    {loading && <div className="text-center p-8"><Loader2 className="animate-spin" /></div>}
                    {!loading && categoryTree.length === 0 && <div className="text-center text-muted-foreground p-8">لا توجد فئات. ابدأ بإضافة فئة رئيسية.</div>}
                    {!loading && categoryTree.map(cat => (
                        <CategoryNode 
                            key={cat.id} 
                            category={cat}
                            allCategories={categories}
                            level={0}
                            onAdd={handleAdd}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            openCategories={openCategories}
                            toggleCategory={toggleCategory}
                        />
                    ))}
                </div>
            </CardContent>
             <CategoryForm
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSave={handleSave}
                category={editingCategory}
                allCategories={categories}
            />
            <AlertDialog open={!!categoryToDelete} onOpenChange={() => setCategoryToDelete(null)}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader><AlertDialogTitle>تأكيد الحذف</AlertDialogTitle><AlertDialogDescription>هل أنت متأكد من حذف الفئة "{categoryToDelete?.name}"؟ سيتم حذف جميع الفئات الفرعية التابعة لها.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>إلغاء</AlertDialogCancel><AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/90">نعم، حذف</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}

    