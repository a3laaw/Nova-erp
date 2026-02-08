
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useFirebase } from '@/firebase';
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
} from "@/components/ui/alert-dialog";
import { ScrollArea } from '../ui/scroll-area';
import { Plus, Pencil, Trash2, Loader2, Building, FileText, ArrowRight, Workflow, Globe, Save, PlusCircle, DownloadCloud } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Department, Job, Governorate, Area, TransactionType, UserRole, WorkStage } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CompanyManager } from './company-manager';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { MultiSelect, type MultiSelectOption } from '../ui/multi-select';
import { Skeleton } from '../ui/skeleton';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '../ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';


// --- NEW StatCard Component ---
function StatCard({ title, count, icon, onNavigate, color, loading }: { title: string, count: number, icon: React.ReactNode, onNavigate: () => void, color: string, loading: boolean }) {
    const colorClasses: Record<string, string> = {
        green: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300',
        blue: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
        cyan: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300',
        red: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300',
        purple: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300',
    }

    return (
        <button onClick={onNavigate} className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm hover:bg-accent transition-colors text-right">
            <div className="flex justify-between items-start">
                <div className={cn("p-2 rounded-lg", colorClasses[color] || colorClasses.blue)}>
                    {icon}
                </div>
                {loading ? <Skeleton className="h-6 w-12" /> : <div className="text-2xl font-bold">{count}</div>}
            </div>
            <p className="text-sm font-semibold mt-2">{title}</p>
        </button>
    );
}


// Reusable component for the management UI
function ManagerView<T extends {id: string, name: string, order?: number}, S extends {id: string, name: string, allowedRoles?: string[], expectedDurationDays?: number, trackingType?: 'duration' | 'occurrence' | 'none', maxOccurrences?: number, order?: number, nextStageIds?: string[], allowedDuringStages?: string[], stageType?: 'sequential' | 'parallel', enableModificationTracking?: boolean;}>({
  primaryTitle,
  primarySingularTitle,
  primaryCollectionName,
  secondaryTitle,
  secondarySingularTitle,
  secondaryCollectionName,
  icon,
  onBack,
  disablePrimaryActions
}: {
  primaryTitle: string;
  primarySingularTitle: string;
  primaryCollectionName: string;
  secondaryTitle?: string;
  secondarySingularTitle?: string;
  secondaryCollectionName?: string;
  icon: React.ReactNode;
  onBack: () => void;
  disablePrimaryActions?: boolean;
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
  
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ id: string, name: string, type: 'primary' | 'secondary' } | null>(null);
  
  const [itemName, setItemName] = useState('');
  const [itemRoles, setItemRoles] = useState<string[]>([]);
  const [itemStageType, setItemStageType] = useState<'sequential' | 'parallel'>('sequential');
  const [itemTrackingType, setItemTrackingType] = useState<'duration' | 'occurrence' | 'none'>('duration');
  const [itemDuration, setItemDuration] = useState<number | ''>('');
  const [itemMaxOccurrences, setItemMaxOccurrences] = useState<number | ''>('');
  const [itemAllowManualCompletion, setItemAllowManualCompletion] = useState(false);
  const [itemNextStageIds, setItemNextStageIds] = useState<string[]>([]);
  const [itemAllowedDuringStages, setItemAllowedDuringStages] = useState<string[]>([]);
  const [itemEnableModificationTracking, setItemEnableModificationTracking] = useState(false);

  // States for numerical ordering
  const [primaryOrderValues, setPrimaryOrderValues] = useState<Record<string, string>>({});
  const [isPrimaryOrderChanged, setIsPrimaryOrderChanged] = useState(false);
  const [secondaryOrderValues, setSecondaryOrderValues] = useState<Record<string, string>>({});
  const [isSecondaryOrderChanged, setIsSecondaryOrderChanged] = useState(false);

  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPortalTarget(document.body);
    }
  }, []);


  const isWorkStageView = secondaryCollectionName === 'workStages';
  const [allWorkStages, setAllWorkStages] = useState<MultiSelectOption[]>([]);
  const [allSequentialStages, setAllSequentialStages] = useState<MultiSelectOption[]>([]);
  const [allJobs, setAllJobs] = useState<{ value: string; label: string }[]>([]);
  const [refDataLoading, setRefDataLoading] = useState(false);

  const fetchPrimaryItems = useCallback(async () => {
    if (!firestore) return;
    setLoadingPrimary(true);
    try {
        const snapshot = await getDocs(query(collection(firestore, primaryCollectionName)));
        let items = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as T))
            .filter(item => item && typeof item.name === 'string'); // Filter out items without a name
        
        items.sort((a, b) => {
            const orderA = a.order ?? Infinity;
            const orderB = b.order ?? Infinity;
            if (orderA !== orderB) return orderA - orderB;
            return a.name.localeCompare(b.name, 'ar');
        });
        setPrimaryItems(items);
    } catch (e) {
        console.error("Error fetching primary items:", e);
        toast({ variant: 'destructive', title: `فشل جلب ${primaryTitle}` });
    } finally {
        setLoadingPrimary(false);
    }
  }, [firestore, primaryCollectionName, primaryTitle, toast]);

  useEffect(() => {
    fetchPrimaryItems();
  }, [fetchPrimaryItems]);
  
  const fetchSecondaryItems = useCallback(async () => {
    if (!selectedPrimary || !firestore || !secondaryCollectionName) {
        setSecondaryItems([]);
        return;
    }
    setLoadingSecondary(true);
    try {
        const collectionPath = `${primaryCollectionName}/${selectedPrimary.id}/${secondaryCollectionName}`;
        const snapshot = await getDocs(query(collection(firestore, collectionPath)));
        let items = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as S))
            .filter(item => item && typeof item.name === 'string'); // Filter out items without a name
        
        items.sort((a, b) => {
            const orderA = a.order ?? Infinity;
            const orderB = b.order ?? Infinity;
            if (orderA !== orderB) return orderA - orderB;
            return a.name.localeCompare(b.name, 'ar');
        });
        
        setSecondaryItems(items);
    } catch (e) {
        console.error("Error fetching secondary items:", e);
        toast({ variant: 'destructive', title: `فشل جلب ${secondaryTitle}` });
    } finally {
        setLoadingSecondary(false);
    }
  }, [selectedPrimary, firestore, primaryCollectionName, secondaryCollectionName, secondaryTitle, toast]);


  const handleSelectPrimary = (item: T) => {
    setSelectedPrimary(item);
  };
  
  useEffect(() => {
    const primaryExists = selectedPrimary && primaryItems.some(p => p.id === selectedPrimary.id);
    if (!primaryExists && primaryItems.length > 0) {
      setSelectedPrimary(primaryItems[0]);
    } else if (primaryItems.length === 0) {
      setSelectedPrimary(null);
    }
  }, [primaryItems, selectedPrimary]);

  useEffect(() => {
    fetchSecondaryItems();
  }, [fetchSecondaryItems]);


  const fetchReferenceDataForDialog = useCallback(async () => {
    if (!firestore) return;
    setRefDataLoading(true);
    try {
        const jobsSnapshot = await getDocs(query(collectionGroup(firestore, 'jobs')));
        const uniqueJobs = new Map<string, { value: string; label: string }>();
        jobsSnapshot.forEach(doc => {
            const jobName = doc.data().name;
            if (jobName && typeof jobName === 'string') {
                const trimmedName = jobName.trim();
                if (trimmedName && !uniqueJobs.has(trimmedName)) {
                    uniqueJobs.set(trimmedName, { value: trimmedName, label: trimmedName });
                }
            }
        });
        setAllJobs(Array.from(uniqueJobs.values()).sort((a,b) => a.label.localeCompare(b.label, 'ar')));

        const stagesSnapshot = await getDocs(query(collectionGroup(firestore, 'workStages')));
        const uniqueStages = new Map<string, WorkStage>();
        stagesSnapshot.forEach(doc => {
            const stageId = doc.id;
            if (!uniqueStages.has(stageId)) {
                 uniqueStages.set(stageId, {id: stageId, ...doc.data()} as WorkStage);
            }
        });
        const allStagesData = Array.from(uniqueStages.values());
        setAllWorkStages(allStagesData.sort((a,b) => a.name.localeCompare(b.name, 'ar')).map(s => ({ value: s.id, label: s.name })));
        setAllSequentialStages(allStagesData.filter(s => s.stageType !== 'parallel').sort((a,b) => a.name.localeCompare(b.name, 'ar')).map(s => ({ value: s.id, label: s.name })));

    } catch (e) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب البيانات المرجعية للنموذج.' });
    } finally {
        setRefDataLoading(false);
    }
  }, [firestore, toast]);


  useEffect(() => {
    if (isWorkStageView && (isSecondaryDialogOpen || isPrimaryDialogOpen)) {
      fetchReferenceDataForDialog();
    }
  }, [isWorkStageView, isPrimaryDialogOpen, isSecondaryDialogOpen, fetchReferenceDataForDialog]);


  const openDialog = (type: 'primary' | 'secondary', item: any | null = null) => {
    setEditingItem(item);
    setItemName(item?.name || '');
    if (isWorkStageView && type === 'secondary') {
        setItemRoles(item?.allowedRoles || []);
        setItemStageType(item?.stageType || 'sequential');
        setItemTrackingType(item?.trackingType || 'duration');
        setItemDuration(item?.expectedDurationDays ?? '');
        setItemMaxOccurrences(item?.maxOccurrences ?? '');
        setItemAllowManualCompletion(item?.allowManualCompletion || false);
        setItemEnableModificationTracking(item?.enableModificationTracking || false);
        setItemNextStageIds(item?.nextStageIds || []);
        setItemAllowedDuringStages(item?.allowedDuringStages || []);
    }
    if (type === 'primary') setIsPrimaryDialogOpen(true);
    else setIsSecondaryDialogOpen(true);
  }

  const closeDialog = () => {
    setIsPrimaryDialogOpen(false);
    setIsSecondaryDialogOpen(false);
    setEditingItem(null);
    setItemName('');
    setItemRoles([]);
    setItemStageType('sequential');
    setItemTrackingType('duration');
    setItemDuration('');
    setItemMaxOccurrences('');
    setItemAllowManualCompletion(false);
    setItemEnableModificationTracking(false);
    setItemNextStageIds([]);
    setItemAllowedDuringStages([]);
  }

  const handleSave = async (type: 'primary' | 'secondary') => {
    if (!firestore || !itemName.trim()) return;
    
    const collectionPath = type === 'primary' ? primaryCollectionName : `${primaryCollectionName}/${selectedPrimary?.id}/${secondaryCollectionName}`;
    
    try {
      const dataToSave: any = { name: itemName };
       if (isWorkStageView && type === 'secondary') {
          dataToSave.stageType = itemStageType;
          dataToSave.allowedRoles = itemRoles;
          dataToSave.trackingType = itemTrackingType;
          dataToSave.nextStageIds = itemNextStageIds;
          dataToSave.allowManualCompletion = itemAllowManualCompletion;
          dataToSave.allowedDuringStages = itemAllowedDuringStages;
          dataToSave.enableModificationTracking = itemEnableModificationTracking;
          
          if (itemTrackingType === 'duration') {
              dataToSave.expectedDurationDays = Number(itemDuration) || null;
              dataToSave.maxOccurrences = null;
          } else if (itemTrackingType === 'occurrence') {
              dataToSave.maxOccurrences = Number(itemMaxOccurrences) || null;
              dataToSave.expectedDurationDays = null;
          } else { // for 'none'
              dataToSave.expectedDurationDays = null;
              dataToSave.maxOccurrences = null;
          }
      }

      if (editingItem) { // Update
        const itemRef = doc(firestore, collectionPath, editingItem.id);
        const { order, ...updateData } = dataToSave as any;
        await updateDoc(itemRef, updateData);
        toast({ title: 'نجاح', description: 'تم تحديث العنصر.' });
      } else { // Create
        const collectionRef = collection(firestore, collectionPath);
        const currentList = type === 'primary' ? primaryItems : secondaryItems;
        const newOrder = currentList.length;
        (dataToSave as any).order = newOrder;
        await addDoc(collectionRef, dataToSave);
        toast({ title: 'نجاح', description: 'تمت إضافة العنصر.' });
      }
      
      if (type === 'primary') await fetchPrimaryItems();
      else await fetchSecondaryItems();
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
        if (type === 'primary') await fetchPrimaryItems();
        else await fetchSecondaryItems();
      } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف العنصر. قد يكون مرتبطًا ببيانات أخرى.' });
      } finally {
        setIsDeleteDialogOpen(false);
        setItemToDelete(null);
      }
  };

  const handleOrderChange = (type: 'primary' | 'secondary', id: string, value: string) => {
    const setOrders = type === 'primary' ? setPrimaryOrderValues : setSecondaryOrderValues;
    const setChanged = type === 'primary' ? setIsPrimaryOrderChanged : setIsSecondaryOrderChanged;
    setOrders(prev => ({...prev, [id]: value}));
    setChanged(true);
  };
  
  const handleSaveOrder = async (type: 'primary' | 'secondary') => {
    if (!firestore) return;
    
    const list = type === 'primary' ? primaryItems : secondaryItems;
    const orders = type === 'primary' ? primaryOrderValues : secondaryOrderValues;
    const setChanged = type === 'primary' ? setIsPrimaryOrderChanged : setIsSecondaryOrderChanged;
    const fetchFn = type === 'primary' ? fetchPrimaryItems : fetchSecondaryItems;
    const collectionPath = type === 'primary' ? primaryCollectionName : `${primaryCollectionName}/${selectedPrimary?.id}/${secondaryCollectionName}`;

    const batch = writeBatch(firestore);
    list.forEach(item => {
        const newOrder = orders[item.id!];
        if (newOrder !== undefined && Number(newOrder) !== item.order) {
            const docRef = doc(firestore, collectionPath, item.id!);
            batch.update(docRef, { order: Number(newOrder) });
        }
    });

    try {
        await batch.commit();
        toast({ title: 'نجاح', description: 'تم حفظ الترتيب الجديد.'});
        setChanged(false);
        await fetchFn();
    } catch(e) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ الترتيب.'});
    }
  };


  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
         <div className="flex items-center gap-3 overflow-hidden">
            <div className="h-6 w-6 flex-shrink-0 text-primary">{icon}</div>
            <div className="flex-1 min-w-0">
                <CardTitle className="whitespace-nowrap truncate">{`إدارة ${primaryTitle}`}{secondaryTitle && ` و ${secondaryTitle}`}</CardTitle>
            </div>
        </div>
        <Button onClick={onBack} variant="outline" className="flex-shrink-0"><ArrowRight className="ml-2 h-4 w-4" /> العودة</Button>
      </CardHeader>
      <CardContent className={cn("grid grid-cols-1 gap-6", secondaryTitle && "md:grid-cols-2")}>
        {/* Primary List */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-semibold">{primaryTitle}</h4>
            <Button size="sm" onClick={() => openDialog('primary')} disabled={disablePrimaryActions}><Plus className="ml-2 h-4 w-4" /> إضافة</Button>
          </div>
          <ScrollArea className="h-72 border rounded-md">
            {loadingPrimary ? <div className='p-4 text-center'><Loader2 className="animate-spin mx-auto" /></div> : primaryItems.length === 0 ? <p className='text-center text-muted-foreground p-4'>لا توجد بيانات</p> : (
              primaryItems.map((item) => (
                <div key={item.id} onClick={() => handleSelectPrimary(item)}
                  className={`flex justify-between items-center p-2 rounded-md cursor-pointer ${selectedPrimary?.id === item.id ? 'bg-accent' : 'hover:bg-muted/50'}`}>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="number"
                      value={primaryOrderValues[item.id] ?? item.order ?? ''}
                      onChange={e => handleOrderChange('primary', item.id, e.target.value)}
                      onClick={e => e.stopPropagation()}
                      className="h-7 w-14"
                    />
                    <span>{item.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openDialog('primary', item); }} disabled={disablePrimaryActions}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); openDeleteDialog(item, 'primary'); }} disabled={disablePrimaryActions}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))
            )}
          </ScrollArea>
           {isPrimaryOrderChanged && (
             <div className="flex justify-end mt-2">
                <Button size="sm" onClick={() => handleSaveOrder('primary')}>
                    <Save className="ml-2 h-4 w-4" /> حفظ الترتيب
                </Button>
            </div>
           )}
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
              <ScrollArea className="h-72 border rounded-md">
                {loadingSecondary ? <div className='p-4 text-center'><Loader2 className="animate-spin mx-auto" /></div> : !selectedPrimary ? <div className='text-center text-muted-foreground p-4'>...</div> : secondaryItems.length === 0 ? <p className='text-center text-muted-foreground p-4'>لا توجد بيانات</p> : (
                  secondaryItems.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-2 rounded-md hover:bg-muted/50">
                        <div className="flex items-center gap-2 flex-wrap">
                            <Input
                                type="number"
                                value={secondaryOrderValues[item.id] ?? item.order ?? ''}
                                onChange={e => handleOrderChange('secondary', item.id, e.target.value)}
                                onClick={e => e.stopPropagation()}
                                className="h-7 w-14"
                            />
                            <span>{item.name}</span>
                            {isWorkStageView && item.trackingType === 'duration' && item.expectedDurationDays != null && <Badge variant="outline">{item.expectedDurationDays} أيام</Badge>}
                            {isWorkStageView && item.trackingType === 'occurrence' && item.maxOccurrences && <Badge variant="outline">تكرار {item.maxOccurrences}x</Badge>}
                            {isWorkStageView && item.trackingType === 'none' && <Badge variant="outline" className='bg-gray-100'>حدث</Badge>}
                            {isWorkStageView && item.enableModificationTracking && <Badge variant="outline" className="bg-orange-100 text-orange-800">تتبع التعديلات</Badge>}
                            {isWorkStageView && item.allowedRoles && item.allowedRoles.map(role => (
                                <Badge key={role} variant="secondary" className="font-normal">{role}</Badge>
                            ))}
                        </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDialog('secondary', item)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => openDeleteDialog(item, 'secondary')}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))
                )}
              </ScrollArea>
              {isSecondaryOrderChanged && (
                <div className="flex justify-end mt-2">
                    <Button size="sm" onClick={() => handleSaveOrder('secondary')}>
                        <Save className="ml-2 h-4 w-4" /> حفظ الترتيب
                    </Button>
                </div>
              )}
            </div>
        )}
      </CardContent>

      <Dialog open={isPrimaryDialogOpen || isSecondaryDialogOpen} onOpenChange={closeDialog}>
        <DialogContent
            className="max-w-4xl"
            onInteractOutside={(e) => {
              const target = e.target as HTMLElement;
              if (
                target.closest('[cmdk-root]') ||
                target.closest('[role="listbox"]') ||
                target.closest('[data-radix-popper-content-wrapper]')
              ) {
                e.preventDefault();
              }
            }}
        >
          <DialogHeader>
            <DialogTitle>{editingItem ? 'تعديل' : 'إضافة'} {isPrimaryDialogOpen ? primarySingularTitle : secondarySingularTitle}</DialogTitle>
          </DialogHeader>
           <ScrollArea className="max-h-[70vh]">
            <div className="py-4 px-2 space-y-6">
                <div className="px-4 grid gap-2">
                    <Label htmlFor="item-name">{`اسم ${isPrimaryDialogOpen ? primarySingularTitle : secondarySingularTitle}`}</Label>
                    <Input id="item-name" value={itemName} onChange={(e) => setItemName(e.target.value)} />
                </div>

                {isWorkStageView && !isPrimaryDialogOpen && (
                    <div className="grid md:grid-cols-2 gap-6 px-4">
                        {/* --- Left Column --- */}
                        <div className="space-y-6 rounded-lg border p-4">
                             <h3 className="font-semibold text-base mb-2">منطق المرحلة</h3>

                             <div className="grid gap-2">
                                <Label>نوع المرحلة</Label>
                                <Select value={itemStageType} onValueChange={(v) => setItemStageType(v as any)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="sequential">تسلسلية (خطوة أساسية في سير العمل)</SelectItem>
                                        <SelectItem value="parallel">موازية (خدمية مثل التعديلات)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            
                             <div className="grid gap-2">
                                <Label>نوع التتبع</Label>
                                <Select value={itemTrackingType} onValueChange={(v) => setItemTrackingType(v as any)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="duration">بالمدة الزمنية</SelectItem>
                                        <SelectItem value="occurrence">بعدَد مرات الحدوث</SelectItem>
                                        <SelectItem value="none">لا شيء (حدث واحد)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    {itemTrackingType === 'duration' && 'تتبع المرحلة بالوقت، مفيد للمهام التي تستغرق وقتاً محدداً.'}
                                    {itemTrackingType === 'occurrence' && 'تتبع المرحلة بعدد المرات التي تكتمل فيها، مثل عدد الزيارات أو التعديلات.'}
                                    {itemTrackingType === 'none' && 'مرحلة بسيطة تكتمل مرة واحدة فقط وتنتقل للتالية.'}
                                </p>
                            </div>

                            {itemTrackingType === 'duration' && (
                                <div className="grid gap-2">
                                    <Label htmlFor="item-duration">المدة المتوقعة (بالأيام)</Label>
                                    <Input id="item-duration" type="number" value={itemDuration} onChange={(e) => setItemDuration(e.target.value === '' ? '' : Number(e.target.value))} />
                                </div>
                            )}
                            {itemTrackingType === 'occurrence' && (
                              <div className="p-3 border rounded-md space-y-4 bg-background">
                                <div className="grid gap-2">
                                    <Label htmlFor="item-occurrences">الحد الأقصى للتكرار</Label>
                                    <Input id="item-occurrences" type="number" value={itemMaxOccurrences} onChange={(e) => setItemMaxOccurrences(e.target.value === '' ? '' : Number(e.target.value))} placeholder="مثال: 5" />
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Checkbox id="allowManualCompletion" checked={itemAllowManualCompletion} onCheckedChange={(checked) => setItemAllowManualCompletion(!!checked)} />
                                  <Label htmlFor="allowManualCompletion">السماح بالإكمال اليدوي قبل الوصول للحد الأقصى</Label>
                                </div>
                              </div>
                            )}
                        </div>

                        {/* --- Right Column --- */}
                        <div className="space-y-6 rounded-lg border p-4">
                             <h3 className="font-semibold text-base mb-2">العلاقات والصلاحيات</h3>
                             
                             <div className="grid gap-2">
                                <Label>الأدوار المسؤولة (المسميات الوظيفية)</Label>
                                <MultiSelect
                                    options={allJobs}
                                    selected={itemRoles}
                                    onChange={setItemRoles}
                                    placeholder="اتركه فارغًا ليكون متاحًا للجميع"
                                    disabled={refDataLoading}
                                    menuPortalTarget={portalTarget}
                                />
                            </div>

                            {itemStageType === 'parallel' && (
                                 <div className="grid gap-2">
                                    <Label>يظهر فقط أثناء المراحل التالية (اختياري)</Label>
                                    <MultiSelect
                                        options={allSequentialStages.filter(s => s.value !== editingItem?.id)}
                                        selected={itemAllowedDuringStages}
                                        onChange={setItemAllowedDuringStages}
                                        placeholder="اتركه فارغًا ليظهر دائماً..."
                                        disabled={refDataLoading}
                                        menuPortalTarget={portalTarget}
                                    />
                                </div>
                            )}
                            
                            <div className="grid gap-2">
                                <Label>المراحل التالية المحتملة (للربط)</Label>
                                <MultiSelect
                                    options={allWorkStages.filter(s => s.value !== editingItem?.id)}
                                    selected={itemNextStageIds}
                                    onChange={setItemNextStageIds}
                                    placeholder="اختر مرحلة أو أكثر للانتقال إليها..."
                                    disabled={refDataLoading}
                                    menuPortalTarget={portalTarget}
                                />
                            </div>

                             <div className="flex items-center space-x-2 pt-4">
                               <Checkbox id="enableModificationTracking" checked={itemEnableModificationTracking} onCheckedChange={(checked) => setItemEnableModificationTracking(!!checked)} />
                               <Label htmlFor="enableModificationTracking">تفعيل عداد التعديلات لهذه المرحلة</Label>
                            </div>
                        </div>
                    </div>
                )}
            </div>
          </ScrollArea>
          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={closeDialog}>إلغاء</Button>
            <Button onClick={() => handleSave(isPrimaryDialogOpen ? 'primary' : 'secondary')}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent dir="rtl">
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

// --- NEW TransactionTypeManager Component ---
function TransactionTypeManager({ onBack }: { onBack: () => void }) {
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [transactionTypes, setTransactionTypes] = useState<TransactionType[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TransactionType | null>(null);
  const [itemToDelete, setItemToDelete] = useState<TransactionType | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const [itemName, setItemName] = useState('');
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  
  const [orderValues, setOrderValues] = useState<Record<string, string>>({});
  const [isOrderChanged, setIsOrderChanged] = useState(false);

  const departmentOptions = useMemo(() => departments.map(d => ({ value: d.id, label: d.name })), [departments]);
  const departmentsMap = useMemo(() => new Map(departments.map(d => [d.id, d.name])), [departments]);


  const fetchData = useCallback(async () => {
    if (!firestore) return;
    setLoading(true);
    try {
      const [typesSnap, deptsSnap] = await Promise.all([
        getDocs(query(collection(firestore, 'transactionTypes'))),
        getDocs(query(collection(firestore, 'departments'), orderBy('name'))),
      ]);
      
      let typesData = typesSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as TransactionType))
        .filter(t => t && t.name);
      
      typesData.sort((a, b) => {
          const orderA = a.order ?? Infinity;
          const orderB = b.order ?? Infinity;
          if(orderA !== orderB) return orderA - orderB;
          return a.name.localeCompare(b.name, 'ar');
      });
      
      setTransactionTypes(typesData);
      setDepartments(deptsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)).filter(d => d && d.name));
    } catch (e) {
      console.error("Error fetching transaction types:", e);
      toast({ variant: 'destructive', title: `فشل جلب أنواع المعاملات` });
    } finally {
      setLoading(false);
    }
  }, [firestore, toast]);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openDialog = (item: TransactionType | null = null) => {
    setEditingItem(item);
    setItemName(item?.name || '');
    setSelectedDepartments(item?.departmentIds || []);
    setIsDialogOpen(true);
  };
  
  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingItem(null);
    setItemName('');
    setSelectedDepartments([]);
  };
  
  const handleOrderChange = (id: string, value: string) => {
    setOrderValues(prev => ({...prev, [id]: value}));
    setIsOrderChanged(true);
  };

  const handleSaveOrder = async () => {
    if(!firestore) return;
    const batch = writeBatch(firestore);
    transactionTypes.forEach(item => {
        const newOrder = orderValues[item.id!];
        if (newOrder !== undefined && Number(newOrder) !== item.order) {
            batch.update(doc(firestore, 'transactionTypes', item.id!), { order: Number(newOrder) });
        }
    });

    try {
        await batch.commit();
        toast({ title: 'نجاح', description: 'تم حفظ الترتيب الجديد.' });
        setIsOrderChanged(false);
        await fetchData();
    } catch (e) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ الترتيب.' });
    }
  };

  
  const handleImportOldTypes = async () => {
    if (!firestore) return;
    setIsImporting(true);
    try {
        const batch = writeBatch(firestore);
        const rootTypesRef = collection(firestore, 'transactionTypes');
        
        const existingNewTypesSnap = await getDocs(rootTypesRef);
        const existingNewTypeNames = new Set(existingNewTypesSnap.docs.map(d => d.data().name));

        const oldTypesQuery = query(collectionGroup(firestore, 'transactionTypes'));
        const oldTypesSnapshot = await getDocs(oldTypesQuery);

        let importedCount = 0;

        for (const oldTypeDoc of oldTypesSnapshot.docs) {
            const oldTypeData = oldTypeDoc.data();
            const oldTypeName = oldTypeData.name;
            const parentDeptId = oldTypeDoc.ref.parent.parent?.id;

            if (oldTypeName && !existingNewTypeNames.has(oldTypeName)) {
                const newTypeRef = doc(rootTypesRef);
                batch.set(newTypeRef, {
                    name: oldTypeName,
                    departmentIds: parentDeptId ? [parentDeptId] : []
                });
                existingNewTypeNames.add(oldTypeName);
                importedCount++;
            }
        }

        if (importedCount > 0) {
            await batch.commit();
            toast({ title: 'نجاح', description: `تم استيراد ${importedCount} أنواع معاملات فريدة بنجاح.` });
            fetchData();
        } else {
            toast({ title: 'لا توجد بيانات جديدة', description: 'لم يتم العثور على أنواع معاملات قديمة غير موجودة حاليًا.' });
        }

    } catch (error) {
        console.error("Error importing old transaction types:", error);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل استيراد البيانات القديمة.' });
    } finally {
        setIsImporting(false);
    }
};

  const handleSave = async () => {
    if (!firestore || !itemName.trim()) return;
    try {
        const dataToSave = { name: itemName, departmentIds: selectedDepartments };
        if (editingItem) {
            await updateDoc(doc(firestore, 'transactionTypes', editingItem.id), dataToSave);
            toast({ title: 'نجاح', description: 'تم تحديث نوع المعاملة.' });
        } else {
            const newOrder = transactionTypes.length;
            await addDoc(collection(firestore, 'transactionTypes'), { ...dataToSave, order: newOrder });
            toast({ title: 'نجاح', description: 'تمت إضافة نوع المعاملة.' });
        }
        fetchData();
        closeDialog();
    } catch(e) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ نوع المعاملة.' });
    }
  };
  
  const handleDelete = async () => {
    if (!firestore || !itemToDelete) return;
    try {
        await deleteDoc(doc(firestore, 'transactionTypes', itemToDelete.id));
        toast({ title: 'نجاح', description: 'تم حذف نوع المعاملة.' });
        fetchData();
    } catch (e) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف نوع المعاملة.' });
    } finally {
        setItemToDelete(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <FileText className="h-6 w-6 flex-shrink-0" />
          <CardTitle className="whitespace-nowrap truncate">إدارة أنواع المعاملات</CardTitle>
        </div>
        <Button onClick={onBack} variant="outline"><ArrowRight className="ml-2 h-4 w-4" /> العودة</Button>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center mb-4">
          <Button size="sm" onClick={() => openDialog()}><PlusCircle className="ml-2 h-4 w-4" /> إضافة نوع جديد</Button>
            <Button onClick={handleImportOldTypes} size="sm" variant="outline" disabled={isImporting}>
                {isImporting ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <DownloadCloud className="ml-2 h-4 w-4" />}
                استيراد الأنواع القديمة
            </Button>
        </div>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">الترتيب</TableHead>
                <TableHead>اسم نوع المعاملة</TableHead>
                <TableHead>الأقسام المرتبطة</TableHead>
                <TableHead className="w-[100px]"><span className="sr-only">الإجراءات</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && Array.from({length: 3}).map((_, i) => <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-6 w-full" /></TableCell></TableRow>)}
              {!loading && transactionTypes.length === 0 && <TableRow><TableCell colSpan={4} className="text-center h-24">لا توجد بيانات</TableCell></TableRow>}
              {!loading && transactionTypes.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Input 
                      type="number"
                      value={orderValues[item.id] ?? item.order ?? ''}
                      onChange={e => handleOrderChange(item.id, e.target.value)}
                      className="h-8 w-16"
                    />
                  </TableCell>
                  <TableCell className="font-semibold">{item.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {item.departmentIds?.map(id => <Badge key={id} variant="secondary">{departmentsMap.get(id) || 'قسم محذوف'}</Badge>) || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDialog(item)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setItemToDelete(item)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
         {isOrderChanged && (
            <div className="flex justify-end mt-4">
                <Button size="sm" onClick={handleSaveOrder}>
                    <Save className="ml-2 h-4 w-4" /> حفظ الترتيب
                </Button>
            </div>
         )}
      </CardContent>
      
       <Dialog open={isDialogOpen} onOpenChange={closeDialog}>
        <DialogContent 
            dir="rtl"
             onInteractOutside={(e) => {
              const target = e.target as HTMLElement;
              if (
                target.closest('[cmdk-root]') ||
                target.closest('[role="listbox"]') ||
                target.closest('[data-radix-popper-content-wrapper]')
              ) {
                e.preventDefault();
              }
            }}
        >
            <DialogHeader>
                <DialogTitle>{editingItem ? 'تعديل نوع معاملة' : 'إضافة نوع معاملة جديد'}</DialogTitle>
            </DialogHeader>
             <div className="grid gap-4 py-4">
                <div className='grid gap-2'>
                    <Label htmlFor="item-name">اسم نوع المعاملة</Label>
                    <Input id="item-name" value={itemName} onChange={(e) => setItemName(e.target.value)} />
                </div>
                <div className="grid gap-2">
                    <Label>الأقسام المرتبطة</Label>
                    <MultiSelect options={departmentOptions} selected={selectedDepartments} onChange={setSelectedDepartments} placeholder="اختر الأقسام..." />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={closeDialog}>إلغاء</Button>
                <Button onClick={handleSave}>حفظ</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
        <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
                <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                <AlertDialogDescription>سيتم حذف "{itemToDelete?.name}" بشكل دائم.</AlertDialogDescription>
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

// --- Main Component (Router) ---
export function ReferenceDataManager() {
    const [view, setView] = useState<'dashboard' | 'depts' | 'locations' | 'transTypes' | 'companies' | 'workStages'>('dashboard');

    const [counts, setCounts] = useState({ depts: 0, jobs: 0, govs: 0, areas: 0, transTypes: 0, companies: 0, workStages: 0 });
    const [loadingCounts, setLoadingCounts] = useState(true);
    const { firestore } = useFirebase();
    const { toast } = useToast();

    // Fetch counts for the dashboard
    useEffect(() => {
        if (!firestore) return;

        const fetchCounts = async () => {
            setLoadingCounts(true);
            try {
                const [deptsSnap, govsSnap, companiesSnap, jobsSnap, areasSnap, transTypesSnap, workStagesSnap] = await Promise.all([
                    getDocs(query(collection(firestore, 'departments'))),
                    getDocs(query(collection(firestore, 'governorates'))),
                    getDocs(query(collection(firestore, 'companies'))),
                    getDocs(query(collectionGroup(firestore, 'jobs'))),
                    getDocs(query(collectionGroup(firestore, 'areas'))),
                    getDocs(query(collection(firestore, 'transactionTypes'))),
                    getDocs(query(collectionGroup(firestore, 'workStages'))),
                ]);

                setCounts({
                    depts: deptsSnap.size,
                    govs: govsSnap.size,
                    companies: companiesSnap.size,
                    jobs: jobsSnap.size,
                    areas: areasSnap.size,
                    transTypes: transTypesSnap.size,
                    workStages: workStagesSnap.size,
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
            icon={<Building className="h-full w-full" />}
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
         return <TransactionTypeManager onBack={() => setView('dashboard')} />
    }

    if (view === 'workStages') {
        return <ManagerView
            primaryTitle="أقسام العمل"
            primarySingularTitle="قسم"
            primaryCollectionName="departments"
            secondaryTitle="مراحل العمل"
            secondarySingularTitle="مرحلة عمل"
            secondaryCollectionName="workStages"
            icon={<Workflow className="h-full w-full" />}
            disablePrimaryActions={true}
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
                 <StatCard 
                    title="مراحل العمل" 
                    count={counts.workStages} 
                    icon={<Workflow className="h-full w-full" />} 
                    onNavigate={() => setView('workStages')} 
                    color="purple" 
                    loading={loadingCounts} 
                />
            </CardContent>
        </Card>
    );
}

    