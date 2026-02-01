

'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
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
import { Plus, Pencil, Trash2, Loader2, Building, FileText, ArrowRight, Workflow, Globe, ArrowUp, ArrowDown } from 'lucide-react';
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


// Reusable component for the management UI (previously the whole component)
function ManagerView<T extends {id: string, name: string, allowedRoles?: string[], expectedDurationDays?: number, trackingType?: 'duration' | 'occurrence' | 'none', maxOccurrences?: number, order?: number}, S extends {id: string, name: string, allowedRoles?: string[], expectedDurationDays?: number, trackingType?: 'duration' | 'occurrence' | 'none', maxOccurrences?: number, order?: number, nextStageIds?: string[], allowedDuringStages?: string[], stageType?: 'sequential' | 'parallel'}>({
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


  const isWorkStageView = secondaryCollectionName === 'workStages';
  const [allWorkStages, setAllWorkStages] = useState<MultiSelectOption[]>([]);
  const [allSequentialStages, setAllSequentialStages] = useState<MultiSelectOption[]>([]);
  const [allJobs, setAllJobs] = useState<{ value: string; label: string }[]>([]);
  const [refDataLoading, setRefDataLoading] = useState(false);
  
  const primaryQueryConstraints = useMemo(() => [orderBy('name')], []);
  const { data: primaryData, loading: primaryLoading, error: primaryError } = useSubscription<T>(firestore, primaryCollectionName, primaryQueryConstraints);
  
   useEffect(() => {
    setLoadingPrimary(primaryLoading);
    if(primaryError) {
        toast({ variant: 'destructive', title: `فشل جلب ${primaryTitle}`, description: primaryError.message });
    }
    if (primaryData) {
      setPrimaryItems(primaryData);
    }
  }, [primaryData, primaryLoading, primaryError, primaryTitle, toast]);

  const handleSelectPrimary = useCallback((item: T) => {
    setSelectedPrimary(item);
  }, []);

  // Effect to select the first item by default
  useEffect(() => {
    const primaryExists = selectedPrimary && primaryItems.some(p => p.id === selectedPrimary.id);
    if (!primaryExists && primaryItems.length > 0) {
      setSelectedPrimary(primaryItems[0]);
    } else if (primaryItems.length === 0) {
      setSelectedPrimary(null);
    }
  }, [primaryItems, selectedPrimary]);

  // Effect to fetch secondary items when a primary item is selected
  useEffect(() => {
    if (!selectedPrimary) {
      setSecondaryItems([]);
      return;
    }
    
    if (!firestore || !secondaryCollectionName) return;

    setLoadingSecondary(true);
    const fetchSecondary = async () => {
        try {
            const secondaryQuery = query(collection(firestore, `${primaryCollectionName}/${selectedPrimary.id}/${secondaryCollectionName}`));
            const secondarySnapshot = await getDocs(secondaryQuery);
            let fetchedItems = secondarySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as S));
            
            fetchedItems.sort((a: any, b: any) => {
                if (a.order !== undefined && b.order !== undefined) {
                    return a.order - b.order;
                }
                return a.name.localeCompare(b.name, 'ar');
            });
            
            setSecondaryItems(fetchedItems);
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: `فشل جلب ${secondaryTitle}` });
        } finally {
            setLoadingSecondary(false);
        }
    };
    
    fetchSecondary();
  }, [selectedPrimary, firestore, primaryCollectionName, secondaryCollectionName, secondaryTitle, toast]);


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
        setAllWorkStages(allStagesData.sort((a,b) => a.name.localeCompare(b.label, 'ar')).map(s => ({ value: s.id, label: s.name })));
        setAllSequentialStages(allStagesData.filter(s => s.stageType !== 'parallel').sort((a,b) => a.name.localeCompare(b.label, 'ar')).map(s => ({ value: s.id, label: s.name })));

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
    setItemNextStageIds([]);
    setItemAllowedDuringStages([]);
  }
  
  const reorderItems = async (type: 'primary' | 'secondary', index: number, direction: 'up' | 'down') => {
    const list = type === 'primary' ? primaryItems : secondaryItems;
    const setList = type === 'primary' ? setPrimaryItems : setSecondaryItems;
    if (!list || list.length < 2) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= list.length) return;

    const reorderedList = [...list];
    [reorderedList[index], reorderedList[newIndex]] = [reorderedList[newIndex], reorderedList[index]];
    
    setList(reorderedList as any); // Optimistic update of UI

    if (!firestore) return;
    const collectionPath = type === 'primary' ? primaryCollectionName : `${primaryCollectionName}/${selectedPrimary?.id}/${secondaryCollectionName}`;
    if (!collectionPath) return;

    try {
        const batch = writeBatch(firestore);
        reorderedList.forEach((item, idx) => {
            const docRef = doc(firestore, collectionPath, item.id);
            batch.update(docRef, { order: idx });
        });
        await batch.commit();
        toast({ title: 'نجاح', description: 'تم تحديث الترتيب.' });
    } catch (e) {
        console.error('Failed to save order:', e);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ الترتيب الجديد.' });
        setList(list as any); // Revert UI on failure
    }
  };


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
            <Button size="sm" onClick={() => openDialog('primary')} disabled={disablePrimaryActions}><Plus className="ml-2 h-4 w-4" /> إضافة</Button>
          </div>
          <ScrollArea className="h-72 border rounded-md p-2">
            {loadingPrimary ? <div className='p-4 text-center'><Loader2 className="animate-spin mx-auto" /></div> : primaryItems.length === 0 ? <p className='text-center text-muted-foreground p-4'>لا توجد بيانات</p> : (
              primaryItems.map((item, index) => (
                <div key={item.id} onClick={() => handleSelectPrimary(item)}
                  className={`flex justify-between items-center p-2 rounded-md cursor-pointer ${selectedPrimary?.id === item.id ? 'bg-accent' : 'hover:bg-muted/50'}`}>
                  <span>{item.name}</span>
                  <div className="flex items-center gap-1">
                    <div className="flex flex-col">
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); reorderItems('primary', index, 'up'); }} disabled={index === 0}>
                            <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); reorderItems('primary', index, 'down'); }} disabled={index === primaryItems.length - 1}>
                            <ArrowDown className="h-3 w-3" />
                        </Button>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openDialog('primary', item); }} disabled={disablePrimaryActions}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); openDeleteDialog(item, 'primary'); }} disabled={disablePrimaryActions}><Trash2 className="h-4 w-4" /></Button>
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
                  secondaryItems.map((item, index) => (
                    <div key={item.id} className="flex justify-between items-center p-2 rounded-md hover:bg-muted/50">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>{item.name}</span>
                        {isWorkStageView && item.trackingType === 'duration' && item.expectedDurationDays != null && <Badge variant="outline">{item.expectedDurationDays} أيام</Badge>}
                        {isWorkStageView && item.trackingType === 'occurrence' && item.maxOccurrences && <Badge variant="outline">تكرار {item.maxOccurrences}x</Badge>}
                        {isWorkStageView && item.trackingType === 'none' && <Badge variant="outline" className='bg-gray-100'>حدث</Badge>}
                        {isWorkStageView && item.allowedRoles && item.allowedRoles.map(role => (
                            <Badge key={role} variant="secondary" className="font-normal">{role}</Badge>
                        ))}
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="flex flex-col">
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => reorderItems('secondary', index, 'up')} disabled={index === 0}>
                                <ArrowUp className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => reorderItems('secondary', index, 'down')} disabled={index === secondaryItems.length - 1}>
                                <ArrowDown className="h-3 w-3" />
                            </Button>
                        </div>
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
        <DialogContent
            className="sm:max-w-lg"
            onInteractOutside={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest('[cmdk-root]') || target.closest('[data-radix-popper-content-wrapper]') || target.closest('[role="dialog"]')) {
                  e.preventDefault();
                }
            }}
        >
          <DialogHeader>
            <DialogTitle>{editingItem ? 'تعديل' : 'إضافة'} عنصر جديد</DialogTitle>
            <DialogDescription>
              {`أدخل اسم ${isPrimaryDialogOpen ? primarySingularTitle : secondarySingularTitle} الجديد.`}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className="grid gap-4 py-4 px-6">
                <div className='grid gap-2'>
                    <Label htmlFor="item-name">الاسم</Label>
                    <Input id="item-name" value={itemName} onChange={(e) => setItemName(e.target.value)} />
                </div>

                {isWorkStageView && !isPrimaryDialogOpen && (
                    <>
                        <Separator className="my-4" />
                        <h4 className="font-semibold">إعدادات سير العمل</h4>
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
                        
                        {itemStageType === 'parallel' && (
                            <div className="grid gap-2">
                                <Label>يظهر فقط أثناء المراحل التالية (اختياري)</Label>
                                <MultiSelect
                                    options={allSequentialStages.filter(s => s.value !== editingItem?.id)}
                                    selected={itemAllowedDuringStages}
                                    onChange={setItemAllowedDuringStages}
                                    placeholder="اتركه فارغًا ليظهر دائماً..."
                                    disabled={refDataLoading}
                                />
                            </div>
                        )}

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
                        </div>

                        {itemTrackingType === 'duration' && (
                            <div className="grid gap-2">
                                <Label htmlFor="item-duration">المدة المتوقعة (بالأيام)</Label>
                                <Input id="item-duration" type="number" value={itemDuration} onChange={(e) => setItemDuration(e.target.value === '' ? '' : Number(e.target.value))} />
                            </div>
                        )}
                        {itemTrackingType === 'occurrence' && (
                          <>
                            <div className="grid gap-2">
                                <Label htmlFor="item-occurrences">الحد الأقصى للتكرار</Label>
                                <Input id="item-occurrences" type="number" value={itemMaxOccurrences} onChange={(e) => setItemMaxOccurrences(e.target.value === '' ? '' : Number(e.target.value))} placeholder="مثال: 5" />
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox id="allowManualCompletion" checked={itemAllowManualCompletion} onCheckedChange={(checked) => setItemAllowManualCompletion(!!checked)} />
                              <Label htmlFor="allowManualCompletion">السماح بالإكمال اليدوي قبل الوصول للحد الأقصى</Label>
                            </div>
                          </>
                        )}
                        <div className="grid gap-2">
                            <Label>الأدوار المسؤولة (المسميات الوظيفية)</Label>
                            <MultiSelect
                                options={allJobs}
                                selected={itemRoles}
                                onChange={setItemRoles}
                                placeholder="اختر دورًا أو أكثر..."
                                disabled={refDataLoading}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>المراحل التالية المحتملة</Label>
                            <MultiSelect
                                options={allWorkStages.filter(s => s.value !== editingItem?.id)}
                                selected={itemNextStageIds}
                                onChange={setItemNextStageIds}
                                placeholder="اختر مرحلة أو أكثر للانتقال إليها..."
                                disabled={refDataLoading}
                            />
                        </div>
                    </>
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
                const deptsQuery = query(collection(firestore, 'departments'));
                const govsQuery = query(collection(firestore, 'governorates'));
                const companiesQuery = query(collection(firestore, 'companies'));
                const jobsQuery = query(collectionGroup(firestore, 'jobs'));
                const areasQuery = query(collectionGroup(firestore, 'areas'));
                const transTypesQuery = query(collectionGroup(firestore, 'transactionTypes'));
                const workStagesQuery = query(collectionGroup(firestore, 'workStages'));
                
                const [deptsSnap, govsSnap, jobsSnap, areasSnap, transTypesSnap, companiesSnap, workStagesSnap] = await Promise.all([
                    getDocs(deptsQuery),
                    getDocs(govsQuery),
                    getDocs(jobsQuery),
                    getDocs(areasQuery),
                    getDocs(transTypesQuery),
                    getDocs(companiesQuery),
                    getDocs(workStagesQuery),
                ]);

                setCounts({
                    depts: deptsSnap.size,
                    govs: govsSnap.size,
                    jobs: jobsSnap.size,
                    areas: areasSnap.size,
                    transTypes: transTypesSnap.size,
                    companies: companiesSnap.size,
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
            disablePrimaryActions={true}
            onBack={() => setView('dashboard')}
        />
    }

    if (view === 'workStages') {
        return <ManagerView
            primaryTitle="مراحل العمل حسب القسم"
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
