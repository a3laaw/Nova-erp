
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, orderBy, doc, addDoc, updateDoc, deleteDoc, writeBatch, getDocs, collectionGroup } from 'firebase/firestore';
import type { ItemCategory, CompanyActivityType, BoqReferenceItem } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from '../ui/scroll-area';
import { PlusCircle, Pencil, Trash2, Loader2, Save, Plus, Minus, DownloadCloud, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { InlineSearchList } from '../ui/inline-search-list';
import { MultiSelect, type MultiSelectOption } from '../ui/multi-select';
import { defaultItemCategories } from '@/lib/default-reference-data';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

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
  activityTypeMap,
}: {
  node: CategoryNode;
  level: number;
  onEdit: (item: ItemCategory) => void;
  onDelete: (item: ItemCategory) => void;
  onAddSub: (parent: ItemCategory) => void;
  openCategories: Set<string>;
  setOpenCategories: React.Dispatch<React.SetStateAction<Set<string>>>;
  activityTypeMap: Map<string, string>;
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
        <div className="flex items-center gap-2 cursor-pointer flex-grow" onClick={toggleOpen}>
          {node.children.length > 0 ? (
            <Button variant="ghost" size="icon" className="h-6 w-6">
              {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </Button>
          ) : (
            <span className="w-6 h-6 inline-block ml-2" />
          )}
          <div className="flex flex-col">
            <span className={cn("font-medium", node.children.length === 0 && "ml-2")}>{node.name}</span>
            {node.activityTypeIds && node.activityTypeIds.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                    {node.activityTypeIds.map(id => (
                        <Badge key={id} variant="outline" className="text-[10px] h-4 py-0 px-1 border-blue-200 text-blue-600 bg-blue-50/50">
                            {activityTypeMap.get(id) || '...'}
                        </Badge>
                    ))}
                </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onAddSub(node)} title="إضافة فئة فرعية"><PlusCircle className="h-4 w-4 text-primary" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(node)} title="تعديل"><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(node)} title="حذف"><Trash2 className="h-4 w-4" /></Button>
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
          activityTypeMap={activityTypeMap}
        />
      ))}
    </div>
  );
}

export function ClassificationsManager() {
    const { firestore } = useFirebase();
    const { toast } = useToast();

    const { data: categories, loading: categoriesLoading } = useSubscription<ItemCategory>(firestore, 'itemCategories');
    const { data: activityTypes, loading: activityTypesLoading } = useSubscription<CompanyActivityType>(firestore, 'companyActivityTypes', useMemo(() => [orderBy('name')], []));
    const { data: boqReferenceItems, loading: boqItemsLoading } = useSubscription<BoqReferenceItem>(firestore, 'boqReferenceItems', useMemo(() => [orderBy('name')], []));
    
    const [openCategories, setOpenCategories] = useState(new Set<string>());
    const [activityFilter, setActivityFilter] = useState('all');

    const activityTypeMap = useMemo(() => new Map(activityTypes.map(t => [t.id, t.name])), [activityTypes]);
    const activityTypeOptions: MultiSelectOption[] = useMemo(() => activityTypes.map(t => ({ value: t.id, label: t.name })), [activityTypes]);
    const boqItemOptions: MultiSelectOption[] = useMemo(() => boqReferenceItems.map(item => ({ value: item.id!, label: item.name })), [boqReferenceItems]);

    const categoryTree = useMemo(() => {
        if (!categories) return [];
        
        let filteredList = categories;
        if (activityFilter !== 'all') {
            filteredList = categories.filter(cat => cat.activityTypeIds?.includes(activityFilter));
        }

        const map = new Map<string, ItemCategory & { children: any[] }>();
        const roots: (ItemCategory & { children: any[] })[] = [];

        filteredList.forEach(cat => {
            map.set(cat.id!, { ...cat, children: [] });
        });

        filteredList.forEach(cat => {
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
    }, [categories, activityFilter]);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<ItemCategory | null>(null);
    const [itemToDelete, setItemToDelete] = useState<ItemCategory | null>(null);
    const [parentCategory, setParentCategory] = useState<ItemCategory | null>(null);
    
    const [itemName, setItemName] = useState('');
    const [selectedActivityTypeIds, setSelectedActivityTypeIds] = useState<string[]>([]);
    const [selectedBoqItemIds, setSelectedBoqItemIds] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);
    
    // Logic to determine if current item is a leaf and follows construction
    const isLeafAndConstruction = useMemo(() => {
        if (!editingItem && !parentCategory) return false; // Initial root add is not a leaf usually
        
        // 1. Is it a leaf? (No other category has this ID as its parent)
        const isCurrentlyALeaf = editingItem ? !categories.some(c => c.parentCategoryId === editingItem.id) : true;
        if (!isCurrentlyALeaf) return false;

        // 2. Finding Root Parent
        const getRootParent = (currentId: string | null): ItemCategory | null => {
            if (!currentId) return null;
            const current = categories.find(c => c.id === currentId);
            if (!current) return null;
            if (!current.parentCategoryId) return current;
            return getRootParent(current.parentCategoryId);
        };

        const rootParent = getRootParent(editingItem?.parentCategoryId || parentCategory?.id || null);
        if (!rootParent) {
            // If it's a root category itself
            const selfIsRoot = editingItem && !editingItem.parentCategoryId;
            if (selfIsRoot) {
                return selectedActivityTypeIds.some(id => activityTypeMap.get(id)?.includes('مقاولات') || activityTypeMap.get(id)?.toLowerCase().includes('construction'));
            }
            return false;
        }

        // 3. Check if root parent follows construction
        return rootParent.activityTypeIds?.some(id => 
            activityTypeMap.get(id)?.includes('مقاولات') || 
            activityTypeMap.get(id)?.toLowerCase().includes('construction')
        ) || false;

    }, [editingItem, parentCategory, categories, activityTypeMap, selectedActivityTypeIds]);

    const categoryOptions = useMemo(() => {
        if (!categories) return [];
        return categories
          .filter(cat => cat.id !== editingItem?.id) 
          .map(cat => ({ value: cat.id!, label: cat.name }));
    }, [categories, editingItem]);

    const openDialog = (item: ItemCategory | null, parent: ItemCategory | null = null) => {
        setEditingItem(item);
        
        let effectiveParent = parent;
        if (item && !parent && item.parentCategoryId) {
            effectiveParent = categories.find(c => c.id === item.parentCategoryId) || null;
        }
        
        setParentCategory(effectiveParent);
        setItemName(item?.name || '');
        setSelectedActivityTypeIds(item?.activityTypeIds || effectiveParent?.activityTypeIds || []);
        setSelectedBoqItemIds(item?.boqReferenceItemIds || []);
        setIsDialogOpen(true);
    };

    const closeDialog = () => {
        setIsDialogOpen(false);
        setEditingItem(null);
        setParentCategory(null);
        setItemName('');
        setSelectedActivityTypeIds([]);
        setSelectedBoqItemIds([]);
    };

    const handleSave = async () => {
        if (!firestore || !itemName.trim()) return;
        setIsSaving(true);
        try {
            const dataToSave: Partial<ItemCategory> = { 
                name: itemName,
                activityTypeIds: selectedActivityTypeIds,
                parentCategoryId: parentCategory?.id || null,
                boqReferenceItemIds: isLeafAndConstruction ? selectedBoqItemIds : []
            };

            if (editingItem) {
                if(parentCategory && parentCategory.id === editingItem.id) {
                    toast({variant: 'destructive', title: 'خطأ', description: 'لا يمكن أن تكون الفئة أبًا لنفسها.'});
                    setIsSaving(false);
                    return;
                }
                await updateDoc(doc(firestore, 'itemCategories', editingItem.id!), dataToSave);
                toast({ title: 'نجاح', description: 'تم تحديث التصنيف بنجاح.' });
            } else {
                const currentList = parentCategory ? categories.filter(c => c.parentCategoryId === parentCategory.id) : categories.filter(c => !c.parentCategoryId);
                const order = currentList.length;
                await addDoc(collection(firestore, 'itemCategories'), { ...dataToSave, order });
                toast({ title: 'نجاح', description: 'تمت إضافة التصنيف بنجاح.' });
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

    const loading = categoriesLoading || activityTypesLoading || boqItemsLoading;

    return (
        <Card dir="rtl">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>إدارة تصنيفات الأصناف</CardTitle>
                        <CardDescription>
                            تنظيم الأصناف في هيكل شجري وربطها بأنواع أنشطة الشركة وبنود الـ BOQ.
                        </CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setIsImportConfirmOpen(true)} disabled={isImporting}>
                            {isImporting ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <DownloadCloud className="ml-2 h-4"/>} استيراد الافتراضي
                        </Button>
                        <Button onClick={() => openDialog(null)}><PlusCircle className="ml-2 h-4"/> إضافة تصنيف رئيسي</Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <Label>فلترة حسب النشاط:</Label>
                    </div>
                    <Select value={activityFilter} onValueChange={setActivityFilter}>
                        <SelectTrigger className="max-w-[250px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">كل الأنشطة</SelectItem>
                            {activityTypes.map(type => (
                                <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="border rounded-xl p-4 min-h-[400px] bg-card shadow-sm">
                    {loading ? (
                        <div className="space-y-4">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-5/6 mr-auto" />
                            <Skeleton className="h-10 w-4/5 mr-auto" />
                        </div>
                    ) : categoryTree.length === 0 ? (
                        <p className="text-center text-muted-foreground p-12">لا توجد تصنيفات معرفة لهذا النشاط.</p>
                    ) : (
                        <div className="space-y-1">
                            {categoryTree.map(node => (
                                <CategoryItem 
                                    key={node.id} 
                                    node={node} 
                                    level={0}
                                    onEdit={item => openDialog(item)}
                                    onDelete={setItemToDelete}
                                    onAddSub={parent => openDialog(null, parent)}
                                    openCategories={openCategories}
                                    setOpenCategories={setOpenCategories}
                                    activityTypeMap={activityTypeMap}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>

            <Dialog open={isDialogOpen} onOpenChange={closeDialog}>
                <DialogContent 
                    dir="rtl"
                    className="max-w-2xl"
                    onInteractOutside={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.closest('[cmdk-root]') || target.closest('[data-radix-popper-content-wrapper]') || target.closest('[data-inline-search-list-options]')) {
                            e.preventDefault();
                        }
                    }}
                >
                    <DialogHeader>
                        <DialogTitle>{editingItem ? 'تعديل تصنيف' : 'إضافة تصنيف جديد'}</DialogTitle>
                        <DialogDescription>أدخل بيانات التصنيف وقم بربطه بالأنشطة المناسبة.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-6">
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
                            <Input id="item-name" value={itemName} onChange={(e) => setItemName(e.target.value)} required placeholder="مثال: مواد بناء، خدمات استشارية..." />
                        </div>
                        <div className="grid gap-2">
                            <Label>ربط بأنواع النشاط</Label>
                            <MultiSelect 
                                options={activityTypeOptions}
                                selected={selectedActivityTypeIds}
                                onChange={setSelectedActivityTypeIds}
                                placeholder="اختر نشاطًا واحدًا أو أكثر..."
                            />
                        </div>

                        {isLeafAndConstruction && (
                            <div className="p-4 border-2 border-primary/10 bg-primary/5 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-center gap-2">
                                    <Badge className="bg-primary/20 text-primary border-none">قسم المقاولات</Badge>
                                    <Label className="font-bold">ربط مع بنود جداول الكميات (BOQ)</Label>
                                </div>
                                <p className="text-[10px] text-muted-foreground">بما أن هذا التصنيف هو "ابن أخير" ويتبع نشاط المقاولات، يمكنك ربطه ببنود المقايسات المرجعية.</p>
                                <MultiSelect 
                                    options={boqItemOptions}
                                    selected={selectedBoqItemIds}
                                    onChange={setSelectedBoqItemIds}
                                    placeholder="اختر البنود المرجعية المرتبطة..."
                                />
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeDialog} disabled={isSaving}>إلغاء</Button>
                        <Button onClick={handleSave} disabled={isSaving || !itemName.trim()}>
                             {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4"/>}
                            حفظ التصنيف
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
                            <br />
                            <span className="text-destructive font-semibold">تنبيه: سيؤدي هذا إلى فصل الأصناف والروابط المرتبطة بهذا التصنيف.</span>
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
                            سيؤدي هذا الإجراء إلى مسح جميع التصنيفات الحالية واستبدالها بالقائمة الافتراضية الأولية.
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
