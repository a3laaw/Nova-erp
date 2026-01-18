
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirebase, useCollection } from '@/firebase';
import { collection, query, orderBy, doc, addDoc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ScrollArea } from '../ui/scroll-area';
import { Plus, Pencil, Trash2, Loader2, Building, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Department, Job, Governorate, Area } from '@/lib/types';


// Generic Manager Component
function DataManager<T extends {id: string, name: string}, S extends {id: string, name: string}>({
  primaryTitle,
  primaryCollectionName,
  secondaryTitle,
  secondaryCollectionName,
  icon
}: {
  primaryTitle: string;
  primaryCollectionName: string;
  secondaryTitle: string;
  secondaryCollectionName: string;
  icon: React.ReactNode;
}) {
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [primaryItems, setPrimaryItems] = useState<T[]>([]);
  const [secondaryItems, setSecondaryItems] = useState<S[]>([]);
  const [selectedPrimary, setSelectedPrimary] = useState<T | null>(null);
  
  const [loadingPrimary, setLoadingPrimary] = useState(true);
  const [loadingSecondary, setLoadingSecondary] = useState(false);

  const [isPrimaryDialogOpen, setIsPrimaryDialogOpen] = useState(false);
  const [isSecondaryDialogOpen, setIsSecondaryDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const [editingItem, setEditingItem] = useState<{ id: string, name: string } | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ id: string, name: string, type: 'primary' | 'secondary' } | null>(null);
  const [itemName, setItemName] = useState('');


  const primaryQuery = useMemo(() => firestore ? query(collection(firestore, primaryCollectionName), orderBy('name')) : null, [firestore, primaryCollectionName]);
  const [primarySnapshot, primaryLoading] = useCollection(primaryQuery);

  useEffect(() => {
    setLoadingPrimary(primaryLoading);
    if (primarySnapshot) {
      const items = primarySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
      setPrimaryItems(items);
    }
  }, [primarySnapshot, primaryLoading]);
  
  useEffect(() => {
    if (selectedPrimary && primaryItems.find(p => p.id === selectedPrimary.id)) {
        // If selected primary still exists, keep it selected.
    } else if (primaryItems.length > 0) {
        handleSelectPrimary(primaryItems[0]);
    } else {
        setSelectedPrimary(null);
        setSecondaryItems([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryItems]);


  const handleSelectPrimary = async (item: T) => {
    setSelectedPrimary(item);
    if (!firestore) return;
    setLoadingSecondary(true);
    setSecondaryItems([]);
    try {
      const secondaryQuery = query(collection(firestore, `${primaryCollectionName}/${item.id}/${secondaryCollectionName}`), orderBy('name'));
      const secondarySnapshot = await getDocs(secondaryQuery);
      setSecondaryItems(secondarySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as S)));
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: `فشل جلب ${secondaryTitle}` });
    } finally {
      setLoadingSecondary(false);
    }
  };
  
  const openDialog = (type: 'primary' | 'secondary', item: {id: string, name: string} | null = null) => {
    setEditingItem(item);
    setItemName(item?.name || '');
    if (type === 'primary') setIsPrimaryDialogOpen(true);
    else setIsSecondaryDialogOpen(true);
  }

  const closeDialog = () => {
    setIsPrimaryDialogOpen(false);
    setIsSecondaryDialogOpen(false);
    setEditingItem(null);
    setItemName('');
  }

  const handleSave = async (type: 'primary' | 'secondary') => {
    if (!firestore || !itemName.trim()) return;
    
    const collectionPath = type === 'primary' ? primaryCollectionName : `${primaryCollectionName}/${selectedPrimary?.id}/${secondaryCollectionName}`;
    
    try {
      if (editingItem) { // Update
        const itemRef = doc(firestore, collectionPath, editingItem.id);
        await updateDoc(itemRef, { name: itemName });
        toast({ title: 'نجاح', description: 'تم تحديث العنصر.' });
      } else { // Create
        await addDoc(collection(firestore, collectionPath), { name: itemName });
        toast({ title: 'نجاح', description: 'تمت إضافة العنصر.' });
      }
      if (type === 'secondary' && selectedPrimary) {
          handleSelectPrimary(selectedPrimary);
      }
      closeDialog();
    } catch (e) {
       console.error(e);
       toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ العنصر.' });
    }
  };

  const openDeleteDialog = (item: {id: string, name: string}, type: 'primary' | 'secondary') => {
      setItemToDelete({ ...item, type });
      setIsDeleteDialogOpen(true);
  }

  const handleDelete = async () => {
      if (!firestore || !itemToDelete) return;
      const { id, type } = itemToDelete;
      const collectionPath = type === 'primary' ? primaryCollectionName : `${primaryCollectionName}/${selectedPrimary?.id}/${secondaryCollectionName}`;
       try {
        await deleteDoc(doc(firestore, collectionPath, id));
        toast({ title: 'نجاح', description: 'تم حذف العنصر.' });
        if (type === 'secondary' && selectedPrimary) {
             handleSelectPrimary(selectedPrimary);
        }
      } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف العنصر. قد يكون مرتبطًا ببيانات أخرى.' });
      } finally {
        setIsDeleteDialogOpen(false);
        setItemToDelete(null);
      }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
            {icon}
            <CardTitle>إدارة {primaryTitle} و {secondaryTitle}</CardTitle>
        </div>
        <Button size="sm" onClick={() => openDialog('primary')}><Plus className="ml-2" /> إضافة {primaryTitle.slice(0, -1)}</Button>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Primary List */}
        <div>
          <h4 className="font-semibold mb-2 text-center">{primaryTitle}</h4>
          <ScrollArea className="h-72 border rounded-md p-2">
            {loadingPrimary ? <p>جاري التحميل...</p> : primaryItems.length === 0 ? <p className='text-center text-muted-foreground p-4'>لا توجد بيانات</p> : (
              primaryItems.map(item => (
                <div key={item.id} onClick={() => handleSelectPrimary(item)}
                  className={`flex justify-between items-center p-2 rounded-md cursor-pointer ${selectedPrimary?.id === item.id ? 'bg-accent' : 'hover:bg-muted/50'}`}>
                  <span>{item.name}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openDialog('primary', item); }}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); openDeleteDialog(item, 'primary'); }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))
            )}
          </ScrollArea>
        </div>
        
        {/* Secondary List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-center flex-1">
                {selectedPrimary ? `${secondaryTitle} (${selectedPrimary.name})` : `اختر ${primaryTitle.slice(0, -1)} لعرض ${secondaryTitle}`}
            </h4>
             <Button size="sm" onClick={() => openDialog('secondary')} disabled={!selectedPrimary}><Plus className="ml-2" /> إضافة {secondaryTitle.slice(0, -1)}</Button>
          </div>
          <ScrollArea className="h-72 border rounded-md p-2">
            {loadingSecondary ? <Loader2 className="animate-spin mx-auto my-10" /> : !selectedPrimary ? <div className='text-center text-muted-foreground p-4'>...</div> : secondaryItems.length === 0 ? <p className='text-center text-muted-foreground p-4'>لا توجد بيانات</p> : (
              secondaryItems.map(item => (
                <div key={item.id} className="flex justify-between items-center p-2 rounded-md hover:bg-muted/50">
                  <span>{item.name}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDialog('secondary', item)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => openDeleteDialog(item, 'secondary')}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))
            )}
          </ScrollArea>
        </div>
      </CardContent>

      <Dialog open={isPrimaryDialogOpen || isSecondaryDialogOpen} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'تعديل' : 'إضافة'} عنصر جديد</DialogTitle>
            <DialogDescription>
              {`أدخل اسم ${isPrimaryDialogOpen ? primaryTitle.slice(0, -1) : secondaryTitle.slice(0, -1)} الجديد.`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Label htmlFor="item-name">الاسم</Label>
            <Input id="item-name" value={itemName} onChange={(e) => setItemName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>إلغاء</Button>
            <Button onClick={() => handleSave(isPrimaryDialogOpen ? 'primary' : 'secondary')}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                <AlertDialogDescription>
                    سيتم حذف العنصر "{itemToDelete?.name}" بشكل دائم. إذا كان هذا العنصر الرئيسي، سيتم حذف جميع العناصر الفرعية التابعة له.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">نعم، حذف</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </Card>
  );
}

export function ReferenceDataManager() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>إدارة البيانات المرجعية</CardTitle>
          <CardDescription>
            تحكم في القوائم المنسدلة المستخدمة في جميع أنحاء النظام، مثل الأقسام والوظائف والمواقع الجغرافية.
          </CardDescription>
        </CardHeader>
      </Card>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <DataManager<Department, Job> 
            primaryTitle="الأقسام"
            primaryCollectionName="departments"
            secondaryTitle="الوظائف"
            secondaryCollectionName="jobs"
            icon={<Building />}
        />
        <DataManager<Governorate, Area> 
            primaryTitle="المحافظات"
            primaryCollectionName="governorates"
            secondaryTitle="المناطق"
            secondaryCollectionName="areas"
            icon={<MapPin />}
        />
      </div>
    </div>
  );
}
