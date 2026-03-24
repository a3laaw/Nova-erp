'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, orderBy, doc, addDoc, updateDoc, deleteDoc, writeBatch, getDocs, collectionGroup, where, serverTimestamp, deleteField, limit } from 'firebase/firestore';
import type { Department, Job, Governorate, Area, TransactionType, UserRole, WorkStage, CompanyActivityType, BoqReferenceItem, SubcontractorType, ConstructionWorkStage, Employee } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import { Plus, Pencil, Trash2, Loader2, Save, PlusCircle, DownloadCloud, Users, Construction, Search, ClipboardCheck, Minus, Folder, FolderOpen, GitBranch, LayoutGrid, Building, FileText, Globe, Workflow, ArrowRight, Clock, ShieldCheck, ChevronDown, ListTree, Settings2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '../ui/badge';
import { MultiSelect, type MultiSelectOption } from '../ui/multi-select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';
import { defaultDepartments, defaultJobs, defaultGovernorates, defaultAreas, defaultTransactionTypes, defaultWorkStages } from '@/lib/default-reference-data';
import { InlineSearchList } from '../ui/inline-search-list';

// --- مساعدات العرض ---

function StatCard({ title, count, icon, onNavigate, colorClass, loading }: { title: string, count: number, icon: React.ReactNode, onNavigate: () => void, colorClass: string, loading: boolean }) {
    return (
        <Card 
            onClick={onNavigate} 
            className="group cursor-pointer border-none shadow-sm rounded-3xl bg-white hover-lift overflow-hidden"
        >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-black text-muted-foreground uppercase tracking-widest">{title}</CardTitle>
                <div className={cn("p-2 rounded-xl transition-colors", colorClass)}>{icon}</div>
            </CardHeader>
            <CardContent>
                {loading ? <Skeleton className="h-8 w-12 mt-1" /> : <div className="text-3xl font-black font-mono tracking-tighter">{count}</div>}
                <div className="flex items-center gap-1 text-[10px] text-primary font-bold mt-2 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0">
                    فتح الإعدادات <ArrowRight className="h-2 w-2"/>
                </div>
            </CardContent>
        </Card>
    );
}

// --- المكون الرئيسي للإدارة (ManagerView) بنمط موحد ---
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
  headerGradient,
  iconColorClass
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
  headerGradient: string;
  iconColorClass: string;
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

  const [departmentActivityFilter, setDepartmentActivityFilter] = useState('all');

  const filteredPrimaryItems = useMemo(() => {
    let items = primaryItems;
    if (primaryCollectionName === 'departments') {
        if (departmentActivityFilter !== 'all') {
            items = items.filter(item => (item as any).activityTypes?.includes(departmentActivityFilter));
        }
    }
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
        
        items.sort((a: any, b: any) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name, 'ar'));
        setPrimaryItems(items);
    } catch (e) { console.error(e); } finally { setLoadingPrimary(false); }
  }, [firestore, primaryCollectionName]);

  useEffect(() => { fetchPrimaryItems(); }, [fetchPrimaryItems]);
  
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
        items.sort((a: any, b: any) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name, 'ar'));
        setSecondaryItems(items);
    } catch (e) { console.error(e); } finally { setLoadingSecondary(false); }
  }, [selectedPrimary, firestore, primaryCollectionName, secondaryCollectionName]);


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

  useEffect(() => { fetchSecondaryItems(); }, [fetchSecondaryItems]);

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
                if (trimmedName && !uniqueJobs.has(trimmedName)) uniqueJobs.set(trimmedName, { value: trimmedName, label: trimmedName });
            }
        });
        setAllJobs(Array.from(uniqueJobs.values()).sort((a,b) => a.label.localeCompare(b.label, 'ar')));

        const stagesSnapshot = await getDocs(query(collectionGroup(firestore, 'workStages')));
        const uniqueStages = new Map<string, WorkStage>();
        stagesSnapshot.forEach(docSnap => {
            const stageId = docSnap.id;
            if (!uniqueStages.has(stageId)) uniqueStages.set(stageId, {id: stageId, ...docSnap.data()} as WorkStage);
        });
        const allStagesData = Array.from(uniqueStages.values());
        setAllWorkStages(allStagesData.sort((a,b) => a.name.localeCompare(b.name, 'ar')).map(s => ({ value: s.id, label: s.name })));
        setAllSequentialStages(allStagesData.filter(s => s.stageType !== 'parallel').sort((a,b) => a.name.localeCompare(b.name, 'ar')).map(s => ({ value: s.id, label: s.name })));
    } finally { setRefDataLoading(false); }
  }, [firestore]);

  useEffect(() => {
    if (isWorkStageView && (isSecondaryDialogOpen || isPrimaryDialogOpen)) fetchReferenceDataForDialog();
  }, [isWorkStageView, isPrimaryDialogOpen, isSecondaryDialogOpen, fetchReferenceDataForDialog]);

  const openDialog = (type: 'primary' | 'secondary', item: any | null = null, parent: any | null = null) => {
    setEditingItem(item);
    if (type === 'primary') {
        setParentCategory(parent);
        setItemName(item?.name || '');
        if (primaryCollectionName === 'departments') setItemActivityTypes((item as any)?.activityTypes || []);
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
       if (type === 'primary' && primaryCollectionName === 'departments') dataToSave.activityTypes = itemActivityTypes;
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
       if (isRecursiveSecondary && type === 'secondary') dataToSave.parentId = parentCategory?.id || null;
       if (isWorkStageView && type === 'secondary') {
          dataToSave.stageType = itemStageType;
          dataToSave.allowedRoles = itemRoles;
          dataToSave.trackingType = itemTrackingType;
          dataToSave.nextStageIds = itemNextStageIds;
          dataToSave.allowManualCompletion = itemAllowManualCompletion;
          dataToSave.allowedDuringStages = itemAllowedDuringStages;
          dataToSave.enableModificationTracking = itemEnableModificationTracking;
          if (itemTrackingType === 'duration') { dataToSave.expectedDurationDays = Number(itemDuration) || null; dataToSave.maxOccurrences = null; }
          else if (itemTrackingType === 'occurrence') { dataToSave.maxOccurrences = Number(itemMaxOccurrences) || null; dataToSave.expectedDurationDays = null; }
          else { dataToSave.expectedDurationDays = null; dataToSave.maxOccurrences = null; }
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
    } catch (e) { toast({ variant: 'destructive', title: 'خطأ' }); } finally { setIsSaving(false); }
  };

  const openDeleteDialog = (item: any, type: 'primary' | 'secondary') => {
      setItemToDelete({ id: item.id, name: item.name, type });
      setIsDeleteDialogOpen(true);
  }

  const handleDelete = async () => {
      if (!firestore || !itemToDelete) return;
      const { id, type } = itemToDelete;
      const collectionPath = type === 'primary' ? primaryCollectionName : `${primaryCollectionName}/${selectedPrimary?.id}/${secondaryCollectionName}`;
      setIsSaving(true);
      try {
        await deleteDoc(doc(firestore, collectionPath, id));
        toast({ title: 'نجاح', description: 'تم الحذف.' });
        if (type === 'primary') await fetchPrimaryItems(); else await fetchSecondaryItems();
      } catch (e) { toast({ variant: 'destructive', title: 'خطأ في الحذف' }); } finally { setIsSaving(false); setIsDeleteDialogOpen(false); setItemToDelete(null); }
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
    const collectionPath = type === 'primary' ? primaryCollectionName : `${primaryCollectionName}/${selectedPrimary?.id}/${secondaryCollectionName}`;
    setIsSaving(true);
    const batch = writeBatch(firestore);
    list.forEach(item => {
        const newOrder = orders[item.id!];
        if (newOrder !== undefined && Number(newOrder) !== (item as any).order) batch.update(doc(firestore, collectionPath, item.id!), { order: Number(newOrder) });
    });
    try { await batch.commit(); toast({ title: 'نجاح الترتيب' }); (type === 'primary' ? setIsPrimaryOrderChanged : setIsSecondaryOrderChanged)(false); type === 'primary' ? fetchPrimaryItems() : fetchSecondaryItems(); } finally { setIsSaving(false); }
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
            if (primaryCollectionName === 'departments') {
                for (const dept of defaultDepartments) {
                    const newDeptRef = doc(collection(firestore, 'departments'));
                    batch.set(newDeptRef, dept);
                    const jobsForDept = defaultJobs[dept.name as keyof typeof defaultJobs];
                    if (jobsForDept && secondaryCollectionName === 'jobs') {
                        for (const job of jobsForDept) batch.set(doc(collection(firestore, `${newDeptRef.path}/jobs`)), job);
                    }
                }
            } else if (primaryCollectionName === 'governorates') {
                for (const gov of defaultGovernorates) {
                    const newGovRef = doc(collection(firestore, 'governorates'));
                    batch.set(newGovRef, gov);
                    const areasForGov = defaultAreas[gov.name as keyof typeof defaultAreas];
                    if (areasForGov && secondaryCollectionName === 'areas') {
                        for (const area of areasForGov) batch.set(doc(collection(firestore, `${newGovRef.path}/areas`)), area);
                    }
                }
            }
            await batch.commit();
            toast({ title: 'نجاح الاستيراد' });
            fetchPrimaryItems();
        } finally { setIsImporting(false); setIsImportConfirmOpen(false); }
    };

    const activityTypeMap = useMemo(() => new Map((companyActivityTypes || []).map(t => [t.id, t.name])), [companyActivityTypes]);
    const subcontractorTypeOptions: MultiSelectOption[] = useMemo(() => (subcontractorTypes || []).map(t => ({ value: t.id!, label: t.name })), [subcontractorTypes]);
    const activityTypeOptions: MultiSelectOption[] = useMemo(() => (companyActivityTypes || []).map(t => ({ value: t.id!, label: t.name })), [companyActivityTypes]);

    const RecursiveItemRenderer = ({ node, level, onEdit, onDelete, onAddSub, type }: any) => {
        const isOpen = openCategories.has(node.id!);
        const toggleOpen = () => { setOpenCategories(prev => { const newSet = new Set(prev); if (newSet.has(node.id!)) newSet.delete(node.id!); else newSet.add(node.id!); return newSet; }); };
        return (
            <div style={{ paddingRight: `${level * 1.5}rem` }} className="space-y-1">
                <div className="flex items-center justify-between p-2 rounded-xl hover:bg-muted/50 group transition-all">
                    <div className="flex items-center gap-2 flex-grow cursor-pointer" onClick={toggleOpen}>
                        {node.children && node.children.length > 0 ? (
                            <Button variant="ghost" size="icon" className="h-6 w-6">{isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}</Button>
                        ) : <div className="w-6 h-6" />}
                        <div className="flex flex-col"><span className="font-bold text-sm">{node.name}</span>{node.isHeader && <Badge variant="secondary" className="w-fit text-[8px] h-3 px-1 mt-0.5">قسم رئيسي</Badge>}</div>
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
    <div className="space-y-6" dir="rtl">
      <Card className={cn("rounded-[2.5rem] border-none shadow-sm overflow-hidden", headerGradient)}>
        <CardHeader className="pb-8 px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4">
              <div className={cn("p-3 rounded-2xl shadow-inner bg-white/20 text-white", iconColorClass)}>{icon}</div>
              <div className="text-white">
                <CardTitle className="text-3xl font-black">{primaryTitle}</CardTitle>
                <CardDescription className="text-white/80 font-medium mt-1">تحديث سجلات {primaryTitle} والبيانات التابعة لها.</CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
                {(primaryCollectionName === 'departments' || primaryCollectionName === 'governorates') && (
                    <Button variant="ghost" size="sm" onClick={() => setIsImportConfirmOpen(true)} className="rounded-xl text-white hover:bg-white/10 border border-white/20">
                        {isImporting ? <Loader2 className="animate-spin h-4 w-4"/> : <DownloadCloud className="h-4 w-4 ml-2" />} استيراد الافتراضي
                    </Button>
                )}
                <Button onClick={onBack} variant="ghost" className="rounded-xl font-bold gap-2 text-white hover:bg-white/10">
                    <ArrowRight className="h-4 w-4" /> العودة
                </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white">
        <CardContent className="p-0">
            <div className="grid grid-cols-1 md:grid-cols-12 min-h-[600px]">
                {/* Sidebar (Primary List) */}
                <div className="md:col-span-4 border-l bg-slate-50/50 flex flex-col">
                    <div className="p-6 border-b space-y-4">
                        <div className="flex justify-between items-center">
                            <Label className="font-black text-primary text-base">{primarySingularTitle}</Label>
                            {!disablePrimaryActions && <Button size="icon" variant="ghost" onClick={() => openDialog('primary')} className="h-9 w-9 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white"><Plus className="h-5 w-5" /></Button>}
                        </div>
                        {primaryCollectionName === 'departments' && (
                            <Select value={departmentActivityFilter} onValueChange={setDepartmentActivityFilter}>
                                <SelectTrigger className="rounded-xl h-9 text-xs"><SelectValue placeholder="تصفية حسب النشاط..."/></SelectTrigger>
                                <SelectContent dir="rtl"><SelectItem value="all">الكل</SelectItem>{companyActivityTypes?.map(t => <SelectItem key={t.id} value={t.id!}>{t.name}</SelectItem>)}</SelectContent>
                            </Select>
                        )}
                    </div>
                    <ScrollArea className="flex-1 p-4">
                        {loadingPrimary ? <Skeleton className="h-64 w-full rounded-2xl" /> : 
                        filteredPrimaryItems.length === 0 ? <p className="text-center p-10 text-muted-foreground italic text-xs font-bold">لا توجد بيانات.</p> :
                        isRecursiveView ? (
                            <div className="space-y-1">
                                {useMemo(() => {
                                    const map = new Map();
                                    const roots: any[] = [];
                                    primaryItems.forEach(i => map.set(i.id, { ...i, children: [] }));
                                    primaryItems.forEach(i => {
                                        const pid = i.parentId || i.parentBoqReferenceItemId;
                                        if (pid && map.has(pid)) map.get(pid).children.push(map.get(i.id));
                                        else roots.push(map.get(i.id));
                                    });
                                    return roots;
                                }, [primaryItems]).map(node => <RecursiveItemRenderer key={node.id} node={node} level={0} onEdit={(i: any) => openDialog('primary', i)} onDelete={openDeleteDialog} onAddSub={(p: any) => openDialog('primary', null, p)} type="primary" />)}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {filteredPrimaryItems.map(item => (
                                    <div key={item.id} onClick={() => handleSelectPrimary(item)} className={cn("group flex items-center justify-between p-4 rounded-[1.5rem] cursor-pointer transition-all", selectedPrimary?.id === item.id ? "bg-primary text-white shadow-lg" : "hover:bg-muted/50 bg-white border")}>
                                        <span className="font-bold text-sm truncate">{item.name}</span>
                                        <div className={cn("flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity", selectedPrimary?.id === item.id && "opacity-100")}>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-white/20 text-current" onClick={(e) => { e.stopPropagation(); openDialog('primary', item); }}><Pencil className="h-3.5 w-3.5"/></Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-red-100/20 text-current" onClick={(e) => { e.stopPropagation(); openDeleteDialog(item, 'primary'); }}><Trash2 className="h-3.5 w-3.5"/></Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </div>

                {/* Content Area (Secondary List) */}
                <div className="md:col-span-8 flex flex-col">
                    {selectedPrimary ? (
                        <>
                            <div className="p-8 border-b bg-muted/5 flex justify-between items-center">
                                <div>
                                    <h3 className="text-2xl font-black text-gray-800">{secondaryTitle}</h3>
                                    <p className="text-sm font-bold text-primary mt-1">التابعة لـ {primarySingularTitle}: {selectedPrimary.name}</p>
                                </div>
                                {secondaryCollectionName && (
                                    <Button onClick={() => openDialog('secondary')} className="rounded-xl font-bold h-11 px-6 shadow-lg shadow-primary/20">
                                        <PlusCircle className="ml-2 h-5 w-5" /> إضافة {secondarySingularTitle} جديد
                                    </Button>
                                )}
                            </div>
                            <ScrollArea className="flex-1 p-8">
                                {loadingSecondary ? <div className="space-y-4"><Skeleton className="h-16 w-full rounded-2xl"/><Skeleton className="h-16 w-full rounded-2xl"/></div> :
                                secondaryItems.length === 0 ? <div className="h-64 flex flex-col items-center justify-center grayscale opacity-20"><PlusCircle className="h-16 w-16 mb-4"/><p className="font-bold">لا يوجد {secondaryTitle} حالياً.</p></div> :
                                <div className="grid gap-4">
                                    {secondaryItems.map(item => (
                                        <div key={item.id} className="flex items-center justify-between p-5 border-2 border-transparent bg-slate-50/50 rounded-[1.5rem] hover:bg-white hover:border-primary/10 hover:shadow-md transition-all group">
                                            <span className="font-black text-lg text-gray-700">{item.name}</span>
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl bg-white border shadow-sm" onClick={() => openDialog('secondary', item)}><Pencil className="h-5 w-5"/></Button>
                                                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl bg-white border shadow-sm text-destructive hover:bg-red-50" onClick={() => openDeleteDialog(item, 'secondary')}><Trash2 className="h-5 w-5"/></Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>}
                            </ScrollArea>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-30 grayscale">
                            <ArrowRight className="h-20 w-20 mb-6 text-primary animate-pulse" />
                            <h3 className="text-2xl font-black">اختر {primarySingularTitle}</h3>
                            <p className="font-bold mt-2">يرجى اختيار {primarySingularTitle} من القائمة الجانبية لإدارة {secondaryTitle}.</p>
                        </div>
                    )}
                </div>
            </div>
        </CardContent>
      </Card>

      {/* --- Dialogs & Alerts (Shared Styles) --- */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent dir="rtl" className="rounded-3xl shadow-2xl border-none">
            <AlertDialogHeader>
                <div className="flex items-center gap-3 mb-2"><div className="p-3 bg-red-100 rounded-2xl text-red-600 shadow-inner"><ShieldCheck className="h-6 w-6"/></div><AlertDialogTitle className="text-2xl font-black text-red-700">تأكيد الحذف النهائي؟</AlertDialogTitle></div>
                <AlertDialogDescription className="text-base font-medium leading-relaxed">أنت على وشك حذف <strong>"{itemToDelete?.name}"</strong>. سيؤدي هذا الإجراء لحذف كافة التبعيات المرتبطة، وهو غير قابل للتراجع.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-6 gap-2"><AlertDialogCancel className="rounded-xl font-bold" disabled={isSaving}>إلغاء</AlertDialogCancel><AlertDialogAction onClick={handleDelete} disabled={isSaving} className="bg-destructive hover:bg-destructive/90 rounded-xl font-black px-10">{isSaving ? <Loader2 className="animate-spin h-4 w-4"/> : 'نعم، حذف نهائي'}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isImportConfirmOpen} onOpenChange={setIsImportConfirmOpen}>
        <AlertDialogContent dir="rtl" className="rounded-3xl">
            <AlertDialogHeader><AlertDialogTitle className="text-2xl font-black text-primary">استيراد البيانات الافتراضية؟</AlertDialogTitle><AlertDialogDescription className="text-base leading-relaxed">سيقوم هذا الإجراء بـ <strong>تصفير كافة البيانات الحالية</strong> لـ {primaryTitle} وتنزيل القائمة المرجعية الموحدة.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter className="mt-6 gap-2"><AlertDialogCancel className="rounded-xl font-bold">إلغاء</AlertDialogCancel><AlertDialogAction onClick={handleImportDefaults} disabled={isImporting} className="bg-primary hover:bg-primary/90 rounded-xl font-black px-10 shadow-lg shadow-primary/20">{isImporting ? <Loader2 className="animate-spin h-4 w-4"/> : 'نعم، استيراد وتحديث'}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Primary Item Dialog */}
      <Dialog open={isPrimaryDialogOpen} onOpenChange={closeDialog}>
        <DialogContent dir="rtl" className="max-w-md rounded-[2.5rem] shadow-2xl p-8 border-none">
            <DialogHeader><DialogTitle className="text-2xl font-black">{editingItem ? 'تعديل' : 'إضافة'} {primarySingularTitle}</DialogTitle></DialogHeader>
            <div className="grid gap-6 py-6">
                <div className="grid gap-2">
                    <Label className="font-bold pr-1">اسم الـ {primarySingularTitle} *</Label>
                    <Input value={itemName} onChange={e => setItemName(e.target.value)} required className="h-12 rounded-2xl border-2 text-lg font-bold shadow-inner" />
                </div>
                {primaryCollectionName === 'departments' && (
                    <div className="grid gap-2">
                        <Label className="font-bold text-xs opacity-60 pr-1 uppercase">الأنشطة المرتبطة</Label>
                        <MultiSelect options={activityTypeOptions} selected={itemActivityTypes} onChange={setItemActivityTypes} placeholder="اختر..." className="rounded-xl" />
                    </div>
                )}
            </div>
            <DialogFooter className="gap-2 pt-4 border-t"><Button variant="ghost" onClick={closeDialog} disabled={isSaving}>إلغاء</Button><Button onClick={() => handleSave('primary')} disabled={isSaving || !itemName.trim()} className="rounded-xl h-11 px-10 font-black gap-2 shadow-xl shadow-primary/20">{isSaving ? <Loader2 className="animate-spin h-4 w-4"/> : <Save className="h-4 w-4"/>} حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Secondary Item Dialog */}
      <Dialog open={isSecondaryDialogOpen} onOpenChange={closeDialog}>
        <DialogContent dir="rtl" className="max-w-md rounded-[2.5rem] shadow-2xl p-8 border-none">
            <DialogHeader><DialogTitle className="text-2xl font-black">{editingItem ? 'تعديل' : 'إضافة'} {secondarySingularTitle}</DialogTitle></DialogHeader>
            <div className="grid gap-6 py-6">
                <div className="grid gap-2">
                    <Label className="font-bold pr-1">اسم الـ {secondarySingularTitle} *</Label>
                    <Input value={itemName} onChange={e => setItemName(e.target.value)} required className="h-12 rounded-2xl border-2 text-lg font-bold shadow-inner" />
                </div>
            </div>
            <DialogFooter className="gap-2 pt-4 border-t"><Button variant="ghost" onClick={closeDialog} disabled={isSaving}>إلغاء</Button><Button onClick={() => handleSave('secondary')} disabled={isSaving || !itemName.trim()} className="rounded-xl h-11 px-10 font-black gap-2 shadow-xl shadow-primary/20">{isSaving ? <Loader2 className="animate-spin h-4 w-4"/> : <Save className="h-4 w-4"/>} حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
