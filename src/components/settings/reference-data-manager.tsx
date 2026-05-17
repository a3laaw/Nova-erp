'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useFirebase } from '@/firebase';
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
import { Badge } from '@/components/ui/badge';
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
    DownloadCloud, Building2, Globe, Workflow, 
    ArrowRight, ListTree, Settings2,
    MapPin, X, Layers, Activity, GripVertical,
    Sparkles,
    Briefcase,
    Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn, cleanFirestoreData, getTenantPath } from '@/lib/utils';
import { defaultDepartments, defaultGovernorates } from '@/lib/default-reference-data';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useSubscription } from '@/hooks/use-subscription';

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
            "group relative flex items-center justify-between p-5 rounded-[2.2rem] cursor-default transition-all border-2 mb-3",
            isActive 
              ? "bg-primary border-primary text-white shadow-2xl scale-[1.02] ring-8 ring-orange-500/10" 
              : "bg-white/60 hover:bg-white hover:border-primary/20 border-transparent shadow-sm"
        )}
    >
        <div className="flex items-center gap-5 flex-1">
            <button 
                {...attributes} 
                {...listeners} 
                className="cursor-grab active:cursor-grabbing p-2 rounded-xl hover:bg-primary/10 transition-colors"
                type="button"
            >
                <GripVertical className={cn("h-5 w-5", isActive ? "text-white" : "text-primary opacity-30 group-hover:opacity-100")} />
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
    const [activeSubTab, setActiveSubTab] = useState<'jobs' | 'stages' | 'areas' | 'subServices'>('jobs');
    
    const [selectedPrimaryId, setSelectedPrimaryId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    
    const [isPrimaryDialogOpen, setIsPrimaryDialogOpen] = useState(false);
    const [isSecondaryDialogOpen, setIsSecondaryDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);
    
    const [editingItem, setEditingItem] = useState<any | null>(null);
    const [itemToDelete, setItemToDelete] = useState<any | null>(null);
    const [itemName, setItemName] = useState('');

    const tenantId = currentUser?.currentCompanyId;

    const sensors = useSensors(
      useSensor(PointerSensor),
      useSensor(KeyboardSensor, {
        coordinateGetter: sortableKeyboardCoordinates,
      })
    );

    const closeDialog = useCallback(() => {
        setIsPrimaryDialogOpen(false);
        setIsSecondaryDialogOpen(false);
        setEditingItem(null);
        setItemName('');
    }, []);

    const primaryCollectionName = useMemo(() => {
        if (view === 'departments') return 'departments';
        if (view === 'locations') return 'governorates';
        if (view === 'transactions') return 'transactionTypes';
        return '';
    }, [view]);

    const secondaryCollectionName = useMemo(() => {
        if (view === 'departments') return activeSubTab === 'jobs' ? 'jobs' : 'workStages';
        if (view === 'locations') return 'areas';
        if (view === 'transactions') return 'subServices';
        return '';
    }, [view, activeSubTab]);

    const { data: rawPrimaryItems = [], loading: loadingPrimary } = useSubscription<any>(firestore, primaryCollectionName || null);
    
    const secondaryRelativePath = useMemo(() => {
        if (!selectedPrimaryId || !primaryCollectionName || !secondaryCollectionName) return null;
        return `${primaryCollectionName}/${selectedPrimaryId}/${secondaryCollectionName}`;
    }, [selectedPrimaryId, primaryCollectionName, secondaryCollectionName]);
    
    const { data: rawSecondaryItems = [], loading: loadingSecondary } = useSubscription<any>(firestore, secondaryRelativePath);

    const primaryItems = useMemo(() => {
        return [...rawPrimaryItems].sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name, 'ar'));
    }, [rawPrimaryItems]);

    const secondaryItems = useMemo(() => {
        return [...rawSecondaryItems].sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name, 'ar'));
    }, [rawSecondaryItems]);

    const selectedPrimary = useMemo(() => (primaryItems || []).find(i => i.id === selectedPrimaryId), [primaryItems, selectedPrimaryId]);

    const handleDragEnd = async (event: DragEndEvent, type: 'primary' | 'secondary') => {
        const { active, over } = event;
        if (!over || active.id === over.id || !firestore || !tenantId) return;

        const list = type === 'primary' ? primaryItems : secondaryItems;
        const relativePath = type === 'primary' ? primaryCollectionName : secondaryRelativePath;
        if (!relativePath) return;

        const oldIndex = list.findIndex((item) => item.id === active.id);
        const newIndex = list.findIndex((item) => item.id === over.id);

        const newOrderedList = arrayMove(list, oldIndex, newIndex);
        
        setIsSaving(true);
        try {
            const batch = writeBatch(firestore);
            const finalPath = getTenantPath(relativePath, tenantId);

            newOrderedList.forEach((item, idx) => {
                const itemRef = doc(firestore, finalPath, item.id);
                batch.update(itemRef, { order: idx });
            });

            await batch.commit();
            toast({ title: 'تم حفظ الترتيب' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'فشل الحفظ' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSave = async (type: 'primary' | 'secondary') => {
        if (!firestore || !itemName.trim() || !tenantId) return;

        const relativePath = type === 'primary' ? primaryCollectionName : secondaryRelativePath;
        if (!relativePath) return;

        setIsSaving(true);
        try {
            const finalPath = getTenantPath(relativePath, tenantId);
            const currentList = type === 'primary' ? primaryItems : secondaryItems;
            
            const payload: any = { 
                name: itemName, 
                updatedAt: serverTimestamp(),
                companyId: tenantId
            };

            if (type === 'secondary' && selectedPrimaryId) {
                payload.parentId = selectedPrimaryId;
            }

            if (editingItem) {
                await updateDoc(doc(firestore, finalPath, editingItem.id), cleanFirestoreData(payload));
            } else {
                payload.order = currentList.length;
                await addDoc(collection(firestore, finalPath), { ...payload, createdAt: serverTimestamp() });
            }
            
            toast({ title: 'تم الحفظ بنجاح' });
            closeDialog();
        } catch (e: any) { 
            toast({ variant: 'destructive', title: 'فشل الحفظ' }); 
        } finally { 
            setIsSaving(false); 
        }
    };

    const handleDelete = async () => {
        if (!firestore || !itemToDelete || !tenantId) return;
        const relativePath = itemToDelete.target === 'primary' ? primaryCollectionName : secondaryRelativePath;
        if (!relativePath) return;

        setIsSaving(true);
        try {
            const finalPath = getTenantPath(relativePath, tenantId);
            await deleteDoc(doc(firestore, finalPath, itemToDelete.id));
            toast({ title: 'تم الحذف' });
            setIsDeleteDialogOpen(false); 
            setItemToDelete(null);
        } catch (e) { toast({ variant: 'destructive', title: 'فشل الحذف' }); } finally { setIsSaving(false); }
    };

    const handleImportDefaults = async () => {
        if (!firestore || !tenantId) return;
        setIsImporting(true);
        try {
            const batch = writeBatch(firestore);
            const finalPrimaryPath = getTenantPath(primaryCollectionName, tenantId);
            
            if (view === 'departments') {
                defaultDepartments.forEach((d, idx) => {
                    const newDocRef = doc(collection(firestore, finalPrimaryPath));
                    batch.set(newDocRef, { ...d, order: idx, companyId: tenantId, createdAt: serverTimestamp() });
                });
            } else if (view === 'locations') {
                defaultGovernorates.forEach((g, idx) => {
                    const newDocRef = doc(collection(firestore, finalPrimaryPath));
                    batch.set(newDocRef, { ...g, order: idx, companyId: tenantId, createdAt: serverTimestamp() });
                });
            }
            await batch.commit();
            toast({ title: 'تم الاستيراد بنجاح' });
            setIsImportConfirmOpen(false);
        } catch (e) { toast({ variant: 'destructive', title: 'فشل الاستيراد' }); } finally { setIsImporting(false); }
    };

    if (view === 'main') {
        return (
            <div className="space-y-12" dir="rtl">
                <Card className="rounded-[3.5rem] border-none shadow-2xl overflow-hidden bg-gradient-to-l from-white to-orange-50/50 backdrop-blur-3xl border-white/60">
                    <CardHeader className="p-12 pb-10 border-b border-primary/10">
                        <div className="flex items-center gap-6">
                            <div className="p-5 bg-primary/10 rounded-[2.2rem] text-primary shadow-inner border border-primary/20">
                                <Settings2 className="h-12 w-12" />
                            </div>
                            <div className="space-y-1">
                                <CardTitle className="text-4xl font-black text-[#1e1b4b] tracking-tighter">إعدادات القوائم والبيانات</CardTitle>
                                <CardDescription className="text-xl font-bold text-slate-500">تخصيص الأقسام، المواقع، وهيكل الخدمات المرجعي.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 px-2">
                    <SummaryCard 
                        title="الأقسام والوظائف" 
                        count={primaryItems?.length || 0} 
                        icon={<Building2 className="h-10 w-10"/>} 
                        onNavigate={() => { setView('departments'); setActiveSubTab('jobs'); }} 
                        colorClass="bg-blue-600/10 text-blue-600" 
                        loading={loadingPrimary} 
                        description="إدارة الهيكل التنظيمي والوظائف ومراحل العمل." 
                    />
                    <SummaryCard 
                        title="المناطق والمواقع" 
                        count={primaryItems?.length || 0} 
                        icon={<MapPin className="h-10 w-10"/>} 
                        onNavigate={() => { setView('locations'); setActiveSubTab('areas'); }} 
                        colorClass="bg-emerald-600/10 text-emerald-600" 
                        loading={loadingPrimary} 
                        description="إدارة المحافظات والمناطق الجغرافية." 
                    />
                    <SummaryCard 
                        title="أنواع الخدمات" 
                        count={primaryItems?.length || 0} 
                        icon={<Workflow className="h-10 w-10"/>} 
                        onNavigate={() => { setView('transactions'); setActiveSubTab('subServices'); setSelectedPrimaryId(null); }} 
                        colorClass="bg-orange-600/10 text-primary" 
                        loading={loadingPrimary} 
                        description="قائمة المعاملات والخدمات المتاحة في النظام." 
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-[3.5rem] border-none shadow-2xl overflow-hidden glass-effect border-white/60">
                <CardHeader className="p-10 bg-primary text-white relative">
                    <div className="absolute top-0 right-0 w-80 h-full bg-white/10 -skew-x-12 transform translate-x-32" />
                    <div className="flex flex-col md:flex-row justify-between items-center gap-8 relative z-10">
                        <div className="flex items-center gap-6">
                            <div className="p-5 bg-white/20 rounded-[2rem] backdrop-blur-xl border border-white/40 shadow-2xl">
                                {view === 'departments' ? <Building2 className="h-10 w-10" /> : view === 'locations' ? <MapPin className="h-10 w-10" /> : <Workflow className="h-10 w-10" />}
                            </div>
                            <div className="text-right">
                                <CardTitle className="text-3xl font-black tracking-tighter text-white">
                                    {view === 'departments' ? 'إدارة الأقسام والوظائف' : view === 'locations' ? 'إدارة المواقع الجغرافية' : 'إدارة أنواع الخدمات'}
                                </CardTitle>
                                <div className="flex items-center gap-2 mt-2">
                                    <Sparkles className="h-4 w-4 text-amber-200 animate-pulse" />
                                    <CardDescription className="text-white/90 font-black text-sm uppercase tracking-widest">قم بسحب وإفلات العناصر لترتيبها.</CardDescription>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            {view !== 'transactions' && (
                                <Button variant="secondary" onClick={() => setIsImportConfirmOpen(true)} className="bg-white/90 hover:bg-white text-primary rounded-2xl font-black h-12 px-8 gap-3 shadow-xl transition-all active:scale-95">
                                    <DownloadCloud className="h-5 w-5"/> استيراد افتراضي
                                </Button>
                            )}
                            <Button onClick={() => setView('main')} variant="outline" className="text-white border-white/40 hover:bg-white/10 rounded-2xl font-black h-12 px-8 gap-2 backdrop-blur-md">
                                <X className="h-5 w-5" /> إغلاق
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="grid grid-cols-1 md:grid-cols-12 min-h-[650px]">
                        <div className="md:col-span-4 border-l-2 border-primary/5 bg-slate-50/20 flex flex-col">
                            <div className="p-10 border-b bg-primary/5 flex justify-between items-center">
                                <div className="space-y-0.5">
                                    <Label className="font-black text-[#1e1b4b] text-xl tracking-tight">القائمة الرئيسية</Label>
                                </div>
                                <Button onClick={() => { setEditingItem(null); setItemName(''); setIsPrimaryDialogOpen(true); }} className="h-12 w-12 rounded-[1.5rem] shadow-xl shadow-primary/20"><Plus className="h-6 w-6" /></Button>
                            </div>
                            <ScrollArea className="flex-1 p-8">
                                {loadingPrimary ? <div className="space-y-4"><Skeleton className="h-16 w-full rounded-[1.8rem]"/><Skeleton className="h-16 w-full rounded-[1.8rem]"/></div> : 
                                primaryItems.length === 0 ? <p className="text-center p-20 text-muted-foreground italic font-black opacity-20">لا توجد سجلات.</p> :
                                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, 'primary')}>
                                    <SortableContext items={primaryItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                                        <div className="space-y-3">
                                            {primaryItems.map(item => (
                                                <SortableRefListItem key={item.id} id={item.id} isActive={selectedPrimaryId === item.id}>
                                                    <div className="flex items-center justify-between flex-1" onClick={() => setSelectedPrimaryId(item.id)}>
                                                        <span className="font-black text-base truncate pr-2">{item.name}</span>
                                                        <div className={cn("flex gap-1.5 transition-all", selectedPrimaryId === item.id ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
                                                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-white/30 text-current" onClick={(e) => { e.stopPropagation(); setEditingItem(item); setItemName(item.name); setIsPrimaryDialogOpen(true); }}><Pencil className="h-4 w-4"/></Button>
                                                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-red-500/20 text-current" onClick={(e) => { e.stopPropagation(); setItemToDelete({ id: item.id, name: item.name, target: 'primary' }); setIsDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4"/></Button>
                                                        </div>
                                                    </div>
                                                </SortableRefListItem>
                                            ))}
                                        </div>
                                    </SortableContext>
                                </DndContext>}
                            </ScrollArea>
                        </div>

                        <div className="md:col-span-8 flex flex-col bg-white/40 backdrop-blur-md">
                            {selectedPrimaryId ? (
                                <>
                                    <div className="p-10 border-b bg-muted/5">
                                        <div className="flex justify-between items-center mb-8">
                                            <div className="flex items-center gap-5">
                                                <div className="p-4 bg-white rounded-[1.5rem] shadow-xl border border-primary/10">
                                                    {view === 'transactions' ? <Zap className="h-8 w-8 text-primary"/> : <ListTree className="h-8 w-8 text-primary"/>}
                                                </div>
                                                <div className="space-y-1">
                                                    <h3 className="text-3xl font-black text-[#1e1b4b] tracking-tighter">{selectedPrimary?.name}</h3>
                                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">إدارة البنود الفرعية</p>
                                                </div>
                                            </div>
                                            <Button onClick={() => { setEditingItem(null); setItemName(''); setIsSecondaryDialogOpen(true); }} className="rounded-2xl font-black h-14 px-10 shadow-2xl shadow-primary/20 gap-3 glass-3d-button">
                                                <PlusCircle className="h-6 w-6" /> إضافة بند جديد
                                            </Button>
                                        </div>
                                        {view === 'departments' && (
                                            <div className="flex bg-white/60 p-1.5 rounded-[1.5rem] border border-primary/10 w-fit shadow-inner">
                                                <Button variant={activeSubTab === 'jobs' ? 'secondary' : 'ghost'} size="sm" onClick={() => setActiveSubTab('jobs')} className="rounded-xl px-10 font-black text-xs h-11 transition-all">الوظائف والمهن</Button>
                                                <Button variant={activeSubTab === 'stages' ? 'secondary' : 'ghost'} size="sm" onClick={() => setActiveSubTab('stages')} className="rounded-xl px-10 font-black text-xs h-11 transition-all">مراحل العمل</Button>
                                            </div>
                                        )}
                                    </div>
                                    <ScrollArea className="flex-1 p-10">
                                        {loadingSecondary ? <div className="space-y-4"><Skeleton className="h-16 w-full rounded-[1.8rem]"/><Skeleton className="h-16 w-full rounded-[1.8rem]"/></div> :
                                        secondaryItems.length === 0 ? (
                                            <div className="h-96 flex flex-col items-center justify-center grayscale opacity-10 border-4 border-dashed rounded-[3.5rem] border-primary/5 m-8">
                                                <PlusCircle className="h-24 w-24 mb-6 text-primary animate-pulse"/>
                                                <p className="font-black text-3xl">لا توجد بيانات فرعية.</p>
                                            </div>
                                        ) : (
                                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, 'secondary')}>
                                            <SortableContext items={secondaryItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                                                <div className="grid grid-cols-1 gap-4">
                                                    {secondaryItems.map(item => (
                                                        <SortableRefListItem key={item.id} id={item.id}>
                                                            <div className="flex items-center justify-between flex-1">
                                                                <div className="flex items-center gap-6">
                                                                    <div className="p-3.5 bg-primary/5 rounded-[1.2rem] border border-primary/10 shadow-inner"><Activity className="h-5 w-5 text-primary opacity-60"/></div>
                                                                    <span className="font-black text-xl text-[#1e1b4b] tracking-tight">{item.name}</span>
                                                                </div>
                                                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                                    <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl border-2 border-primary/10 bg-white hover:bg-primary hover:text-white shadow-sm" onClick={() => { setEditingItem(item); setItemName(item.name); setIsSecondaryDialogOpen(true); }}><Pencil className="h-6 w-6"/></Button>
                                                                    <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl border-2 border-red-100 bg-white text-red-600 hover:bg-red-600 hover:text-white shadow-sm" onClick={() => { setItemToDelete({ id: item.id, name: item.name, target: 'secondary' }); setIsDeleteDialogOpen(true); }}><Trash2 className="h-6 w-6"/></Button>
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
                                    <div className="p-16 bg-gradient-to-b from-primary/10 to-transparent rounded-full mb-10 relative">
                                        <Layers className="h-40 w-40 text-primary/5 animate-pulse" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            {view === 'transactions' ? <Zap className="h-16 w-16 text-primary opacity-30" /> : <ListTree className="h-16 w-16 text-primary opacity-30" />}
                                        </div>
                                    </div>
                                    <h3 className="text-4xl font-black text-[#1e1b4b] tracking-tighter max-w-md leading-tight">
                                        اختر تصنيفاً من القائمة لعرض وتعديل بياناته
                                    </h3>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isPrimaryDialogOpen || isSecondaryDialogOpen} onOpenChange={closeDialog}>
                <DialogContent dir="rtl" className="max-w-md rounded-[3rem] p-10 shadow-2xl border-none bg-white/95 backdrop-blur-2xl">
                    <form onSubmit={(e) => { e.preventDefault(); handleSave(isPrimaryDialogOpen ? 'primary' : 'secondary'); }}>
                        <DialogHeader>
                            <div className="p-4 bg-primary/10 rounded-[1.8rem] text-primary w-fit mb-6 shadow-inner"><PlusCircle className="h-10 w-10"/></div>
                            <DialogTitle className="text-3xl font-black text-[#1e1b4b] tracking-tighter">{editingItem ? 'تعديل السجل' : 'إضافة سجل جديد'}</DialogTitle>
                        </DialogHeader>
                        <div className="py-10">
                            <Label className="font-black text-[#1e1b4b] pr-3 block mb-4 text-sm uppercase tracking-widest">الاسم المعتمد *</Label>
                            <Input value={itemName} onChange={e => setItemName(e.target.value)} required className="h-16 rounded-[1.5rem] border-2 text-2xl font-black text-primary bg-slate-50/50 focus:bg-white shadow-inner transition-all" placeholder="اكتب هنا..." />
                        </div>
                        <DialogFooter className="gap-4 pt-6 border-t">
                            <Button type="button" variant="ghost" onClick={closeDialog} className="rounded-2xl font-black h-12 px-10">إلغاء</Button>
                            <Button type="submit" disabled={isSaving} className="rounded-2xl font-black h-12 px-16 shadow-2xl shadow-primary/30 min-w-[200px] glass-3d-button">
                                {isSaving ? <Loader2 className="h-5 w-5 animate-spin"/> : <Save className="ml-2 h-5 w-5"/>} حفظ
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent dir="rtl" className="rounded-[3rem] border-none shadow-2xl p-12 glass-effect">
                    <AlertDialogHeader>
                        <div className="p-5 bg-red-100 text-red-600 rounded-[1.8rem] w-fit mb-6 shadow-inner"><Trash2 className="h-12 w-12"/></div>
                        <AlertDialogTitle className="text-3xl font-black text-red-700 tracking-tighter">تأكيد الحذف؟</AlertDialogTitle>
                        <AlertDialogDescription className="text-xl font-bold text-slate-600 leading-relaxed mt-4">سيتم مسح سجل <strong className="text-red-900">"{itemToDelete?.name}"</strong> نهائياً من النظام.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-10 gap-4">
                        <AlertDialogCancel className="rounded-2xl font-black h-12 px-10 border-2">تراجع</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={isSaving} className="bg-red-600 hover:bg-red-700 rounded-2xl font-black h-12 px-16 shadow-xl shadow-red-200">
                            {isSaving ? <Loader2 className="h-5 w-5 animate-spin"/> : 'نعم، تأكيد الحذف'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={isImportConfirmOpen} onOpenChange={setIsImportConfirmOpen}>
                <AlertDialogContent dir="rtl" className="rounded-[3rem] border-none shadow-2xl p-12">
                    <AlertDialogHeader>
                        <div className="p-5 bg-primary/10 text-primary rounded-[1.8rem] w-fit mb-6 shadow-inner"><DownloadCloud className="h-12 w-12"/></div>
                        <AlertDialogTitle className="text-3xl font-black text-[#1e1b4b] tracking-tighter">تأكيد استيراد القوالب؟</AlertDialogTitle>
                        <AlertDialogDescription className="text-lg font-bold text-slate-500 leading-relaxed mt-4">سيقوم هذا الإجراء بإضافة الأقسام والوظائف والمدن الافتراضية آلياً.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-10 gap-4">
                        <AlertDialogCancel className="rounded-2xl font-black h-12 px-10 border-2">تراجع</AlertDialogCancel>
                        <AlertDialogAction onClick={handleImportDefaults} disabled={isImporting} className="rounded-2xl font-black h-12 px-16 shadow-2xl shadow-primary/30">
                            {isImporting ? <Loader2 className="h-5 w-5 animate-spin"/> : 'نعم، ابدأ الاستيراد'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
