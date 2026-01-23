'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useFirebase, useCollection } from '@/firebase';
import { collection, query, orderBy, doc, addDoc, updateDoc, deleteDoc, getDocs, writeBatch, collectionGroup } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '../ui/card';
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
import { Plus, Pencil, Trash2, Loader2, Building, FileText, ArrowRight, Workflow, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Department, Job, Governorate, Area, TransactionType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CompanyManager } from './company-manager';


// Reusable component for the management UI (previously the whole component)
function ManagerView<T extends {id: string, name: string}, S extends {id: string, name: string}>({
  primaryTitle,
  primarySingularTitle,
  primaryCollectionName,
  secondaryTitle,
  secondarySingularTitle,
  secondaryCollectionName,
  icon,
  onBack,
}: {
  primaryTitle: string;
  primarySingularTitle: string;
  primaryCollectionName: string;
  secondaryTitle?: string;
  secondarySingularTitle?: string;
  secondaryCollectionName?: string;
  icon: React.ReactNode;
  onBack: () => void;
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
  const [primarySnapshot, primaryLoading, primaryError] = useCollection(primaryQuery);

  useEffect(() => {
    setLoadingPrimary(primaryLoading);
    if(primaryError) {
        toast({ variant: 'destructive', title: `فشل جلب ${primaryTitle}`, description: primaryError.message });
    }
    if (primarySnapshot) {
      const items = primarySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
      setPrimaryItems(items);
    }
  }, [primarySnapshot, primaryLoading, primaryError, primaryTitle, toast]);
  
  useEffect(() => {
    const primaryExists = selectedPrimary && primaryItems.some(p => p.id === selectedPrimary.id);
    if (!primaryExists && primaryItems.length > 0) {
        handleSelectPrimary(primaryItems[0]);
    } else if (primaryItems.length === 0) {
        setSelectedPrimary(null);
        setSecondaryItems([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryItems, selectedPrimary]);


  const handleSelectPrimary = async (item: T) => {
    setSelectedPrimary(item);
    if (!firestore || !secondaryCollectionName) return;
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
        <div className="flex items-center gap-3">
            {icon}
            <CardTitle>إدارة {primaryTitle} {secondaryTitle && ` و ${secondaryTitle}`}</CardTitle>
        </div>
        <Button onClick={onBack} variant="outline"><ArrowRight className="ml-2 h-4 w-4" /> العودة</Button>
      </CardHeader>
      <CardContent className={cn("grid grid-cols-1 gap-6", secondaryTitle && "md:grid-cols-2")}>
        {/* Primary List */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-semibold">{primaryTitle}</h4>
            <Button size="sm" onClick={() => openDialog('primary')}><Plus className="ml-2 h-4 w-4" /> إضافة</Button>
          </div>
          <ScrollArea className="h-72 border rounded-md p-2">
            {loadingPrimary ? <div className='p-4 text-center'><Loader2 className="animate-spin mx-auto" /></div> : primaryItems.length === 0 ? <p className='text-center text-muted-foreground p-4'>لا توجد بيانات</p> : (
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
        {secondaryTitle && secondaryCollectionName && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold">
                    {selectedPrimary ? `${secondaryTitle} (${selectedPrimary.name})` : `اختر ${primarySingularTitle} لعرض ${secondaryTitle}`}
                </h4>
                 <Button size="sm" onClick={() => openDialog('secondary')} disabled={!selectedPrimary}><Plus className="ml-2 h-4 w-4" /> إضافة</Button>
              </div>
              <ScrollArea className="h-72 border rounded-md p-2">
                {loadingSecondary ? <div className='p-4 text-center'><Loader2 className="animate-spin mx-auto" /></div> : !selectedPrimary ? <div className='text-center text-muted-foreground p-4'>...</div> : secondaryItems.length === 0 ? <p className='text-center text-muted-foreground p-4'>لا توجد بيانات</p> : (
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
        )}
      </CardContent>

      <Dialog open={isPrimaryDialogOpen || isSecondaryDialogOpen} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'تعديل' : 'إضافة'} عنصر جديد</DialogTitle>
            <DialogDescription>
              {`أدخل اسم ${isPrimaryDialogOpen ? primarySingularTitle : secondarySingularTitle} الجديد.`}
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


// --- Stat Card for Dashboard ---
const StatCard = ({ title, count, icon, onNavigate, color, loading }: { title: string, count: number, icon: React.ReactNode, onNavigate: () => void, color: string, loading: boolean }) => {
    const colors: {[key: string]: string} = {
        yellow: 'bg-yellow-400',
        red: 'bg-red-500',
        cyan: 'bg-cyan-400',
        blue: 'bg-blue-500',
        green: 'bg-green-500',
    };

    return (
        <div 
            onClick={onNavigate}
            className="bg-slate-50 dark:bg-slate-800/50 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700/50 pt-12 relative cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
        >
            <div 
                className={cn("absolute top-0 right-4 w-10 h-14 text-white flex items-center justify-center pt-2", colors[color])}
                style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 85%, 0 100%)' }}
            >
                <span className="font-bold text-lg">{loading ? '...' : count}</span>
            </div>
            
            <div className="flex flex-col items-center justify-center pb-6">
                <div className="text-slate-500 dark:text-slate-400 h-16 w-16 p-2 flex items-center justify-center">{icon}</div>
                <p className="font-semibold text-slate-800 dark:text-slate-200 mt-2 text-center">{title}</p>
            </div>
        </div>
    );
};


// --- Main Component (Router) ---
export function ReferenceDataManager() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [view, setView] = useState<'dashboard' | 'depts' | 'locations' | 'transTypes' | 'companies'>('dashboard');

    const [counts, setCounts] = useState({ depts: 0, jobs: 0, govs: 0, areas: 0, transTypes: 0, companies: 0 });
    const [loadingCounts, setLoadingCounts] = useState(true);

    // Fetch counts for the dashboard
    useEffect(() => {
        if (!firestore) return;

        const fetchCounts = async () => {
            setLoadingCounts(true);
            try {
                const deptsQuery = query(collection(firestore, 'departments'));
                const govsQuery = query(collection(firestore, 'governorates'));
                const companiesQuery = query(collection(firestore, 'companies'));
                const jobsQuery = query(collectionGroup(firestore, 'jobs'));
                const areasQuery = query(collectionGroup(firestore, 'areas'));
                const transTypesQuery = query(collectionGroup(firestore, 'transactionTypes'));
                
                const [deptsSnap, govsSnap, jobsSnap, areasSnap, transTypesSnap, companiesSnap] = await Promise.all([
                    getDocs(deptsQuery),
                    getDocs(govsQuery),
                    getDocs(jobsQuery),
                    getDocs(areasQuery),
                    getDocs(transTypesQuery),
                    getDocs(companiesQuery),
                ]);

                setCounts({
                    depts: deptsSnap.size,
                    govs: govsSnap.size,
                    jobs: jobsSnap.size,
                    areas: areasSnap.size,
                    transTypes: transTypesSnap.size,
                    companies: companiesSnap.size,
                });

            } catch (error) {
                console.error("Failed to fetch counts for reference data dashboard", error);
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في تحميل إحصائيات البيانات المرجعية.' });
            } finally {
                setLoadingCounts(false);
            }
        };

        fetchCounts();
    }, [firestore, toast]);
    

    if (view === 'depts') {
        return <ManagerView
            primaryTitle="الأقسام"
            primarySingularTitle="قسم"
            primaryCollectionName="departments"
            secondaryTitle="الوظائف"
            secondarySingularTitle="وظيفة"
            secondaryCollectionName="jobs"
            icon={<Workflow className="h-full w-full" />}
            onBack={() => setView('dashboard')}
        />
    }

    if (view === 'locations') {
         return <ManagerView 
            primaryTitle="المحافظات"
            primarySingularTitle="محافظة"
            primaryCollectionName="governorates"
            secondaryTitle="المناطق"
            secondarySingularTitle="منطقة"
            secondaryCollectionName="areas"
            icon={<Globe className="h-full w-full" />}
            onBack={() => setView('dashboard')}
        />
    }
    
    if (view === 'transTypes') {
         return <ManagerView
            primaryTitle="أنواع المعاملات حسب القسم"
            primarySingularTitle="قسم"
            primaryCollectionName="departments"
            secondaryTitle="أنواع المعاملات"
            secondarySingularTitle="نوع معاملة"
            secondaryCollectionName="transactionTypes"
            icon={<FileText className="h-full w-full" />}
            onBack={() => setView('dashboard')}
        />
    }

    if (view === 'companies') {
        return <CompanyManager onBack={() => setView('dashboard')} />
    }

    return (
        <Card>
            <CardHeader>
            <CardTitle>إدارة البيانات المرجعية</CardTitle>
            <CardDescription>
                تحكم في القوائم المنسدلة المستخدمة في جميع أنحاء النظام.
            </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                <StatCard 
                    title="الشركات" 
                    count={counts.companies} 
                    icon={<Building className="h-full w-full" />} 
                    onNavigate={() => setView('companies')} 
                    color="green" 
                    loading={loadingCounts} 
                />
                <StatCard 
                    title="الأقسام والوظائف" 
                    count={counts.depts + counts.jobs} 
                    icon={<Workflow className="h-full w-full" />} 
                    onNavigate={() => setView('depts')} 
                    color="blue" 
                    loading={loadingCounts} 
                />
                <StatCard 
                    title="المحافظات والمناطق" 
                    count={counts.govs + counts.areas} 
                    icon={<Globe className="h-full w-full" />} 
                    onNavigate={() => setView('locations')} 
                    color="cyan" 
                    loading={loadingCounts} 
                />
                <StatCard 
                    title="أنواع المعاملات" 
                    count={counts.transTypes} 
                    icon={<FileText className="h-full w-full" />} 
                    onNavigate={() => setView('transTypes')} 
                    color="red" 
                    loading={loadingCounts} 
                />
            </CardContent>
        </Card>
    );
}
