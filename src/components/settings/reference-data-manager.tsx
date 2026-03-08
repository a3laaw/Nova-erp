
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, orderBy, doc, addDoc, updateDoc, deleteDoc, writeBatch, getDocs, collectionGroup, where, serverTimestamp, deleteField, limit } from 'firebase/firestore';
import type { Department, Job, Governorate, Area, TransactionType, UserRole, WorkStage, CompanyActivityType, BoqReferenceItem, SubcontractorType, ConstructionWorkStage, Employee, WorkShift } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
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
import { Plus, Pencil, Trash2, Loader2, Save, PlusCircle, DownloadCloud, Users, Construction, Search, ClipboardCheck, Minus, Folder, FolderOpen, GitBranch, LayoutGrid, Building, FileText, Globe, Workflow, ArrowRight, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '../ui/badge';
import { MultiSelect, type MultiSelectOption } from '../ui/multi-select';
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
import { defaultDepartments, defaultJobs, defaultGovernorates, defaultAreas, defaultTransactionTypes, defaultWorkStages } from '@/lib/default-reference-data';
import { InlineSearchList } from '../ui/inline-search-list';

// --- Reusable Components ---

function StatCard({ title, count, icon, onNavigate, color, loading }: { title: string, count: number, icon: React.ReactNode, onNavigate: () => void, color: string, loading: boolean }) {
    const colorClasses: Record<string, string> = {
        green: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
        blue: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
        cyan: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300',
        red: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300',
        purple: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300',
        orange: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300',
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

// --- Main Manager View Logic ---
function ManagerView({
  primaryTitle,
  primarySingularTitle,
  primaryCollectionName,
  secondaryTitle,
  secondarySingularTitle,
  secondaryCollectionName,
  icon,
  onBack,
  disablePrimaryActions,
  companyActivityTypes,
  loadingCompanyActivityTypes,
  subcontractorTypes,
  subcontractorTypesLoading,
  transactionTypes,
  transactionTypesLoading,
  primaryFilter,
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
  companyActivityTypes?: CompanyActivityType[];
  loadingCompanyActivityTypes?: boolean;
  subcontractorTypes?: SubcontractorType[];
  subcontractorTypesLoading?: boolean;
  transactionTypes?: TransactionType[];
  transactionTypesLoading?: boolean;
  primaryFilter?: (item: any) => boolean;
}) {
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [primaryItems, setPrimaryItems] = useState<any[]>([]);
  const [secondaryItems, setSecondaryItems] = useState<any[]>([]);
  const [selectedPrimary, setSelectedPrimary] = useState<any | null>(null);
  
  const [loadingPrimary, setLoadingPrimary] = useState(true);
  const [loadingSecondary, setLoadingSecondary] = useState(false);

  const [isPrimaryDialogOpen, setIsPrimaryDialogOpen] = useState(false);
  const [isSecondaryDialogOpen, setIsSecondaryDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ id: string, name: string, type: 'primary' | 'secondary' } | null>(null);
  
  // Form state
  const [itemName, setItemName] = useState('');
  const [itemUnit, setItemUnit] = useState('');
  const [itemActivityTypes, setItemActivityTypes] = useState<string[]>([]);
  const [itemRoles, setItemRoles] = useState<string[]>([]);
  const [itemStageType, setItemStageType] = useState<'sequential' | 'parallel'>('sequential');
  const [itemTrackingType, setItemTrackingType] = useState<'duration' | 'occurrence' | 'none'>('duration');
  const [itemDuration, setItemDuration] = useState<number | ''>('');
  const [itemMaxOccurrences, setItemMaxOccurrences] = useState<number | ''>('');
  const [itemAllowManualCompletion, setItemAllowManualCompletion] = useState(false);
  const [itemEnableModificationTracking, setItemEnableModificationTracking] = useState(false);
  const [itemNextStageIds, setItemNextStageIds] = useState<string[]>([]);
  const [itemAllowedDuringStages, setItemAllowedDuringStages] = useState<string[]>([]);
  
  const [isHeader, setIsHeader] = useState(false);
  const [itemSubcontractorTypeIds, setItemSubcontractorTypeIds] = useState<string[]>([]);
  const [itemActivityTypeIdsForBoq, setItemActivityTypeIdsForBoq] = useState<string[]>([]);
  const [itemTransactionTypeIds, setItemTransactionTypeIds] = useState<string[]>([]);
  const [parentCategory, setParentCategory] = useState<any | null>(null);

  const [primaryOrderValues, setPrimaryOrderValues] = useState<Record<string, string>>({});
  const [isPrimaryOrderChanged, setIsPrimaryOrderChanged] = useState(false);
  const [secondaryOrderValues, setSecondaryOrderValues] = useState<Record<string, string>>({});
  const [isSecondaryOrderChanged, setIsSecondaryOrderChanged] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);

  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPortalTarget(document.body);
    }
  }, []);

  const [departmentActivityFilter, setDepartmentActivityFilter] = useState('all');

  const filteredPrimaryItems = useMemo(() => {
    let items = primaryItems;
    
    // Apply hardcoded dept filter
    if (primaryCollectionName === 'departments') {
        if (departmentActivityFilter !== 'all') {
            items = items.filter(item => (item as any).activityTypes?.includes(departmentActivityFilter));
        }
    }

    // Apply optional prop filter
    if (primaryFilter) {
        items = items.filter(primaryFilter);
    }

    return items;
  }, [primaryItems, primaryCollectionName, departmentActivityFilter, primaryFilter]);


  const isWorkStageView = secondaryCollectionName === 'workStages';
  const isBoqView = primaryCollectionName === 'boqReferenceItems';
  const isRecursiveSecondary = secondaryCollectionName === 'stages' && primaryCollectionName === 'construction_types';
  const isRecursiveView = primaryCollectionName === 'constructionWorkStages' || isBoqView;

  const [allWorkStages, setAllWorkStages] = useState<MultiSelectOption[]>([]);
  const [allSequentialStages, setAllSequentialStages] = useState<MultiSelectOption[]>([]);
  const [allJobs, setAllJobs] = useState<{ value: string; label: string }[]>([]);
  const [refDataLoading, setRefDataLoading] = useState(false);

  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set<string>());

  const fetchPrimaryItems = useCallback(async () => {
    if (!firestore) return;
    setLoadingPrimary(true);
    try {
        const snapshot = await getDocs(query(collection(firestore, primaryCollectionName)));
        let items = snapshot.docs
            .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
            .filter(item => item && typeof (item as any).name === 'string');
        
        items.sort((a: any, b: any) => {
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
            .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
            .filter(item => item && typeof (item as any).name === 'string');
        
        items.sort((a: any, b: any) => {
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


  const handleSelectPrimary = (item: any) => {
    setSelectedPrimary(item);
  };
  
  useEffect(() => {
    const primaryExists = selectedPrimary && filteredPrimaryItems.some(p => p.id === selectedPrimary.id);
    if (!primaryExists && filteredPrimaryItems.length > 0) {
      setSelectedPrimary(filteredPrimaryItems[0]);
    } else if (filteredPrimaryItems.length === 0) {
      setSelectedPrimary(null);
    }
  }, [filteredPrimaryItems, selectedPrimary]);

  useEffect(() => {
    fetchSecondaryItems();
  }, [fetchSecondaryItems]);


  const fetchReferenceDataForDialog = useCallback(async () => {
    if (!firestore) return;
    setRefDataLoading(true);
    try {
        const jobsSnapshot = await getDocs(query(collectionGroup(firestore, 'jobs')));
        const uniqueJobs = new Map<string, { value: string; label: string }>();
        jobsSnapshot.forEach(docSnap => {
            const jobName = docSnap.data().name;
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
        stagesSnapshot.forEach(docSnap => {
            const stageId = docSnap.id;
            if (!uniqueStages.has(stageId)) {
                 uniqueStages.set(stageId, {id: stageId, ...docSnap.data()} as WorkStage);
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

  useEffect(() => {
    if (isHeader) {
      setParentCategory(null);
    }
  }, [isHeader]);


  const openDialog = (type: 'primary' | 'secondary', item: any | null = null, parent: any | null = null) => {
    setEditingItem(item);
    if (type === 'primary') {
        setParentCategory(parent);
        setItemName(item?.name || '');
        if (primaryCollectionName === 'departments') {
            setItemActivityTypes((item as any)?.activityTypes || []);
        }
        if (isRecursiveView) {
            const parentToUse = parent || (item ? primaryItems.find(p => p.id === (item as any).parentId || (item as any).parentBoqReferenceItemId) : null);
            setParentCategory(parentToUse);
            
            const itemToInheritFrom = item || parentToUse;
            setItemActivityTypeIdsForBoq(itemToInheritFrom?.activityTypeIds || []);
            setItemSubcontractorTypeIds(itemToInheritFrom?.subcontractorTypeIds || []);
            setItemTransactionTypeIds(itemToInheritFrom?.transactionTypeIds || []);

            setItemUnit(item?.unit || '');
            setIsHeader(item?.isHeader || false);
        }
        setIsPrimaryDialogOpen(true);
    } else {
        setParentCategory(parent);
        setItemName(item?.name || '');
        if (isWorkStageView) {
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
        setIsSecondaryDialogOpen(true);
    }
  }

  const closeDialog = () => {
    setIsPrimaryDialogOpen(false);
    setIsSecondaryDialogOpen(false);
    setEditingItem(null);
    setItemName('');
    setItemUnit('');
    setItemActivityTypes([]);
    setItemRoles([]);
    setItemStageType('sequential');
    setItemTrackingType('duration');
    setItemDuration('');
    setItemMaxOccurrences('');
    setItemAllowManualCompletion(false);
    setItemEnableModificationTracking(false);
    setItemNextStageIds([]);
    setItemAllowedDuringStages([]);
    setIsHeader(false);
    setItemTransactionTypeIds([]);
    setItemSubcontractorTypeIds([]);
    setItemActivityTypeIdsForBoq([]);
    setParentCategory(null);
    setIsSaving(false);
  }

  const handleSave = async (type: 'primary' | 'secondary') => {
    if (!firestore || !itemName.trim()) return;
    
    const collectionPath = type === 'primary' ? primaryCollectionName : `${primaryCollectionName}/${selectedPrimary?.id}/${secondaryCollectionName}`;
    
    setIsSaving(true);
    try {
      let dataToSave: any = { name: itemName };
       if (type === 'primary' && primaryCollectionName === 'departments') {
            dataToSave.activityTypes = itemActivityTypes;
       }
       if (isRecursiveView && type === 'primary') {
           dataToSave = {
                ...dataToSave,
                isHeader: isHeader,
                unit: isHeader ? '' : itemUnit,
                transactionTypeIds: itemTransactionTypeIds,
                subcontractorTypeIds: itemSubcontractorTypeIds,
                activityTypeIds: itemActivityTypeIdsForBoq,
                parentId: parentCategory?.id || null,
                parentBoqReferenceItemId: primaryCollectionName === 'boqReferenceItems' ? (parentCategory?.id || null) : undefined,
           };
       }
       if (isRecursiveSecondary && type === 'secondary') {
           dataToSave.parentId = parentCategory?.id || null;
       }
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
          } else {
              dataToSave.expectedDurationDays = null;
              dataToSave.maxOccurrences = null;
          }
      }

      if (editingItem) {
        const itemRef = doc(firestore, collectionPath, editingItem.id);
        const { order, ...updateData } = dataToSave as any;
        await updateDoc(itemRef, updateData);
        toast({ title: 'نجاح', description: 'تم تحديث العنصر.' });
      } else {
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
    } finally {
        setIsSaving(false);
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
       
      setIsSaving(true);
      try {
        await deleteDoc(doc(firestore, collectionPath, id));
        toast({ title: 'نجاح', description: 'تم حذف العنصر.' });
        if (type === 'primary') await fetchPrimaryItems();
        else await fetchSecondaryItems();
      } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف العنصر. قد يكون مرتبطًا ببيانات أخرى.' });
      } finally {
        setIsSaving(false);
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

    setIsSaving(true);
    const batch = writeBatch(firestore);
    list.forEach(item => {
        const newOrder = orders[item.id!];
        if (newOrder !== undefined && Number(newOrder) !== (item as any).order) {
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
    } finally {
        setIsSaving(false);
    }
  };

    const handleImportDefaults = async () => {
        if(!firestore) return;
        setIsImporting(true);
        try {
            const batch = writeBatch(firestore);
            
            const primarySnap = await getDocs(query(collection(firestore, primaryCollectionName)));
            for (const docSnap of primarySnap.docs) {
                if (secondaryCollectionName) {
                    const secondarySnap = await getDocs(query(collection(firestore, `${primaryCollectionName}/${docSnap.id}/${secondaryCollectionName}`)));
                    secondarySnap.forEach(secDoc => batch.delete(secDoc.ref));
                }
                batch.delete(docSnap.ref);
            }

            switch(primaryCollectionName) {
                case 'departments':
                    for (const dept of defaultDepartments) {
                        const newDeptRef = doc(collection(firestore, 'departments'));
                        batch.set(newDeptRef, dept);
                        
                        const jobsForDept = defaultJobs[dept.name as keyof typeof defaultJobs];
                        if (jobsForDept && secondaryCollectionName === 'jobs') {
                            for (const job of jobsForDept) {
                                const newJobRef = doc(collection(firestore, `${newDeptRef.path}/jobs`));
                                batch.set(newJobRef, job);
                            }
                        }
                    }
                    break;
                case 'governorates':
                    for (const gov of defaultGovernorates) {
                        const newGovRef = doc(collection(firestore, 'governorates'));
                        batch.set(newGovRef, gov);
                        
                        const areasForGov = defaultAreas[gov.name as keyof typeof defaultAreas];
                        if (areasForGov && secondaryCollectionName === 'areas') {
                            for (const area of areasForGov) {
                                const newAreaRef = doc(collection(firestore, `${newGovRef.path}/areas`));
                                batch.set(newAreaRef, area);
                            }
                        }
                    }
                    break;
            }

            await batch.commit();
            toast({ title: 'نجاح', description: 'تم استيراد البيانات الافتراضية بنجاح.' });
            fetchPrimaryItems();
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل استيراد البيانات.' });
        } finally {
            setIsImporting(false);
            setIsImportConfirmOpen(false);
        }
    };

    const handleImportWorkStages = async () => {
        if (!firestore) return;
        setIsImporting(true);
        try {
            const typesSnapshot = await getDocs(query(collection(firestore, 'transactionTypes')));
            const allNewStagesByName = new Map<string, { id: string, ref: any }>();
            const allTypesToProcess: { typeDoc: any; stages: any[] }[] = [];

            for (const typeDoc of typesSnapshot.docs) {
                const typeName = typeDoc.data().name;
                // Note: defaultWorkStages are currently keyed by department in the mock data
                // For a true implementation, we'd map these to relevant transaction types.
                // Here we'll try to find any matching stages.
                const matchedStages = Object.values(defaultWorkStages).find((stages, idx) => {
                    const deptName = Object.keys(defaultWorkStages)[idx];
                    return typeName.includes(deptName) || deptName.includes(typeName);
                });

                if (matchedStages) {
                    allTypesToProcess.push({ typeDoc, stages: matchedStages });
                    for (const stage of matchedStages) {
                        const newStageRef = doc(collection(firestore, `transactionTypes/${typeDoc.id}/workStages`));
                        allNewStagesByName.set(stage.name, { id: newStageRef.id, ref: newStageRef });
                    }
                }
            }
            
            const batch = writeBatch(firestore);
            
            const allExistingStagesSnap = await getDocs(query(collectionGroup(firestore, 'workStages')));
            allExistingStagesSnap.forEach(docSnap => batch.delete(docSnap.ref));

            for (const { stages } of allTypesToProcess) {
                for (const stage of stages) {
                    const { nextStageNames, allowedDuringStagesNames, ...stageData } = stage as any;
                    const newStageInfo = allNewStagesByName.get(stage.name);
                    if (newStageInfo) {
                        const finalStageData = { ...stageData };
                        if (nextStageNames) {
                            finalStageData.nextStageIds = nextStageNames.map((name: string) => allNewStagesByName.get(name)?.id).filter(Boolean);
                        }
                        if (allowedDuringStagesNames) {
                            finalStageData.allowedDuringStages = allowedDuringStagesNames.map((name: string) => allNewStagesByName.get(name)?.id).filter(Boolean);
                        }
                        batch.set(newStageInfo.ref, finalStageData);
                    }
                }
            }

            await batch.commit();
            
            toast({ title: 'نجاح', description: 'تم استيراد مراحل العمل الموحدة لجميع أنواع المعاملات.' });
            fetchSecondaryItems();
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل استيراد مراحل العمل.' });
        } finally {
            setIsImporting(false);
            setIsImportConfirmOpen(false);
        }
    };

    const activityTypeMap = useMemo(() => new Map((companyActivityTypes || []).map(t => [t.id, t.name])), [companyActivityTypes]);
    const transactionTypeMap = useMemo(() => new Map((transactionTypes || []).map(t => [t.id, t.name])), [transactionTypes]);
    const subTypeMap = useMemo(() => new Map((subcontractorTypes || []).map(t => [t.id, t.name])), [subcontractorTypes]);

    const subcontractorTypeOptions: MultiSelectOption[] = useMemo(() => 
        (subcontractorTypes || []).map(t => ({ value: t.id!, label: t.name })),
        [subcontractorTypes]
    );
    
    const activityTypeOptions: MultiSelectOption[] = useMemo(() =>
        (companyActivityTypes || []).map(t => ({ value: t.id!, label: t.name })),
        [companyActivityTypes]
    );

    const filteredTransactionTypeOptionsForBoq: MultiSelectOption[] = useMemo(() => {
        if (!transactionTypes || !companyActivityTypes) return [];

        if (!itemActivityTypeIdsForBoq || itemActivityTypeIdsForBoq.length === 0) {
            return transactionTypes.map(t => ({ value: t.id!, label: t.name }));
        }

        const selectedActivityTypeNames = new Set(
            itemActivityTypeIdsForBoq
                .map(id => companyActivityTypes.find(at => at.id === id)?.name)
                .filter(Boolean) as string[]
        );

        return transactionTypes
            .filter(t => t.activityType && selectedActivityTypeNames.has(t.activityType))
            .map(t => ({ value: t.id!, label: t.name }));

    }, [transactionTypes, companyActivityTypes, itemActivityTypeIdsForBoq]);


    useEffect(() => {
        if (isRecursiveView && isPrimaryDialogOpen) {
            const validTransactionTypeIds = new Set(filteredTransactionTypeOptionsForBoq.map(opt => opt.value));
            setItemTransactionTypeIds(prev => prev.filter(id => validTransactionTypeIds.has(id)));
        }
    }, [itemActivityTypeIdsForBoq, isRecursiveView, isPrimaryDialogOpen, filteredTransactionTypeOptionsForBoq]);

    const recursiveTree = useMemo(() => {
        if (!primaryItems || !isRecursiveView) return [];
        const items = primaryItems;
        const map = new Map<string, any>();
        const roots: any[] = [];

        items.forEach(item => {
            map.set(item.id!, { ...item, children: [] });
        });

        items.forEach(item => {
            const pId = (item as any).parentId || (item as any).parentBoqReferenceItemId;
            if (pId && map.has(pId)) {
                map.get(pId)!.children.push(map.get(item.id!)!);
            } else {
                roots.push(map.get(item.id!)!);
            }
        });

        const sortRecursive = (nodes: any[]) => {
            nodes.sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name, 'ar'));
            nodes.forEach(node => {
                if (node.children && node.children.length > 0) {
                    sortRecursive(node.children);
                }
            });
        };
        sortRecursive(roots);

        return roots;
    }, [primaryItems, isRecursiveView]);

    const recursiveSecondaryTree = useMemo(() => {
        if (!secondaryItems || !isRecursiveSecondary) return [];
        const items = secondaryItems;
        const map = new Map<string, any>();
        const roots: any[] = [];

        items.forEach(item => {
            map.set(item.id!, { ...item, children: [] });
        });

        items.forEach(item => {
            const pId = item.parentId;
            if (pId && map.has(pId)) {
                map.get(pId)!.children.push(map.get(item.id!)!);
            } else {
                roots.push(map.get(item.id!)!);
            }
        });

        const sortRecursive = (nodes: any[]) => {
            nodes.sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name, 'ar'));
            nodes.forEach(node => {
                if (node.children && node.children.length > 0) {
                    sortRecursive(node.children);
                }
            });
        };
        sortRecursive(roots);

        return roots;
    }, [secondaryItems, isRecursiveSecondary]);

    const primaryOptions = useMemo(() => {
        if (!primaryItems) return [];
        return primaryItems
          .filter(cat => cat.id !== editingItem?.id) 
          .map(cat => ({ value: cat.id!, label: cat.name }));
    }, [primaryItems, editingItem]);

    const RecursiveItemRenderer = ({ node, level, onEdit, onDelete, onAddSub, type }: any) => {
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
            <div style={{ paddingRight: `${level * 1.5}rem` }} className="space-y-1">
                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 group transition-all">
                    <div className="flex items-center gap-2 flex-grow cursor-pointer" onClick={toggleOpen}>
                        {node.children && node.children.length > 0 ? (
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                                {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                            </Button>
                        ) : <div className="w-6 h-6" />}
                        <div className="flex flex-col">
                            <span className="font-bold text-sm">{node.name}</span>
                            {node.isHeader && <Badge variant="secondary" className="w-fit text-[8px] h-3 px-1 mt-0.5">قسم رئيسي</Badge>}
                        </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => onAddSub(node)}><PlusCircle className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(node)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(node, type)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                </div>
                {isOpen && node.children && node.children.map((child: any) => (
                    <RecursiveItemRenderer key={child.id} node={child} level={level + 1} onEdit={onEdit} onDelete={onDelete} onAddSub={onAddSub} type={type} />
                ))}
            </div>
        );
    };

  return (
    <Card className="rounded-3xl border-none shadow-sm overflow-hidden">
      <CardHeader className="bg-muted/10 border-b pb-6 px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary">{icon}</div>
            <div>
              <CardTitle className="text-2xl font-black">{primaryTitle}</CardTitle>
              <CardDescription>إدارة {primaryTitle} وتحديث {secondaryTitle || 'البيانات المرتبطة'}.</CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            {(primaryCollectionName === 'departments' || primaryCollectionName === 'governorates') && (
                <Button variant="outline" size="sm" onClick={() => setIsImportConfirmOpen(true)} disabled={isImporting} className="rounded-xl border-dashed">
                    {isImporting ? <Loader2 className="animate-spin ml-2 h-4 w-4"/> : <DownloadCloud className="ml-2 h-4 w-4" />}
                    استيراد الافتراضي
                </Button>
            )}
            {secondaryCollectionName === 'workStages' && (
                <Button variant="outline" size="sm" onClick={() => setIsImportConfirmOpen(true)} disabled={isImporting} className="rounded-xl border-dashed border-purple-300 text-purple-700">
                    <Workflow className="ml-2 h-4 w-4" />
                    استيراد مراحل عمل موحدة
                </Button>
            )}
            <Button onClick={onBack} variant="ghost" className="rounded-xl font-bold gap-2">
              <ArrowRight className="h-4 w-4" /> العودة للرئيسية
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-1 md:grid-cols-12 min-h-[600px]">
          {/* Primary List Sidebar */}
          <div className="md:col-span-4 border-l bg-muted/5 flex flex-col">
            <div className="p-4 border-b space-y-4">
                <div className="flex justify-between items-center">
                    <Label className="font-black text-sm">{primaryTitle}</Label>
                    {!disablePrimaryActions && <Button size="icon" variant="ghost" onClick={() => openDialog('primary')} className="h-8 w-8 text-primary"><Plus className="h-5 w-5" /></Button>}
                </div>
                
                {primaryCollectionName === 'departments' && (
                    <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-black text-muted-foreground mr-1">فلترة حسب النشاط</Label>
                        <Select value={departmentActivityFilter} onValueChange={setDepartmentActivityFilter}>
                            <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                            <SelectContent dir="rtl">
                                <SelectItem value="all">الكل</SelectItem>
                                {companyActivityTypes?.map(t => <SelectItem key={t.id} value={t.id!}>{t.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>
            
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {loadingPrimary ? (
                  Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl mb-2" />)
                ) : filteredPrimaryItems.length === 0 ? (
                  <p className="text-center text-muted-foreground p-8 text-sm italic">لا توجد سجلات حالياً.</p>
                ) : isRecursiveView ? (
                    recursiveTree.map(node => (
                        <RecursiveItemRenderer 
                            key={node.id} 
                            node={node} 
                            level={0} 
                            onEdit={(item: any) => openDialog('primary', item)} 
                            onDelete={openDeleteDialog} 
                            onAddSub={(p: any) => openDialog('primary', null, p)}
                            type="primary"
                        />
                    ))
                ) : (
                  filteredPrimaryItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleSelectPrimary(item)}
                      className={cn(
                        "group flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all",
                        selectedPrimary?.id === item.id ? "bg-primary text-white shadow-lg" : "hover:bg-muted"
                      )}
                    >
                      <div className="flex flex-col flex-1 overflow-hidden">
                        <span className="font-bold text-sm truncate">{item.name}</span>
                        {item.activityTypes && (
                            <div className="flex gap-1 mt-1">
                                {item.activityTypes.map((t: string) => <Badge key={t} variant="outline" className={cn("text-[8px] h-3 px-1 border-none", selectedPrimary?.id === item.id ? "bg-white/20 text-white" : "bg-primary/10 text-primary")}>{activityTypeMap.get(t) || t}</Badge>)}
                            </div>
                        )}
                      </div>
                      {!disablePrimaryActions && (
                        <div className={cn("flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity", selectedPrimary?.id === item.id && "opacity-100")}>
                          <Button variant="ghost" size="icon" className={cn("h-7 w-7", selectedPrimary?.id === item.id ? "text-white hover:bg-white/20" : "text-muted-foreground")} onClick={(e) => { e.stopPropagation(); openDialog('primary', item); }}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className={cn("h-7 w-7", selectedPrimary?.id === item.id ? "text-white hover:bg-white/20" : "text-destructive")} onClick={(e) => { e.stopPropagation(); openDeleteDialog(item, 'primary'); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
            
            {!loadingPrimary && !isRecursiveView && filteredPrimaryItems.length > 0 && (
                <div className="p-4 border-t bg-muted/10">
                    <div className="flex items-center justify-between gap-4">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">تعديل الترتيب</Label>
                        <div className="flex gap-2">
                            {isPrimaryOrderChanged && <Button size="sm" onClick={() => handleSaveOrder('primary')} disabled={isSaving} className="h-7 text-[10px] px-3 font-black">حفظ الترتيب</Button>}
                            <Button variant="ghost" size="sm" onClick={() => setIsPrimaryOrderChanged(!isPrimaryOrderChanged)} className="h-7 text-[10px] px-3">
                                {isPrimaryOrderChanged ? 'إلغاء' : 'ترتيب'}
                            </Button>
                        </div>
                    </div>
                    {isPrimaryOrderChanged && (
                        <div className="mt-3 space-y-2">
                            {filteredPrimaryItems.map((item) => (
                                <div key={item.id} className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] font-bold truncate max-w-[120px]">{item.name}</span>
                                    <Input 
                                        type="number" 
                                        className="h-6 w-14 text-[10px] font-mono text-center" 
                                        value={primaryOrderValues[item.id!] ?? item.order ?? 0}
                                        onChange={(e) => handleOrderChange('primary', item.id!, e.target.value)}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
          </div>

          {/* Secondary List Content Area */}
          <div className="md:col-span-8 flex flex-col bg-card">
            {selectedPrimary ? (
              <>
                <div className="p-6 border-b flex justify-between items-center bg-muted/5">
                  <div>
                    <h3 className="text-xl font-black text-foreground">{secondaryTitle}</h3>
                    <p className="text-xs text-muted-foreground font-medium">التابعة لـ {primarySingularTitle}: <span className="text-primary font-bold">{selectedPrimary.name}</span></p>
                  </div>
                  {secondaryCollectionName && (
                    <Button onClick={() => openDialog('secondary')} className="rounded-xl font-bold gap-2">
                      <PlusCircle className="h-4 w-4" /> إضافة {secondarySingularTitle} جديد
                    </Button>
                  )}
                </div>
                
                <ScrollArea className="flex-1">
                  <div className="p-6">
                    {loadingSecondary ? (
                      <div className="space-y-4">
                        <Skeleton className="h-16 w-full rounded-2xl" />
                        <Skeleton className="h-16 w-full rounded-2xl" />
                      </div>
                    ) : secondaryItems.length === 0 ? (
                      <div className="text-center py-20 opacity-30 grayscale flex flex-col items-center">
                        <LayoutGrid className="h-16 w-16 mb-4" />
                        <p className="font-bold">لا يوجد {secondaryTitle} حالياً لهذه الفئة.</p>
                      </div>
                    ) : isRecursiveSecondary ? (
                        <div className="space-y-2">
                            {recursiveSecondaryTree.map(node => (
                                <RecursiveItemRenderer 
                                    key={node.id} 
                                    node={node} 
                                    level={0} 
                                    onEdit={(item: any) => openDialog('secondary', item)} 
                                    onDelete={openDeleteDialog} 
                                    onAddSub={(p: any) => openDialog('secondary', null, p)}
                                    type="secondary"
                                />
                            ))}
                        </div>
                    ) : (
                      <div className="grid gap-3">
                        {secondaryItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-4 border-2 border-transparent bg-muted/20 rounded-2xl hover:bg-white hover:border-primary/10 hover:shadow-md transition-all group"
                          >
                            <div className="flex flex-col">
                                <span className="font-black text-foreground/80">{item.name}</span>
                                {isWorkStageView && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                        <Badge variant="outline" className={cn("text-[8px] h-4", item.stageType === 'parallel' ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700")}>
                                            {item.stageType === 'parallel' ? 'مسار متوازي' : 'مسار تسلسلي'}
                                        </Badge>
                                        {(item.allowedRoles || []).map((role: string) => <Badge key={role} variant="secondary" className="text-[8px] h-4">{role}</Badge>)}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                               {isWorkStageView && isSecondaryOrderChanged && (
                                    <Input 
                                        type="number" 
                                        className="h-8 w-14 font-mono text-center text-xs" 
                                        value={secondaryOrderValues[item.id!] ?? item.order ?? 0}
                                        onChange={(e) => handleOrderChange('secondary', item.id!, e.target.value)}
                                    />
                               )}
                              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => openDialog('secondary', item)}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-destructive hover:bg-red-50" onClick={() => openDeleteDialog(item, 'secondary')}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
                
                {/* Secondary Sort Controls */}
                {!loadingSecondary && secondaryItems.length > 0 && (
                    <div className="p-6 border-t bg-muted/10 flex justify-between items-center">
                        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                            {isSecondaryOrderChanged && <Loader2 className={cn("h-3 w-3", isSaving ? "animate-spin" : "hidden")} />}
                            {isSecondaryOrderChanged ? 'تعديل الترتيب نشط' : 'ترتيب العناصر'}
                        </div>
                        <div className="flex gap-2">
                            {isSecondaryOrderChanged && <Button size="sm" onClick={() => handleSaveOrder('secondary')} disabled={isSaving} className="h-8 rounded-lg font-black">حفظ الترتيب</Button>}
                            <Button variant="outline" size="sm" onClick={() => setIsSecondaryOrderChanged(!isSecondaryOrderChanged)} className="h-8 rounded-lg font-bold">
                                {isSecondaryOrderChanged ? 'إلغاء' : 'تعديل الترتيب'}
                            </Button>
                        </div>
                    </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-40 grayscale">
                <ArrowRight className="h-16 w-16 mb-4 text-primary animate-pulse" />
                <h3 className="text-xl font-black">اختر {primarySingularTitle}</h3>
                <p className="text-sm font-medium mt-2">يرجى اختيار {primarySingularTitle} من القائمة الجانبية لعرض {secondaryTitle}.</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>

      {/* --- Primary Item Dialog (Recursive or Regular) --- */}
      <Dialog open={isPrimaryDialogOpen} onOpenChange={closeDialog}>
        <DialogContent 
            dir="rtl" 
            className="max-w-xl rounded-[2rem] shadow-2xl"
            onInteractOutside={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest('[cmdk-root]') || target.closest('[data-radix-popper-content-wrapper]') || target.closest('[data-inline-search-list-options]')) {
                    e.preventDefault();
                }
            }}
        >
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">{editingItem ? `تعديل ${primarySingularTitle}` : `إضافة ${primarySingularTitle} جديد`}</DialogTitle>
            <DialogDescription>أدخل بيانات {primarySingularTitle} واحفظ التغييرات.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-6">
            <div className="grid gap-2">
              <Label htmlFor="primary-name" className="font-bold">اسم {primarySingularTitle} *</Label>
              <Input id="primary-name" value={itemName} onChange={(e) => setItemName(e.target.value)} required placeholder={`ادخل اسم الـ ${primarySingularTitle}...`} className="h-12 rounded-2xl border-2 text-lg font-bold" />
            </div>
            
            {primaryCollectionName === 'departments' && (
                <div className="grid gap-2 animate-in fade-in">
                    <Label className="font-bold text-xs text-muted-foreground uppercase">الأنشطة المرتبطة بهذا القسم</Label>
                    <MultiSelect 
                        options={activityTypeOptions} 
                        selected={itemActivityTypes} 
                        onChange={setItemActivityTypes} 
                        placeholder="اختر الأنشطة..." 
                        className="rounded-xl"
                    />
                </div>
            )}

            {isRecursiveView && (
                <div className="space-y-6 animate-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center justify-between p-4 bg-primary/5 rounded-2xl border-2 border-primary/10">
                        <div className="space-y-0.5">
                            <Label className="font-black text-primary">هل هذا العنصر "قسم رئيسي"؟</Label>
                            <p className="text-[10px] text-muted-foreground font-medium">الأقسام الرئيسية تعمل كمجلدات تنظيمية للبنود بداخلها.</p>
                        </div>
                        <Switch checked={isHeader} onCheckedChange={setIsHeader} />
                    </div>

                    {!isHeader && (
                        <div className="grid gap-2 animate-in zoom-in-95">
                            <Label className="font-bold">وحدة القياس</Label>
                            <Input value={itemUnit} onChange={e => setItemUnit(e.target.value)} placeholder="مثال: متر، قطعة، مقطوعية..." className="h-11 rounded-xl" />
                        </div>
                    )}

                    <div className="grid gap-2">
                        <Label className="font-bold">العنصر الأب (المجلد)</Label>
                        <InlineSearchList 
                            value={parentCategory?.id || ''} 
                            onSelect={(v) => setParentCategory(primaryItems.find(p => p.id === v))} 
                            options={primaryOptions} 
                            placeholder="اتركه فارغاً ليكون قسماً رئيسياً (جذر)" 
                            className="h-11 rounded-xl border-dashed"
                        />
                    </div>

                    <Separator />

                    <div className="space-y-4">
                        <Label className="font-black text-xs text-muted-foreground flex items-center gap-2"><GitBranch className="h-3 w-3"/> ربط العلاقات الإجرائية</Label>
                        <div className="grid gap-4 p-4 border-2 border-dashed rounded-3xl bg-muted/5">
                            <div className="grid gap-1.5">
                                <Label className="text-[10px] font-bold">يرتبط بأنشطة الشركة</Label>
                                <MultiSelect options={activityTypeOptions} selected={itemActivityTypeIdsForBoq} onChange={setItemActivityTypeIdsForBoq} placeholder="اختر الأنشطة..." />
                            </div>
                            <div className="grid gap-1.5">
                                <Label className="text-[10px] font-bold">يرتبط بأنواع المعاملات (المكتب)</Label>
                                <MultiSelect options={filteredTransactionTypeOptionsForBoq} selected={itemTransactionTypeIds} onChange={setItemTransactionTypeIds} placeholder="اختر المعاملات..." disabled={itemActivityTypeIdsForBoq.length === 0} />
                            </div>
                            <div className="grid gap-1.5">
                                <Label className="text-[10px] font-bold">يرتبط بتخصصات المقاولين (الباطن)</Label>
                                <MultiSelect options={subcontractorTypeOptions} selected={itemSubcontractorTypeIds} onChange={setItemSubcontractorTypeIds} placeholder="اختر تخصص المقاول..." />
                            </div>
                        </div>
                    </div>
                </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={closeDialog} disabled={isSaving} className="rounded-xl h-11 px-6">إلغاء</Button>
            <Button onClick={() => handleSave('primary')} disabled={isSaving || !itemName.trim()} className="rounded-xl h-11 px-10 font-black gap-2 shadow-lg shadow-primary/20">
              {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
              حفظ وتطبيق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Secondary Item Dialog (Work Stages or Regular) --- */}
      <Dialog open={isSecondaryDialogOpen} onOpenChange={closeDialog}>
        <DialogContent dir="rtl" className="max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden p-0 h-auto max-h-[90vh] flex flex-col border-none">
          <DialogHeader className="p-8 pb-6 border-b bg-muted/30">
            <DialogTitle className="text-2xl font-black text-foreground">
                {editingItem ? `تعديل ${secondarySingularTitle}` : `إضافة ${secondarySingularTitle} جديد`}
            </DialogTitle>
            <DialogDescription className="text-sm font-medium mt-1">تخصيص القواعد الإجرائية والرقابية لهذه المرحلة.</DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1">
            <div className="p-8 space-y-8">
                <div className="grid gap-3">
                    <Label htmlFor="secondary-name" className="font-black text-foreground/70 mr-1">اسم {secondarySingularTitle} *</Label>
                    <Input id="secondary-name" value={itemName} onChange={(e) => setItemName(e.target.value)} required className="h-12 text-lg font-bold rounded-2xl border-2 shadow-inner" placeholder={`اسم الـ ${secondarySingularTitle}...`} />
                </div>

                {isRecursiveSecondary && (
                    <div className="grid gap-2 animate-in zoom-in-95">
                        <Label className="font-bold">المرحلة الأب (المجلد)</Label>
                        <InlineSearchList 
                            value={parentCategory?.id || ''} 
                            onSelect={(v) => setParentCategory(secondaryItems.find(p => p.id === v))} 
                            options={secondaryItems.filter(i => i.id !== editingItem?.id).map(i => ({ value: i.id!, label: i.name }))} 
                            placeholder="اتركه فارغاً ليكون قسماً رئيسياً" 
                            className="h-11 rounded-xl border-dashed"
                        />
                    </div>
                )}

                {isWorkStageView && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <Label className="font-black text-xs uppercase tracking-widest text-primary flex items-center gap-2"><Workflow className="h-3 w-3"/> طبيعة المسار</Label>
                                <RadioGroup value={itemStageType} onValueChange={(v: any) => setItemStageType(v)} className="grid grid-cols-2 gap-4">
                                    <div className={cn("flex items-center gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer", itemStageType === 'sequential' ? "bg-blue-50 border-blue-500 shadow-md" : "bg-muted/20 border-transparent hover:border-muted-foreground/20")}>
                                        <RadioGroupItem value="sequential" id="sequential" />
                                        <Label htmlFor="sequential" className="cursor-pointer font-black text-xs">تسلسلي (Step)</Label>
                                    </div>
                                    <div className={cn("flex items-center gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer", itemStageType === 'parallel' ? "bg-purple-50 border-purple-500 shadow-md" : "bg-muted/20 border-transparent hover:border-muted-foreground/20")}>
                                        <RadioGroupItem value="parallel" id="parallel" />
                                        <Label htmlFor="parallel" className="cursor-pointer font-black text-xs">متوازي (Activity)</Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            <div className="space-y-3">
                                <Label className="font-black text-xs uppercase tracking-widest text-primary flex items-center gap-2"><Clock className="h-3 w-3"/> معيار الرقابة الزمنية</Label>
                                <Select value={itemTrackingType} onValueChange={(v: any) => setItemTrackingType(v)}>
                                    <SelectTrigger className="h-12 rounded-2xl border-2 bg-muted/5 font-bold"><SelectValue /></SelectTrigger>
                                    <SelectContent dir="rtl">
                                        <SelectItem value="duration">مدة الإنجاز (أيام)</SelectItem>
                                        <SelectItem value="occurrence">تكرار الأحداث (مرات)</SelectItem>
                                        <SelectItem value="none">بدون تتبع زمني</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end p-6 bg-primary/5 rounded-[2rem] border-2 border-dashed border-primary/10 shadow-inner">
                            {itemTrackingType === 'duration' && (
                                <div className="grid gap-3 animate-in zoom-in-95">
                                    <Label className="font-black text-xs text-primary">المدة المتوقعة للإنجاز (بالأيام)</Label>
                                    <div className="flex items-center gap-3">
                                        <Input type="number" value={itemDuration} onChange={e => setItemDuration(e.target.value ? Number(e.target.value) : '')} className="h-12 rounded-xl text-center text-xl font-black font-mono border-primary/20 shadow-md" placeholder="0" />
                                        <span className="font-black text-primary text-sm">يوم عمل</span>
                                    </div>
                                </div>
                            )}
                            {itemTrackingType === 'occurrence' && (
                                <div className="grid gap-3 animate-in zoom-in-95">
                                    <Label className="font-black text-xs text-primary">الحد الأقصى للتكرار (مثال: التعديلات)</Label>
                                    <div className="flex items-center gap-3">
                                        <Input type="number" value={itemMaxOccurrences} onChange={e => setItemMaxOccurrences(e.target.value ? Number(e.target.value) : '')} className="h-12 rounded-xl text-center text-xl font-black font-mono border-primary/20 shadow-md" placeholder="0" />
                                        <span className="font-black text-primary text-sm">مرات سماح</span>
                                    </div>
                                </div>
                            )}
                            
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-3 bg-white rounded-2xl border shadow-sm">
                                    <div className="space-y-0.5">
                                        <Label htmlFor="manual-completion" className="text-xs font-black">إغلاق يدوي</Label>
                                        <p className="text-[9px] text-muted-foreground font-bold">السماح للمهندس بإغلاق المرحلة يدوياً.</p>
                                    </div>
                                    <Switch id="manual-completion" checked={itemAllowManualCompletion} onCheckedChange={setItemAllowManualCompletion} />
                                </div>
                                <div className="flex items-center justify-between p-3 bg-white rounded-2xl border shadow-sm">
                                    <div className="space-y-0.5">
                                        <Label htmlFor="mod-tracking" className="text-xs font-black">تتبع التعديلات</Label>
                                        <p className="text-[9px] text-muted-foreground font-bold">تفعيل زر "تسجيل تعديل" داخل هذه المرحلة.</p>
                                    </div>
                                    <Switch id="mod-tracking" checked={itemEnableModificationTracking} onCheckedChange={setItemEnableModificationTracking} />
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-4">
                            <Label className="font-black text-xs uppercase tracking-widest text-primary flex items-center gap-2"><ShieldCheck className="h-3 w-3"/> صلاحيات البدء (Allowed Roles)</Label>
                            <MultiSelect 
                                options={allJobs} 
                                selected={itemRoles} 
                                onChange={setItemRoles} 
                                placeholder="من يحق له العمل على هذه المرحلة؟" 
                                className="rounded-2xl"
                            />
                        </div>

                        <div className="grid gap-6 border-t pt-8">
                            <div className="grid gap-3">
                                <Label className="font-black text-xs text-muted-foreground flex items-center gap-2"><ArrowRight className="h-3 w-3 rotate-180"/> المراحل التالية الممكنة</Label>
                                <MultiSelect options={allSequentialStages} selected={itemNextStageIds} onChange={setItemNextStageIds} placeholder="اختر المراحل التي تلي هذه المرحلة..." className="rounded-xl"/>
                            </div>
                            <div className="grid gap-3">
                                <Label className="font-black text-xs text-muted-foreground flex items-center gap-2"><GitBranch className="h-3 w-3"/> السماح بالتنفيذ أثناء المراحل التالية</Label>
                                <MultiSelect options={allSequentialStages} selected={itemAllowedDuringStages} onChange={setItemAllowedDuringStages} placeholder="اختر المراحل التي يمكن أن تعمل هذه المرحلة بالتوازي معها..." className="rounded-xl"/>
                            </div>
                        </div>
                    </div>
                )}
            </div>
          </ScrollArea>

          <DialogFooter className="p-8 pt-4 border-t bg-muted/30">
            <Button type="button" variant="ghost" onClick={closeDialog} disabled={isSaving} className="h-12 px-8 rounded-2xl font-bold">إلغاء</Button>
            <Button onClick={() => handleSave('secondary')} disabled={isSaving || !itemName.trim()} className="h-12 px-16 rounded-2xl font-black text-xl shadow-2xl shadow-primary/30 min-w-[200px] gap-3">
              {isSaving ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
              حفظ المرحلة والقواعد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Global Delete Dialog --- */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent dir="rtl" className="rounded-3xl shadow-2xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-red-100 rounded-2xl text-red-600 shadow-inner">
                    <ShieldAlert className="h-6 w-6" />
                </div>
                <AlertDialogTitle className="text-2xl font-black text-red-700">تأكيد الحذف النهائي؟</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base font-medium leading-relaxed">
              أنت على وشك حذف <strong>&quot;{itemToDelete?.name}&quot;</strong> من {itemToDelete?.type === 'primary' ? primaryTitle : secondaryTitle}. 
              <br/><br/>
              <span className="font-black text-red-600">تحذير رقابي:</span> سيؤدي هذا الإجراء إلى حذف كافة التبعيات والروابط الإجرائية المرتبطة. هذا الإجراء غير قابل للتراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-2">
            <AlertDialogCancel className="rounded-xl font-bold" disabled={isSaving}>تراجع</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isSaving} className="bg-destructive hover:bg-destructive/90 rounded-xl font-black px-10">
              {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : 'نعم، حذف نهائي'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* --- Import Default Confirmation --- */}
      <AlertDialog open={isImportConfirmOpen} onOpenChange={setIsImportConfirmOpen}>
        <AlertDialogContent dir="rtl" className="rounded-3xl">
            <AlertDialogHeader>
                <AlertDialogTitle className="text-2xl font-black text-primary">تأكيد استيراد البيانات الافتراضية؟</AlertDialogTitle>
                <AlertDialogDescription className="text-base font-medium leading-relaxed">
                    سيقوم هذا الإجراء بـ <strong>مسح كافة البيانات الحالية</strong> لـ {primaryTitle} وتنزيل القائمة المرجعية الموحدة.
                    <br/><br/>
                    <span className="font-black text-orange-600 flex items-center gap-2"><AlertCircle className="h-4 w-4"/> هل أنت متأكد من المتابعة؟</span>
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-6 gap-2">
                <AlertDialogCancel className="rounded-xl font-bold">إلغاء</AlertDialogCancel>
                <AlertDialogAction onClick={secondaryCollectionName === 'workStages' ? handleImportWorkStages : handleImportDefaults} disabled={isImporting} className="bg-primary hover:bg-primary/90 rounded-xl font-black px-10 shadow-lg shadow-primary/20">
                    {isImporting ? <Loader2 className="animate-spin h-4 w-4"/> : 'نعم، استيراد وتحديث'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// --- Unified (Full) ReferenceDataManager ---
export function ReferenceDataManager() {
    const [view, setView] = useState<'dashboard' | 'depts' | 'locations' | 'transactionTypes' | 'workStages' | 'subcontractorTypes' | 'companyActivityTypes' | 'boqReferenceItems' | 'constructionWorkflow'>('dashboard');

    const [counts, setCounts] = useState({ depts: 0, jobs: 0, govs: 0, areas: 0, transactionTypes: 0, workStages: 0, subcontractorTypes: 0, subcontractorSpecializations: 0, companyActivityTypes: 0, boqReferenceItems: 0, constructionTypes: 0 });
    const [loadingCounts, setLoadingCounts] = useState(true);
    const { firestore } = useFirebase();
    const { toast } = useToast();
    
    const { data: companyActivityTypes, loading: activityTypesLoading } = useSubscription<CompanyActivityType>(firestore, 'companyActivityTypes');
    const { data: subcontractorTypes, loading: subcontractorTypesLoading } = useSubscription<SubcontractorType>(firestore, 'subcontractorTypes');
    const { data: transactionTypes, loading: transactionTypesLoading } = useSubscription<TransactionType>(firestore, 'transactionTypes');


    useEffect(() => {
        if (!firestore) return;

        const fetchCounts = async () => {
            setLoadingCounts(true);
            try {
                const [deptsSnap, govsSnap, jobsSnap, areasSnap, transTypesSnap, workStagesSnap, subTypesSnap, subSpecsSnap, companyActivityTypesSnap, boqRefItemsSnap, constrTypesSnap] = await Promise.all([
                    getDocs(query(collection(firestore, 'departments'))),
                    getDocs(query(collection(firestore, 'governorates'))),
                    getDocs(query(collectionGroup(firestore, 'jobs'))),
                    getDocs(query(collectionGroup(firestore, 'areas'))),
                    getDocs(query(collection(firestore, 'transactionTypes'))),
                    getDocs(query(collectionGroup(firestore, 'workStages'))),
                    getDocs(query(collection(firestore, 'subcontractorTypes'))),
                    getDocs(query(collectionGroup(firestore, 'specializations'))),
                    getDocs(query(collection(firestore, 'companyActivityTypes'))),
                    getDocs(query(collection(firestore, 'boqReferenceItems'))),
                    getDocs(query(collection(firestore, 'construction_types'))),
                ]);

                setCounts({
                    depts: deptsSnap.size,
                    govs: govsSnap.size,
                    jobs: jobsSnap.size,
                    areas: areasSnap.size,
                    transactionTypes: transTypesSnap.size,
                    workStages: workStagesSnap.size,
                    subcontractorTypes: subTypesSnap.size,
                    subcontractorSpecializations: subSpecsSnap.size,
                    companyActivityTypes: companyActivityTypesSnap.size,
                    boqReferenceItems: boqRefItemsSnap.size,
                    constructionTypes: constrTypesSnap.size,
                });

            } catch (error) {
                console.error("Failed to fetch counts:", error);
            } finally {
                setLoadingCounts(false);
            }
        };

        fetchCounts();
    }, [firestore]);
    

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
            companyActivityTypes={companyActivityTypes || []}
            loadingCompanyActivityTypes={activityTypesLoading}
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
    
    if (view === 'transactionTypes') {
         return <UnifiedTransactionTypeManager 
            onBack={() => setView('dashboard')} 
            companyActivityTypes={companyActivityTypes || []}
            loadingCompanyActivityTypes={activityTypesLoading}
        />
    }

    if (view === 'workStages') {
        return <ManagerView
            primaryTitle="أنواع المعاملات"
            primarySingularTitle="نوع معاملة"
            primaryCollectionName="transactionTypes"
            secondaryTitle="مراحل سير العمل"
            secondarySingularTitle="مرحلة"
            secondaryCollectionName="workStages"
            icon={<Workflow className="h-full w-full" />}
            disablePrimaryActions={true}
            onBack={() => setView('dashboard')}
            primaryFilter={(item) => {
                const act = item.activityType || '';
                return act.includes('استشارات') || act.includes('إستشارات') || act === 'consulting';
            }}
        />
    }
    
    if (view === 'subcontractorTypes') {
        return <ManagerView
            primaryTitle="أنواع المقاولين"
            primarySingularTitle="نوع المقاول"
            primaryCollectionName="subcontractorTypes"
            secondaryTitle="التخصصات الدقيقة"
            secondarySingularTitle="تخصص دقيق"
            secondaryCollectionName="specializations"
            icon={<Users className="h-full w-full" />}
            onBack={() => setView('dashboard')}
        />
    }
    
    if (view === 'companyActivityTypes') {
        return <ManagerView
            primaryTitle="أنواع أنشطة الشركات"
            primarySingularTitle="نوع نشاط"
            primaryCollectionName="companyActivityTypes"
            icon={<Building className="h-full w-full" />}
            onBack={() => setView('dashboard')}
        />
    }

    if (view === 'boqReferenceItems') {
        return <ManagerView
            primaryTitle="بنود جداول الكميات"
            primarySingularTitle="بند مرجعي"
            primaryCollectionName="boqReferenceItems"
            icon={<ClipboardCheck className="h-full w-full" />}
            onBack={() => setView('dashboard')}
            companyActivityTypes={companyActivityTypes || []}
            loadingCompanyActivityTypes={activityTypesLoading}
            subcontractorTypes={subcontractorTypes || []}
            subcontractorTypesLoading={subcontractorTypesLoading || false}
            transactionTypes={transactionTypes || []}
            transactionTypesLoading={transactionTypesLoading}
        />
    }

    if (view === 'constructionWorkflow') {
        return <ManagerView
            primaryTitle="أنواع المقاولات"
            primarySingularTitle="نوع مقاولات"
            primaryCollectionName="construction_types"
            secondaryTitle="المراحل الشجرية"
            secondarySingularTitle="مرحلة عمل"
            secondaryCollectionName="stages"
            icon={<LayoutGrid className="h-full w-full" />}
            onBack={() => setView('dashboard')}
        />
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
                    title="الأقسام والوظائف" 
                    count={counts.depts + counts.jobs} 
                    icon={<Building className="h-full w-full" />} 
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
                    count={counts.transactionTypes} 
                    icon={<FileText className="h-full w-full" />} 
                    onNavigate={() => setView('transactionTypes')} 
                    color="red" 
                    loading={loadingCounts} 
                />
                 <StatCard 
                    title="سير العمل مكتب هندسي" 
                    count={counts.workStages} 
                    icon={<Workflow className="h-full w-full" />} 
                    onNavigate={() => setView('workStages')} 
                    color="purple" 
                    loading={loadingCounts} 
                />
                <StatCard 
                    title="تخصصات المقاولين" 
                    count={counts.subcontractorTypes + counts.subcontractorSpecializations} 
                    icon={<Users className="h-full w-full" />} 
                    onNavigate={() => setView('subcontractorTypes')} 
                    color="purple" 
                    loading={loadingCounts} 
                />
                 <StatCard 
                    title="أنواع أنشطة الشركات" 
                    count={counts.companyActivityTypes} 
                    icon={<Building className="h-full w-full" />} 
                    onNavigate={() => setView('companyActivityTypes')} 
                    color="orange" 
                    loading={loadingCounts} 
                />
                 <StatCard 
                    title="بنود المقايسات (BOQ)" 
                    count={counts.boqReferenceItems} 
                    icon={<ClipboardCheck className="h-full w-full" />} 
                    onNavigate={() => setView('boqReferenceItems')} 
                    color="green" 
                    loading={loadingCounts} 
                />
                <StatCard 
                    title="سير عمل المقاولات" 
                    count={counts.constructionTypes} 
                    icon={<LayoutGrid className="h-full w-full" />} 
                    onNavigate={() => setView('constructionWorkflow')} 
                    color="blue" 
                    loading={loadingCounts} 
                />
            </CardContent>
        </Card>
    );
}

function UnifiedTransactionTypeManager({ onBack, companyActivityTypes, loadingCompanyActivityTypes }: { onBack: () => void, companyActivityTypes: CompanyActivityType[], loadingCompanyActivityTypes: boolean }) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    
    const { data: transactionTypes, loading } = useSubscription<TransactionType>(firestore, 'transactionTypes');
    const { data: departments, loading: deptsLoading } = useSubscription<Department>(firestore, 'departments');

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<TransactionType | null>(null);
    const [itemToDelete, setItemToDelete] = useState<TransactionType | null>(null);
    
    const [itemName, setItemName] = useState('');
    const [itemActivityType, setItemActivityType] = useState('');
    const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
    
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    
    const departmentsMap = useMemo(() => new Map(departments.map(d => [d.id, d.name])), [departments]);
    const departmentOptions = useMemo(() => departments.map(d => ({ value: d.id!, label: d.name })), [departments]);

    const filteredTransactionTypes = useMemo(() => {
        if (!searchQuery) return transactionTypes;
        return transactionTypes.filter(type => 
            type.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            type.activityType?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [transactionTypes, searchQuery]);

    const openDialog = (item: TransactionType | null = null) => {
        setEditingItem(item);
        setItemName(item?.name || '');
        setItemActivityType(item?.activityType || '');
        setSelectedDepartments(item?.departmentIds || []);
        setIsDialogOpen(true);
    };

    const handleSave = async () => {
        if (!firestore || !itemName.trim()) return;
        setIsSaving(true);
        try {
            const dataToSave = { name: itemName, departmentIds: selectedDepartments, activityType: itemActivityType };
            if (editingItem) {
                await updateDoc(doc(firestore, 'transactionTypes', editingItem.id!), dataToSave);
                toast({ title: 'نجاح', description: 'تم تحديث نوع المعاملة.' });
            } else {
                const newOrder = transactionTypes.length;
                await addDoc(collection(firestore, 'transactionTypes'), { ...dataToSave, order: newOrder });
                toast({ title: 'نجاح', description: 'تمت إضافة نوع المعاملة.' });
            }
            setIsDialogOpen(false);
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ نوع المعاملة.' });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDelete = async () => {
        if (!firestore || !itemToDelete) return;
        try {
            await deleteDoc(doc(firestore, 'transactionTypes', itemToDelete.id!));
            toast({ title: 'نجاح', description: 'تم حذف نوع المعاملة.' });
            setItemToDelete(null);
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف نوع المعاملة.' });
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
                     <Input
                        placeholder="ابحث بالاسم أو نوع النشاط..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="max-sm"
                    />
                    <Button size="sm" onClick={() => openDialog()}><PlusCircle className="ml-2 h-4 w-4" /> إضافة نوع جديد</Button>
                </div>
                 <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>اسم نوع المعاملة</TableHead>
                                <TableHead>نوع النشاط</TableHead>
                                <TableHead>الأقسام المرتبطة</TableHead>
                                <TableHead><span className="sr-only">الإجراءات</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading && <TableRow><TableCell colSpan={4}><Skeleton className="h-20"/></TableCell></TableRow>}
                            {!loading && filteredTransactionTypes.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-semibold">{item.name}</TableCell>
                                    <TableCell><Badge variant="secondary">{item.activityType}</Badge></TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {item.departmentIds?.map(id => <Badge key={id} variant="outline">{departmentsMap.get(id) || '...'}</Badge>)}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="icon" onClick={() => openDialog(item)}><Pencil className="h-4 w-4" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent dir="rtl">
                    <DialogHeader>
                        <DialogTitle>{editingItem ? 'تعديل' : 'إضافة'} نوع معاملة</DialogTitle>
                        <DialogDescription>
                            {editingItem ? 'تعديل بيانات نوع المعاملة' : 'إضافة نوع معاملة جديد'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2"><Label>اسم نوع المعاملة</Label><Input value={itemName} onChange={(e) => setItemName(e.target.value)} disabled={isSaving} /></div>
                        <div className="grid gap-2">
                            <Label>نوع النشاط</Label>
                            <Select value={itemActivityType} onValueChange={(v) => setItemActivityType(v as any)} disabled={loadingCompanyActivityTypes || isSaving}>
                                <SelectTrigger>
                                    <SelectValue placeholder={loadingCompanyActivityTypes ? "تحميل..." : "اختر نوع النشاط..."} />
                                </SelectTrigger>
                                <SelectContent>
                                    {(companyActivityTypes || []).map(type => (
                                        <SelectItem key={type.id} value={type.name}>{type.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>الأقسام المرتبطة</Label>
                            <MultiSelect
                                options={departmentOptions}
                                selected={selectedDepartments}
                                onChange={setSelectedDepartments}
                                placeholder="اختر قسمًا أو أكثر..."
                                disabled={deptsLoading || isSaving}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>إلغاء</Button>
                        <Button onClick={handleSave} disabled={isSaving}>{isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin"/>} حفظ</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    )
}
