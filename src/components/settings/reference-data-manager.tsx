
'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { 
    collection, 
    query, 
    orderBy, 
    doc, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    writeBatch, 
    getDocs, 
    serverTimestamp,
    collectionGroup
} from 'firebase/firestore'; 
import { 
    Card, 
    CardHeader, 
    CardTitle, 
    CardContent, 
    CardDescription, 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
    Plus, Pencil, Trash2, Loader2, Save, PlusCircle, 
    DownloadCloud, Building2, Workflow, 
    ArrowRight, ListTree, Settings2,
    MapPin, X, Layers, Activity, GripVertical,
    Sparkles,
    Zap,
    ChevronLeft,
    GitBranch,
    Clock,
    RotateCcw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn, getTenantPath, cleanFirestoreData } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { MultiSelect, type MultiSelectOption } from '../ui/multi-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { 
    defaultDepartments, 
    defaultJobs, 
    defaultGovernorates, 
    defaultAreas, 
    defaultTransactionTypes, 
    defaultWorkStages 
} from '@/lib/default-reference-data';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';

import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';

import { CSS } from '@dnd-kit/utilities';

function SortableRefListItem({ id, children, isActive }: { id: string, children: React.ReactNode, isActive?: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div 
        ref={setNodeRef} 
        style={style} 
        className={cn(
            "group relative flex items-center justify-between p-4 rounded-[1.8rem] cursor-default transition-all border-2 mb-2",
            isActive 
              ? "bg-primary border-primary text-white shadow-xl scale-[1.01]" 
              : "bg-white/60 hover:bg-white hover:border-primary/20 border-transparent shadow-sm"
        )}
    >
        <div className="flex items-center gap-4 flex-1" onClick={isActive ? undefined : (attributes as any).onClick}>
            <button 
                {...attributes} 
                {...listeners} 
                className="cursor-grab active:cursor-grabbing p-1.5 rounded-xl hover:bg-primary/10 transition-colors"
                type="button"
            >
                <GripVertical className={cn("h-4 w-4", isActive ? "text-white" : "text-primary opacity-30 group-hover:opacity-100")} />
            </button>
            {children}
        </div>
    </div>
  );
}

function SummaryCard({ title, count, icon, onNavigate, colorClass, loading, description }: { title: string, count: number, icon: React.ReactNode, onNavigate: () => void, colorClass: string, loading: boolean, description: string }) {
    return (
        <Card 
            onClick={onNavigate} 
            className="group cursor-pointer border-none shadow-2xl rounded-[3rem] bg-white/45 backdrop-blur-3xl hover-lift overflow-hidden relative border-white/60"
        >
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-primary/20 transition-all duration-700" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10 p-8">
                <CardTitle className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{title}</CardTitle>
                <div className={cn("p-4 rounded-2xl transition-all shadow-inner group-hover:scale-110 group-hover:shadow-lg", colorClass)}>{icon}</div>
            </CardHeader>
            <CardContent className="relative z-10 px-8 pb-8">
                {loading ? <Skeleton className="h-10 w-16 mt-1" /> : <div className="text-6xl font-black font-mono tracking-tighter text-[#1e1b4b]">{count}</div>}
                <p className="text-xs font-black text-slate-500 mt-3">{description}</p>
                <div className="flex items-center gap-1 text-[10px] text-primary font-black mt-6 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0 uppercase tracking-[0.2em]">
                    تعديل القوائم <ArrowRight className="h-3 w-3"/>
                </div>
            </CardContent>
        </Card>
    );
}

export function ReferenceDataManager() {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();

    const [view, setView] = useState<'main' | 'departments' | 'locations' | 'transactions'>('main');
    
    const [selectedPrimaryId, setSelectedPrimaryId] = useState<string | null>(null);
    const [selectedSecondaryId, setSelectedSecondaryId] = useState<string | null>(null); 
    const [isSaving, setIsSaving] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    
    const [isPrimaryDialogOpen, setIsPrimaryDialogOpen] = useState(false);
    const [isSecondaryDialogOpen, setIsSecondaryDialogOpen] = useState(false);
    const [isTertiaryDialogOpen, setIsTertiaryDialogOpen] = useState(false); 
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);
    
    const [editingItem, setEditingItem] = useState<any | null>(null);
    const [itemToDelete, setItemToDelete] = useState<any | null>(null);
    const [itemName, setItemName] = useState('');
    const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
    
    const [trackingType, setTrackingType] = useState<'duration' | 'occurrence' | 'hybrid' | 'none'>('duration');
    const [expectedDuration, setExpectedDuration] = useState('7');
    const [maxOccurrences, setMaxOccurrences] = useState('3');
    const [nextStageIds, setNextStageIds] = useState<string[]>([]);

    const tenantId = currentUser?.currentCompanyId;

    const sensors = useSensors(
      useSensor(PointerSensor),
      useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const primaryCollectionName = useMemo(() => {
        if (view === 'departments') return 'departments';
        if (view === 'locations') return 'governorates';
        if (view === 'transactions') return 'transactionTypes';
        return '';
    }, [view]);

    const secondaryCollectionName = useMemo(() => {
        if (view === 'departments') return 'jobs'; 
        if (view === 'locations') return 'areas';
        if (view === 'transactions') return 'subServices';
        return '';
    }, [view]);

    const { data: rawPrimaryItems = [], loading: loadingPrimary } = useSubscription<any>(firestore, primaryCollectionName || null);
    
    const secondaryRelativePath = useMemo(() => {
        if (!selectedPrimaryId || !primaryCollectionName || !secondaryCollectionName) return null;
        return `${primaryCollectionName}/${selectedPrimaryId}/${secondaryCollectionName}`;
    }, [selectedPrimaryId, primaryCollectionName, secondaryCollectionName]);
    
    const { data: rawSecondaryItems = [], loading: loadingSecondary } = useSubscription<any>(firestore, secondaryRelativePath);

    const tertiaryRelativePath = useMemo(() => {
        if (view !== 'transactions' || !selectedPrimaryId || !selectedSecondaryId) return null;
        return `transactionTypes/${selectedPrimaryId}/subServices/${selectedSecondaryId}/workStages`;
    }, [view, selectedPrimaryId, selectedSecondaryId]);

    const { data: rawTertiaryItems = [], loading: loadingTertiary } = useSubscription<any>(firestore, tertiaryRelativePath);

    const primaryItems = useMemo(() => {
        return [...rawPrimaryItems].sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name, 'ar'));
    }, [rawPrimaryItems]);

    const secondaryItems = useMemo(() => {
        return [...rawSecondaryItems].sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name, 'ar'));
    }, [rawSecondaryItems]);

    const tertiaryItems = useMemo(() => {
        return [...rawTertiaryItems].sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name, 'ar'));
    }, [rawTertiaryItems]);

    const selectedPrimary = useMemo(() => (primaryItems || []).find(i => i.id === selectedPrimaryId), [primaryItems, selectedPrimaryId]);
    const selectedSecondary = useMemo(() => (secondaryItems || []).find(i => i.id === selectedSecondaryId), [secondaryItems, selectedSecondaryId]);

    const { data: allDepartments = [] } = useSubscription<any>(firestore, 'departments');
    const departmentOptions = useMemo(() => allDepartments.map((d: any) => ({ value: d.id!, label: d.name })), [allDepartments]);

    const closeDialog = useCallback(() => {
        setIsPrimaryDialogOpen(false);
        setIsSecondaryDialogOpen(false);
        setIsTertiaryDialogOpen(false);
        setEditingItem(null);
        setItemName('');
        setSelectedDeptIds([]);
        setTrackingType('duration');
        setExpectedDuration('7');
        setMaxOccurrences('3');
        setNextStageIds([]);
    }, []);

    const handleDragEnd = async (event: DragEndEvent, type: 'primary' | 'secondary' | 'tertiary') => {
        const { active, over } = event;
        if (!over || active.id === over.id || !firestore || !tenantId) return;

        const list = type === 'primary' ? primaryItems : type === 'secondary' ? secondaryItems : tertiaryItems;
        const relPath = type === 'primary' ? primaryCollectionName : type === 'secondary' ? secondaryRelativePath : tertiaryRelativePath;
        if (!relPath) return;

        const oldIndex = list.findIndex((item) => item.id === active.id);
        const newIndex = list.findIndex((item) => item.id === over.id);
        const newOrderedList = arrayMove(list, oldIndex, newIndex);
        
        setIsSaving(true);
        try {
            const batch = writeBatch(firestore);
            const finalPath = getTenantPath(relPath, tenantId);
            newOrderedList.forEach((item, idx) => {
                const itemRef = doc(firestore, finalPath!, item.id);
                batch.update(itemRef, { order: idx });
            });
            await batch.commit();
            toast({ title: 'تم حفظ الترتيب المعتمد' });
        } catch (e) { toast({ variant: 'destructive', title: 'فشل الحفظ' }); } finally { setIsSaving(false); }
    };

    const handleSave = async (type: 'primary' | 'secondary' | 'tertiary') => {
        if (!firestore || !itemName.trim() || !tenantId) return;

        const relPath = type === 'primary' ? primaryCollectionName : type === 'secondary' ? secondaryRelativePath : tertiaryRelativePath;
        if (!relPath) return;

        setIsSaving(true);
        try {
            const finalPath = getTenantPath(relPath, tenantId);
            const currentList = type === 'primary' ? primaryItems : type === 'secondary' ? secondaryItems : tertiaryItems;
            
            const payload: any = { 
                name: itemName, 
                updatedAt: serverTimestamp(),
                companyId: tenantId
            };

            if (view === 'transactions' && type === 'primary') payload.departmentIds = selectedDeptIds;
            if (type === 'secondary' && selectedPrimaryId) payload.parentId = selectedPrimaryId;
            if (type === 'tertiary') {
                payload.parentId = selectedSecondaryId;
                payload.trackingType = trackingType;
                payload.nextStageIds = nextStageIds || [];
                if (trackingType === 'duration' || trackingType === 'hybrid') payload.expectedDurationDays = parseInt(expectedDuration);
                if (trackingType === 'occurrence' || trackingType === 'hybrid') payload.maxOccurrences = parseInt(maxOccurrences);
            }

            if (editingItem) {
                await updateDoc(doc(firestore, finalPath!, editingItem.id), cleanFirestoreData(payload));
            } else {
                payload.order = currentList.length;
                await addDoc(collection(firestore, finalPath!), { ...payload, createdAt: serverTimestamp() });
            }
            
            toast({ title: 'تم الحفظ بنجاح' });
            closeDialog();
        } catch (e) { toast({ variant: 'destructive', title: 'خطأ في الحفظ' }); } finally { setIsSaving(false); }
    };

    const handleDelete = async () => {
        if (!firestore || !itemToDelete || !tenantId) return;
        const relPath = itemToDelete.target === 'primary' ? primaryCollectionName : 
                          itemToDelete.target === 'secondary' ? secondaryRelativePath : tertiaryRelativePath;
        if (!relPath) return;

        setIsSaving(true);
        try {
            const finalPath = getTenantPath(relPath, tenantId);
            await deleteDoc(doc(firestore, finalPath!, itemToDelete.id));
            toast({ title: 'تم الحذف النهائي' });
            setIsDeleteDialogOpen(false); 
            setItemToDelete(null);
        } catch (e) { toast({ variant: 'destructive', title: 'فشل الحذف' }); } finally { setIsSaving(false); }
    };

    const handleImportDefaults = async () => {
        if (!firestore || !tenantId) return;
        setIsImporting(true);
        try {
            const batch = writeBatch(firestore);

            // 1. استيراد الأقسام والوظائف
            for (const dept of defaultDepartments) {
                const deptRef = doc(collection(firestore, getTenantPath('departments', tenantId)!));
                batch.set(deptRef, cleanFirestoreData({ ...dept, companyId: tenantId, createdAt: serverTimestamp() }));
                
                const deptJobs = defaultJobs[dept.name] || [];
                deptJobs.forEach(job => {
                    const jobRef = doc(collection(firestore, getTenantPath(`departments/${deptRef.id}/jobs`, tenantId)!));
                    batch.set(jobRef, cleanFirestoreData({ ...job, parentId: deptRef.id, companyId: tenantId }));
                });
            }

            // 2. استيراد المواقع الجغرافية
            for (const gov of defaultGovernorates) {
                const govRef = doc(collection(firestore, getTenantPath('governorates', tenantId)!));
                batch.set(govRef, cleanFirestoreData({ ...gov, companyId: tenantId }));
                
                const govAreas = defaultAreas[gov.name] || [];
                govAreas.forEach(area => {
                    const areaRef = doc(collection(firestore, getTenantPath(`governorates/${govRef.id}/areas`, tenantId)!));
                    batch.set(areaRef, cleanFirestoreData({ ...area, parentId: govRef.id, companyId: tenantId }));
                });
            }

            // 3. استيراد أنواع الخدمات وهيكل الـ WBS الكامل
            for (const type of defaultTransactionTypes) {
                const typeRef = doc(collection(firestore, getTenantPath('transactionTypes', tenantId)!));
                batch.set(typeRef, cleanFirestoreData({ 
                    name: type.name, 
                    order: type.order, 
                    activityType: type.activityType, 
                    companyId: tenantId 
                }));

                const subRef = doc(collection(firestore, getTenantPath(`transactionTypes/${typeRef.id}/subServices`, tenantId)!));
                batch.set(subRef, cleanFirestoreData({ name: 'خدمة أساسية', order: 1, parentId: typeRef.id, companyId: tenantId }));

                const stages = defaultWorkStages['القسم المعماري'] || [];
                stages.forEach(stage => {
                    const stageRef = doc(collection(firestore, getTenantPath(`transactionTypes/${typeRef.id}/subServices/${subRef.id}/workStages`, tenantId)!));
                    batch.set(stageRef, cleanFirestoreData({ ...stage, parentId: subRef.id, companyId: tenantId }));
                });
            }

            await batch.commit();
            toast({ title: 'نجاح الاستيراد', description: 'تم تأسيس الهيكل المرجعي بنجاح.' });
            setIsImportConfirmOpen(false);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'فشل الاستيراد', description: e.message });
        } finally {
            setIsImporting(false);
        }
    };

    const nextStageOptions: MultiSelectOption[] = useMemo(() => 
        tertiaryItems
            .filter(i => i.id !== editingItem?.id)
            .map(i => ({ value: i.id!, label: i.name }))
    , [tertiaryItems, editingItem]);

    if (view === 'main') {
        return (
            <div className="space-y-12" dir="rtl">
                <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-gradient-to-r from-[#FF7A00] to-[#FFB000] text-white relative">
                    <div className="absolute top-0 right-0 w-80 h-full bg-white/10 -skew-x-12 transform translate-x-32 pointer-events-none" />
                    <CardHeader className="p-10 relative z-10 border-b border-white/10">
                        <div className="flex items-center gap-6">
                            <div className="text-right">
                                <CardTitle className="text-3xl font-black text-white tracking-tighter">إدارة القوائم والبيانات المرجعية</CardTitle>
                                <div className="flex items-center gap-2 mt-1">
                                    <Sparkles className="h-4 w-4 text-amber-200 animate-pulse" />
                                    <CardDescription className="text-white/90 font-bold text-sm">تخصيص الأقسام، المواقع، وهيكل مراحل العمل (WBS).</CardDescription>
                                </div>
                            </div>
                            <div className="p-5 bg-white/20 rounded-[2rem] backdrop-blur-xl border border-white/40 shadow-2xl">
                                <Settings2 className="h-10 w-10 text-white" />
                            </div>
                        </div>
                    </CardHeader>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 px-2">
                    <SummaryCard 
                        title="الأقسام والوظائف" 
                        count={primaryItems?.length || 0} 
                        icon={<Building2 className="h-10 w-10"/>} 
                        onNavigate={() => { setView('departments'); setSelectedPrimaryId(null); }} 
                        colorClass="bg-blue-600/10 text-blue-600" 
                        loading={loadingPrimary} 
                        description="إدارة الهيكل التنظيمي والوظائف المعتمدة." 
                    />
                    <SummaryCard 
                        title="المناطق والمواقع" 
                        count={primaryItems?.length || 0} 
                        icon={<MapPin className="h-10 w-10"/>} 
                        onNavigate={() => { setView('locations'); setSelectedPrimaryId(null); }} 
                        colorClass="bg-emerald-600/10 text-emerald-600" 
                        loading={loadingPrimary} 
                        description="إدارة المحافظات والمناطق الجغرافية." 
                    />
                    <SummaryCard 
                        title="أنواع الخدمات والمراحل" 
                        count={primaryItems?.length || 0} 
                        icon={<Workflow className="h-10 w-10"/>} 
                        onNavigate={() => { setView('transactions'); setSelectedPrimaryId(null); setSelectedSecondaryId(null); }} 
                        colorClass="bg-orange-600/10 text-primary" 
                        loading={loadingPrimary} 
                        description="قائمة المعاملات المتاحة وربطها بمراحل الإنجاز (WBS)." 
                    />
                </div>
                
                <div className="flex justify-center no-print">
                    <Button onClick={() => setIsImportConfirmOpen(true)} variant="outline" className="h-14 px-12 rounded-[2.2rem] border-2 border-dashed font-black text-xl text-primary gap-3 hover:bg-primary/5">
                        <DownloadCloud className="h-6 w-6" /> استيراد الهيكل المرجعي الموحد
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-gradient-to-r from-[#FF7A00] to-[#FFB000] text-white relative">
                <div className="absolute top-0 right-0 w-80 h-full bg-white/10 -skew-x-12 transform translate-x-32 pointer-events-none" />
                <CardHeader className="p-10 relative z-10 border-b border-white/10">
                    <div className="flex flex-col lg:flex-row justify-between items-center gap-8">
                        <div className="flex gap-4">
                            <Button onClick={() => setView('main')} variant="outline" className="bg-white/10 text-white border-white/40 hover:bg-white/20 rounded-2xl font-black h-12 px-8 gap-2 backdrop-blur-md shadow-xl">
                                <X className="h-5 w-5" /> إغلاق
                            </Button>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="text-right">
                                <CardTitle className="text-3xl font-black tracking-tighter text-white">
                                    {view === 'departments' ? 'إدارة الأقسام' : view === 'locations' ? 'إدارة المواقع' : 'إدارة الخدمات والمراحل'}
                                </CardTitle>
                                <div className="flex items-center gap-2 mt-2 justify-end">
                                    <Sparkles className="h-4 w-4 text-amber-200 animate-pulse" />
                                    <CardDescription className="text-white/90 font-black text-sm uppercase tracking-widest">قم بسحب وإفلات العناصر لترتيب الظهور.</CardDescription>
                                </div>
                            </div>
                            <div className="p-5 bg-white/20 rounded-[2rem] backdrop-blur-xl border border-white/40 shadow-2xl">
                                {view === 'departments' ? <Building2 className="h-10 w-10 text-white" /> : view === 'locations' ? <MapPin className="h-10 w-10 text-white" /> : <Workflow className="h-10 w-10 text-white" />}
                            </div>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-12 min-h-[600px] gap-6">
                <Card className="md:col-span-4 border-none rounded-[2rem] shadow-xl bg-white/45 backdrop-blur-xl overflow-hidden flex flex-col border-white/60">
                    <div className="p-8 border-b bg-primary/5 flex justify-between items-center">
                        <Label className="font-black text-[#1e1b4b] text-lg tracking-tight">القائمة الرئيسية</Label>
                        <Button onClick={() => { setEditingItem(null); setItemName(''); setIsPrimaryDialogOpen(true); }} className="h-10 w-10 rounded-xl shadow-xl shadow-primary/20"><Plus className="h-5 w-5" /></Button>
                    </div>
                    <ScrollArea className="flex-1 p-6">
                        {loadingPrimary ? <div className="space-y-4"><Skeleton className="h-12 w-full rounded-xl"/><Skeleton className="h-12 w-full rounded-xl"/></div> : 
                        primaryItems.length === 0 ? <p className="text-center p-20 text-muted-foreground italic font-black opacity-20">لا توجد سجلات.</p> :
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, 'primary')}>
                            <SortableContext items={primaryItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                                <div className="space-y-2">
                                    {primaryItems.map(item => (
                                        <SortableRefListItem key={item.id} id={item.id} isActive={selectedPrimaryId === item.id}>
                                            <div className="flex items-center justify-between flex-1" onClick={() => { setSelectedPrimaryId(item.id); setSelectedSecondaryId(null); }}>
                                                <span className="font-black text-sm truncate pr-2">{item.name}</span>
                                                <div className={cn("flex gap-1.5 transition-all", selectedPrimaryId === item.id ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-white/30 text-current" onClick={(e) => { e.stopPropagation(); setEditingItem(item); setItemName(item.name); setSelectedDeptIds(item.departmentIds || []); setIsPrimaryDialogOpen(true); }}><Pencil className="h-4 w-4"/></Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-red-500/20 text-current" onClick={(e) => { e.stopPropagation(); setItemToDelete({ id: item.id, name: item.name, target: 'primary' }); setIsDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4"/></Button>
                                                </div>
                                            </div>
                                        </SortableRefListItem>
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>}
                    </ScrollArea>
                </Card>

                <Card className="md:col-span-8 border-none rounded-[2rem] shadow-xl bg-white/45 backdrop-blur-xl overflow-hidden flex flex-col border-white/60">
                    {selectedPrimaryId ? (
                        <>
                            <div className="p-8 border-b bg-muted/5">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-5">
                                        {selectedSecondaryId ? (
                                             <Button variant="ghost" size="icon" onClick={() => setSelectedSecondaryId(null)} className="h-9 w-9 rounded-full border bg-white shadow-sm"><ChevronLeft className="h-4 w-4"/></Button>
                                        ) : (
                                            <div className="p-3 bg-white rounded-xl shadow-xl border border-primary/10">
                                                {view === 'transactions' ? <Zap className="h-6 w-6 text-primary"/> : <ListTree className="h-6 w-6 text-primary"/>}
                                            </div>
                                        )}
                                        <div className="space-y-0.5">
                                            <h3 className="text-2xl font-black text-[#1e1b4b] tracking-tight">{selectedSecondaryId ? selectedSecondary?.name : selectedPrimary?.name}</h3>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedSecondaryId ? 'مراحل الإنجاز (WBS)' : 'إدارة البنود الفرعية'}</p>
                                        </div>
                                    </div>
                                    <Button onClick={() => { setEditingItem(null); setItemName(''); if(selectedSecondaryId) setIsTertiaryDialogOpen(true); else setIsSecondaryDialogOpen(true); }} className="rounded-xl font-black h-11 px-8 shadow-xl shadow-primary/20 gap-2">
                                        <PlusCircle className="h-5 w-5" /> {selectedSecondaryId ? 'إضافة مرحلة' : 'إضافة بند'}
                                    </Button>
                                </div>
                            </div>
                            <ScrollArea className="flex-1 p-8">
                                {(selectedSecondaryId ? loadingTertiary : loadingSecondary) ? <div className="space-y-4"><Skeleton className="h-12 w-full rounded-xl"/><Skeleton className="h-12 w-full rounded-xl"/></div> :
                                (selectedSecondaryId ? tertiaryItems : secondaryItems).length === 0 ? (
                                    <div className="h-64 flex flex-col items-center justify-center grayscale opacity-10 border-4 border-dashed rounded-[2.5rem] border-primary/5 m-8">
                                        <PlusCircle className="h-16 w-16 mb-4 text-primary animate-pulse"/>
                                        <p className="font-black text-xl">لا توجد بيانات فرعية.</p>
                                    </div>
                                ) : (
                                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, selectedSecondaryId ? 'tertiary' : 'secondary')}>
                                    <SortableContext items={(selectedSecondaryId ? tertiaryItems : secondaryItems).map(i => i.id)} strategy={verticalListSortingStrategy}>
                                        <div className="grid grid-cols-1 gap-3">
                                            {(selectedSecondaryId ? tertiaryItems : secondaryItems).map(item => (
                                                <SortableRefListItem key={item.id} id={item.id}>
                                                    <div className="flex items-center justify-between flex-1">
                                                        <div className="flex items-center gap-4">
                                                            <div className="p-2.5 bg-primary/5 rounded-xl border border-primary/10">
                                                                {selectedSecondaryId ? (
                                                                    item.trackingType === 'duration' ? <Clock className="h-4 w-4 text-blue-600"/> :
                                                                    item.trackingType === 'occurrence' ? <RotateCcw className="h-4 w-4 text-orange-600"/> :
                                                                    item.trackingType === 'hybrid' ? <Sparkles className="h-4 w-4 text-purple-600"/> :
                                                                    <Activity className="h-4 w-4 text-slate-400"/>
                                                                ) : <GitBranch className="h-4 w-4 text-primary opacity-60"/>}
                                                            </div>
                                                            <div>
                                                                <span className="font-black text-lg text-[#1e1b4b]">{item.name}</span>
                                                                {selectedSecondaryId && (
                                                                    <div className="flex gap-2 mt-0.5">
                                                                        <Badge variant="secondary" className="text-[8px] h-4 font-black">
                                                                            {item.trackingType === 'duration' ? `زمني: ${item.expectedDurationDays} يوم` : 
                                                                             item.trackingType === 'occurrence' ? `عددي: ${item.maxOccurrences} مرات` : 
                                                                             item.trackingType === 'hybrid' ? `هجين: ${item.expectedDurationDays}ي / ${item.maxOccurrences}م` :
                                                                             'معيار نصوص'}
                                                                        </Badge>
                                                                        {item.nextStageIds && item.nextStageIds.length > 0 && (
                                                                            <Badge variant="outline" className="text-[8px] h-4 font-bold border-indigo-200 text-indigo-700 bg-indigo-50">
                                                                                بعدها: {item.nextStageIds.length} مراحل
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            {view === 'transactions' && !selectedSecondaryId && (
                                                                <Button variant="outline" className="rounded-xl border-dashed border-primary/50 text-primary font-black gap-2 h-9 px-4 text-xs" onClick={() => setSelectedSecondaryId(item.id)}>
                                                                    <Workflow className="h-3 w-3"/> مسار الـ WBS
                                                                </Button>
                                                            )}
                                                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl border-2 border-primary/10 bg-white hover:bg-primary hover:text-white" onClick={() => { 
                                                                setEditingItem(item); 
                                                                setItemName(item.name); 
                                                                if(selectedSecondaryId) {
                                                                    setTrackingType(item.trackingType || 'duration');
                                                                    setExpectedDuration(String(item.expectedDurationDays || '7'));
                                                                    setMaxOccurrences(String(item.maxOccurrences || '3'));
                                                                    setNextStageIds(item.nextStageIds || []);
                                                                    setIsTertiaryDialogOpen(true);
                                                                } else {
                                                                    setIsSecondaryDialogOpen(true); 
                                                                }
                                                            }}><Pencil className="h-4 w-4"/></Button>
                                                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl border-2 border-red-100 bg-white text-red-600 hover:bg-red-600 hover:text-white" onClick={() => { setItemToDelete({ id: item.id, name: item.name, target: selectedSecondaryId ? 'tertiary' : 'secondary' }); setIsDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4"/></Button>
                                                        </div>
                                                    </div>
                                                </SortableRefListItem>
                                            ))}
                                        </div>
                                    </SortableContext>
                                </DndContext>
                                )}
                            </ScrollArea>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
                            <div className="p-12 bg-primary/5 rounded-full mb-8">
                                {view === 'transactions' ? <Workflow className="h-24 w-24 text-primary opacity-20" /> : <ListTree className="h-24 w-24 text-primary opacity-20" />}
                            </div>
                            <h3 className="text-3xl font-black text-[#1e1b4b] tracking-tighter">اختر تصنيفاً للبدء بالتحرير.</h3>
                        </div>
                    )}
                </Card>
            </div>

            <Dialog open={isPrimaryDialogOpen || isSecondaryDialogOpen || isTertiaryDialogOpen} onOpenChange={closeDialog}>
                <DialogContent dir="rtl" className="max-w-xl rounded-[2.5rem] p-0 shadow-2xl border-none bg-white overflow-hidden">
                    <form onSubmit={(e) => { e.preventDefault(); handleSave(isPrimaryDialogOpen ? 'primary' : isSecondaryDialogOpen ? 'secondary' : 'tertiary'); }}>
                        <DialogHeader className="p-8 bg-primary/5 border-b">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner"><PlusCircle className="h-8 w-8"/></div>
                                <DialogTitle className="text-2xl font-black text-[#1e1b4b]">{editingItem ? 'تعديل السجل' : 'إضافة سجل جديد'}</DialogTitle>
                            </div>
                        </DialogHeader>
                        
                        <div className="p-8 space-y-6">
                            <div className="grid gap-2">
                                <Label className="font-black text-[#1e1b4b] pr-2 text-xs uppercase">الاسم المعتمد *</Label>
                                <Input value={itemName} onChange={e => setItemName(e.target.value)} required className="h-12 rounded-xl border-2 font-black text-lg bg-slate-50 focus:bg-white transition-all shadow-inner" placeholder="اكتب هنا..." />
                            </div>

                            {view === 'transactions' && isPrimaryDialogOpen && (
                                <div className="grid gap-3 animate-in fade-in">
                                    <Label className="font-black text-[#1e1b4b] pr-2 text-xs">الأقسام الفنية المنفذة (الإسناد الذكي)</Label>
                                    <MultiSelect options={departmentOptions} selected={selectedDeptIds} onChange={setSelectedDeptIds} placeholder="اختر الأقسام..." className="rounded-xl" />
                                </div>
                            )}

                            {isTertiaryDialogOpen && (
                                <div className="space-y-6 animate-in slide-in-from-top-4">
                                    <div className="grid gap-2">
                                        <Label className="font-black text-[#1e1b4b] pr-2 text-xs">نوع التتبع الرقابي</Label>
                                        <Select value={trackingType} onValueChange={(v: any) => setTrackingType(v)}>
                                            <SelectTrigger className="h-11 rounded-xl border-2 font-black"><SelectValue /></SelectTrigger>
                                            <SelectContent dir="rtl">
                                                <SelectItem value="duration">تتبع زمني (أيام عمل)</SelectItem>
                                                <SelectItem value="occurrence">تتبع عددي (مرات حدوث)</SelectItem>
                                                <SelectItem value="hybrid">مسار هجين (زمن + تكرار)</SelectItem>
                                                <SelectItem value="none">معيار نصوص فقط</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    
                                    <div className="grid gap-2 p-5 bg-indigo-50/50 rounded-2xl border-2 border-dashed border-indigo-200">
                                        <Label className="font-black text-indigo-700 pr-2 text-xs uppercase flex items-center gap-2">
                                            <Workflow className="h-4 w-4" /> مراحل الاستكمال التلقائية (تفتح معاً)
                                        </Label>
                                        <MultiSelect 
                                            options={nextStageOptions}
                                            selected={nextStageIds}
                                            onChange={setNextStageIds}
                                            placeholder="اختر المرحلة أو المراحل التي ستفتح بعدها..."
                                            className="bg-white"
                                        />
                                        <p className="text-[9px] text-indigo-500 font-bold pr-1">سيقوم النظام بتفعيل كافة المراحل المختارة آلياً فور إنجاز المرحلة الحالية.</p>
                                    </div>

                                    {(trackingType === 'duration' || trackingType === 'hybrid') && (
                                        <div className="grid gap-2 animate-in zoom-in-95">
                                            <Label className="font-black text-blue-700 pr-2 text-xs">المدة المتوقعة للإنجاز (يوم عمل) *</Label>
                                            <Input type="number" value={expectedDuration} onChange={e => setExpectedDuration(e.target.value)} className="h-11 rounded-xl border-2 font-mono font-black text-xl text-center text-blue-600 bg-blue-50/30" />
                                        </div>
                                    )}

                                    {(trackingType === 'occurrence' || trackingType === 'hybrid') && (
                                        <div className="grid gap-2 animate-in zoom-in-95">
                                            <Label className="font-black text-orange-700 pr-2 text-xs">الحد الأقصى للتعديلات / الحدوث (مرات) *</Label>
                                            <Input type="number" value={maxOccurrences} onChange={e => setMaxOccurrences(e.target.value)} className="h-11 rounded-xl border-2 font-mono font-black text-xl text-center text-orange-600 bg-orange-50/30" />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <DialogFooter className="p-8 bg-muted/10 border-t flex gap-3">
                            <Button type="button" variant="outline" onClick={closeDialog} className="rounded-xl font-bold h-12 px-8">إلغاء</Button>
                            <Button type="submit" disabled={isSaving} className="rounded-xl font-black h-12 px-12 shadow-xl shadow-primary/30 min-w-[200px]">
                                {isSaving ? <Loader2 className="h-5 w-5 animate-spin"/> : <Save className="ml-2 h-5 w-5"/>} اعتماد الحفظ
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent dir="rtl" className="rounded-[2.5rem] border-none shadow-2xl p-10">
                    <AlertDialogHeader>
                        <div className="p-4 bg-red-100 text-red-600 rounded-2xl w-fit mb-4 shadow-inner"><Trash2 className="h-10 w-10"/></div>
                        <AlertDialogTitle className="text-2xl font-black text-red-700 tracking-tighter">تأكيد الحذف المعتمد؟</AlertDialogTitle>
                        <AlertDialogDescription className="text-lg font-bold text-slate-600 leading-relaxed mt-2">سيتم مسح سجل <strong className="text-red-900">"{itemToDelete?.name}"</strong> نهائياً من كافة عروق المنظومة.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-8 gap-3">
                        <AlertDialogCancel className="rounded-xl font-black h-12 px-8 border-2">تراجع</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={isSaving} className="bg-red-600 hover:bg-red-700 rounded-xl font-black h-12 px-12 shadow-xl shadow-red-200">
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin h-5 w-5"/> : 'نعم، تأكيد الحذف النهائي'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={isImportConfirmOpen} onOpenChange={setIsImportConfirmOpen}>
                <AlertDialogContent dir="rtl" className="rounded-[2.5rem] border-none shadow-2xl p-10">
                    <AlertDialogHeader>
                        <div className="p-4 bg-primary/10 text-primary rounded-2xl w-fit mb-4 shadow-inner"><DownloadCloud className="h-10 w-10"/></div>
                        <AlertDialogTitle className="text-2xl font-black text-[#1e1b4b] tracking-tighter">تأكيد استيراد القوالب الموحدة؟</AlertDialogTitle>
                        <AlertDialogDescription className="text-lg font-bold text-slate-500 leading-relaxed mt-2">سيقوم هذا الإجراء بإضافة الأقسام، الوظائف، ومراحل العمل المعتمدة رسمياً لضمان توافق النظام.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-8 gap-3">
                        <AlertDialogCancel className="rounded-xl font-black h-12 px-8 border-2">تراجع</AlertDialogCancel>
                        <AlertDialogAction onClick={handleImportDefaults} disabled={isImporting} className="rounded-xl font-black h-12 px-12 shadow-xl shadow-primary/30">
                            {isImporting ? <Loader2 className="h-5 w-5 animate-spin h-5 w-5"/> : 'نعم، ابدأ الاستيراد الموحد'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

