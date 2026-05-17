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
    Sparkles
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn, cleanFirestoreData, getTenantPath } from '@/lib/utils';
import { defaultDepartments, defaultGovernorates } from '@/lib/default-reference-data';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useSubscription } from '@/hooks/use-subscription';

// --- 🛡️ التصحيح الجذري لمصفوفة السحب والإفلات (dnd-kit) ---
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
              ? "bg-primary border-primary text-white shadow-xl scale-[1.02]" 
              : "bg-white/60 hover:bg-white hover:border-primary/20 border-transparent shadow-sm"
        )}
    >
        <div className="flex items-center gap-4 flex-1">
            <button 
                {...attributes} 
                {...listeners} 
                className="cursor-grab active:cursor-grabbing p-1.5 rounded-xl hover:bg-primary/10 transition-colors"
                type="button"
            >
                <GripVertical className={cn("h-5 w-5", isActive ? "text-white" : "text-primary opacity-30 group-hover:opacity-100")} />
            </button>
            {children}
        </div>
    </div>
  );
}

function StatCard({ title, count, icon, onNavigate, colorClass, loading, description }: { title: string, count: number, icon: React.ReactNode, onNavigate: () => void, colorClass: string, loading: boolean, description: string }) {
    return (
        <Card 
            onClick={onNavigate} 
            className="group cursor-pointer border-none shadow-lg rounded-[2.5rem] bg-white/40 backdrop-blur-xl hover-lift overflow-hidden relative"
        >
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-primary/10 transition-all duration-700" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                <CardTitle className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{title}</CardTitle>
                <div className={cn("p-3 rounded-[1.2rem] transition-all shadow-inner group-hover:scale-110", colorClass)}>{icon}</div>
            </CardHeader>
            <CardContent className="relative z-10">
                {loading ? <Skeleton className="h-10 w-16 mt-1" /> : <div className="text-5xl font-black font-mono tracking-tighter text-[#1e1b4b]">{count}</div>}
                <p className="text-[11px] font-bold text-slate-500 mt-2">{description}</p>
                <div className="flex items-center gap-1 text-[10px] text-primary font-black mt-4 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0 uppercase tracking-widest">
                    ضبط الإعدادات <ArrowRight className="h-3 w-3"/>
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
    const [activeSubTab, setActiveSubTab] = useState<'jobs' | 'stages' | 'areas'>('jobs');
    
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
            toast({ title: 'تم تحديث الترتيب' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'فشل الترتيب' });
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

            if (editingItem) {
                await updateDoc(doc(firestore, finalPath, editingItem.id), cleanFirestoreData(payload));
            } else {
                payload.order = currentList.length;
                await addDoc(collection(firestore, finalPath), { ...payload, createdAt: serverTimestamp() });
            }
            
            toast({ title: 'نجاح الحفظ' });
            closeDialog();
        } catch (e: any) { 
            toast({ variant: 'destructive', title: 'فشل ترحيل البيانات' }); 
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
            toast({ title: 'تم الحذف بنجاح' });
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
            toast({ title: 'نجاح الاستيراد' });
            setIsImportConfirmOpen(false);
        } catch (e) { toast({ variant: 'destructive', title: 'خطأ في الاستيراد' }); } finally { setIsImporting(false); }
    };

    if (view === 'main') {
        return (
            <div className="space-y-10" dir="rtl">
                <Card className="rounded-[3rem] border-none shadow-xl overflow-hidden bg-gradient-to-l from-white to-orange-50/50 backdrop-blur-3xl">
                    <CardHeader className="pb-10 px-10 border-b border-primary/10">
                        <div className="flex items-center gap-5">
                            <div className="p-4 bg-primary/10 rounded-[1.8rem] text-primary shadow-inner">
                                <Settings2 className="h-10 w-10" />
                            </div>
                            <div className="space-y-1">
                                <CardTitle className="text-3xl font-black text-[#1e1b4b] tracking-tight">إعدادات القوائم السيادية</CardTitle>
                                <CardDescription className="text-lg font-bold text-slate-500">تخصيص الأقسام، المواقع، وهيكل الخدمات المرجعي للمكتب.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <StatCard 
                        title="الهيكل التنظيمي" 
                        count={primaryItems?.length || 0} 
                        icon={<Building2 className="h-8 w-8"/>} 
                        onNavigate={() => { setView('departments'); setActiveSubTab('jobs'); }} 
                        colorClass="bg-blue-600/10 text-blue-600" 
                        loading={loadingPrimary} 
                        description="الأقسام والوظائف ومراحل العمل" 
                    />
                    <StatCard 
                        title="رادار المواقع" 
                        count={primaryItems?.length || 0} 
                        icon={<MapPin className="h-8 w-8"/>} 
                        onNavigate={() => { setView('locations'); setActiveSubTab('areas'); }} 
                        colorClass="bg-emerald-600/10 text-emerald-600" 
                        loading={loadingPrimary} 
                        description="توزيع المحافظات والمناطق" 
                    />
                    <StatCard 
                        title="دليل الخدمات" 
                        count={primaryItems?.length || 0} 
                        icon={<Workflow className="h-8 w-8"/>} 
                        onNavigate={() => { setView('transactions'); setSelectedPrimaryId(null); }} 
                        colorClass="bg-orange-600/10 text-primary" 
                        loading={loadingPrimary} 
                        description="قائمة الطلبات والخدمات الهندسية" 
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden glass-effect border-white/20">
                <CardHeader className="p-8 bg-gradient-to-r from-primary to-orange-400 text-white relative">
                    <div className="absolute top-0 right-0 w-64 h-full bg-white/10 -skew-x-12 transform translate-x-20" />
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6 relative z-10">
                        <div className="flex items-center gap-5">
                            <div className="p-4 bg-white/20 rounded-[1.8rem] backdrop-blur-md border border-white/30 shadow-xl">
                                {view === 'departments' ? <Building2 className="h-8 w-8" /> : view === 'locations' ? <MapPin className="h-8 w-8" /> : <Workflow className="h-8 w-8" />}
                            </div>
                            <div className="text-right">
                                <CardTitle className="text-3xl font-black tracking-tight">
                                    {view === 'departments' ? 'إدارة الأقسام والوظائف' : view === 'locations' ? 'تخصيص المواقع الجغرافية' : 'إدارة أنواع الخدمات'}
                                </CardTitle>
                                <div className="flex items-center gap-2 mt-1">
                                    <Sparkles className="h-3 w-3 text-amber-200 animate-pulse" />
                                    <CardDescription className="text-white/80 font-bold text-sm">قم بالسحب والإفلات لترتيب أولويات العرض في النظام.</CardDescription>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            {view !== 'transactions' && (
                                <Button variant="secondary" onClick={() => setIsImportConfirmOpen(true)} className="bg-white/90 hover:bg-white text-primary rounded-2xl font-black h-11 px-6 gap-2 shadow-lg">
                                    <DownloadCloud className="h-4 w-4"/> استيراد القوالب
                                </Button>
                            )}
                            <Button onClick={() => setView('main')} variant="outline" className="text-white border-white/40 hover:bg-white/10 rounded-2xl font-black h-11 px-6 gap-2">
                                <X className="h-4 w-4" /> إغلاق
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="grid grid-cols-1 md:grid-cols-12 min-h-[600px]">
                        {/* القائمة اليمنى - التصنيفات الرئيسية */}
                        <div className="md:col-span-4 border-l border-primary/5 bg-slate-50/30 flex flex-col">
                            <div className="p-8 border-b bg-primary/5 flex justify-between items-center">
                                <div className="space-y-0.5">
                                    <Label className="font-black text-[#1e1b4b] text-base">القائمة الرئيسية</Label>
                                    <p className="text-[10px] font-bold text-slate-400">تحكم بالهيكل الأساسي</p>
                                </div>
                                <Button size="icon" onClick={() => { setEditingItem(null); setItemName(''); setIsPrimaryDialogOpen(true); }} className="h-10 w-10 rounded-[1.2rem] shadow-lg shadow-primary/20"><Plus className="h-5 w-5" /></Button>
                            </div>
                            <ScrollArea className="flex-1 p-6">
                                {loadingPrimary ? <div className="space-y-3"><Skeleton className="h-14 w-full rounded-2xl"/><Skeleton className="h-14 w-full rounded-2xl"/></div> : 
                                primaryItems.length === 0 ? <p className="text-center p-20 text-muted-foreground italic font-bold opacity-30">لا توجد سجلات.</p> :
                                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, 'primary')}>
                                    <SortableContext items={primaryItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                                        <div className="space-y-2">
                                            {primaryItems.map(item => (
                                                <SortableRefListItem key={item.id} id={item.id} isActive={selectedPrimaryId === item.id}>
                                                    <div className="flex items-center justify-between flex-1" onClick={() => setSelectedPrimaryId(item.id)}>
                                                        <span className="font-black text-sm truncate">{item.name}</span>
                                                        <div className={cn("flex gap-1.5 transition-all", selectedPrimaryId === item.id ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-white/20 text-current" onClick={(e) => { e.stopPropagation(); setEditingItem(item); setItemName(item.name); setIsPrimaryDialogOpen(true); }}><Pencil className="h-3.5 w-3.5"/></Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-red-100/20 text-current" onClick={(e) => { e.stopPropagation(); setItemToDelete({ id: item.id, name: item.name, target: 'primary' }); setIsDeleteDialogOpen(true); }}><Trash2 className="h-3.5 w-3.5"/></Button>
                                                        </div>
                                                    </div>
                                                </SortableRefListItem>
                                            ))}
                                        </div>
                                    </SortableContext>
                                </DndContext>}
                            </ScrollArea>
                        </div>

                        {/* القائمة اليسرى - التفاصيل */}
                        <div className="md:col-span-8 flex flex-col bg-white/50">
                            {selectedPrimaryId && view !== 'transactions' ? (
                                <>
                                    <div className="p-8 border-b bg-muted/10">
                                        <div className="flex justify-between items-center mb-6">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 bg-white rounded-2xl shadow-sm border border-primary/10"><ListTree className="h-6 w-6 text-primary"/></div>
                                                <div>
                                                    <h3 className="text-2xl font-black text-[#1e1b4b]">{selectedPrimary?.name}</h3>
                                                    <p className="text-xs font-bold text-slate-400">إدارة القوائم الفرعية والمحتوى</p>
                                                </div>
                                            </div>
                                            <Button onClick={() => { setEditingItem(null); setItemName(''); setIsSecondaryDialogOpen(true); }} className="rounded-2xl font-black h-12 px-8 shadow-xl shadow-primary/10 gap-2">
                                                <PlusCircle className="h-5 w-5" /> إضافة {activeSubTab === 'jobs' ? 'وظيفة' : activeSubTab === 'stages' ? 'مرحلة' : 'منطقة'}
                                            </Button>
                                        </div>
                                        {view === 'departments' && (
                                            <div className="flex bg-white/60 p-1.5 rounded-[1.2rem] border border-primary/5 w-fit shadow-inner">
                                                <Button variant={activeSubTab === 'jobs' ? 'secondary' : 'ghost'} size="sm" onClick={() => setActiveSubTab('jobs')} className="rounded-xl px-6 font-black text-xs h-9 transition-all">الوظائف والمهن</Button>
                                                <Button variant={activeSubTab === 'stages' ? 'secondary' : 'ghost'} size="sm" onClick={() => setActiveSubTab('stages')} className="rounded-xl px-6 font-black text-xs h-9 transition-all">مراحل سير العمل</Button>
                                            </div>
                                        )}
                                    </div>
                                    <ScrollArea className="flex-1 p-8">
                                        {loadingSecondary ? <div className="space-y-4"><Skeleton className="h-14 w-full rounded-2xl"/><Skeleton className="h-14 w-full rounded-2xl"/></div> :
                                        secondaryItems.length === 0 ? (
                                            <div className="h-80 flex flex-col items-center justify-center grayscale opacity-20 border-4 border-dashed rounded-[3rem] border-primary/5 m-4">
                                                <PlusCircle className="h-16 w-16 mb-4 text-primary animate-pulse"/>
                                                <p className="font-black text-xl">لا توجد بيانات فرعية.</p>
                                            </div>
                                        ) : (
                                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, 'secondary')}>
                                            <SortableContext items={secondaryItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                                                <div className="grid gap-3">
                                                    {secondaryItems.map(item => (
                                                        <SortableRefListItem key={item.id} id={item.id}>
                                                            <div className="flex items-center justify-between flex-1">
                                                                <div className="flex items-center gap-5">
                                                                    <div className="p-2.5 bg-primary/5 rounded-[1rem] border border-primary/10 shadow-sm"><Activity className="h-4 w-4 text-primary opacity-60"/></div>
                                                                    <span className="font-black text-lg text-[#1e1b4b]">{item.name}</span>
                                                                </div>
                                                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                                    <Button variant="ghost" size="icon" className="h-11 w-11 rounded-2xl border-2 border-primary/10 bg-white hover:bg-primary hover:text-white" onClick={() => { setEditingItem(item); setItemName(item.name); setIsSecondaryDialogOpen(true); }}><Pencil className="h-5 w-5"/></Button>
                                                                    <Button variant="ghost" size="icon" className="h-11 w-11 rounded-2xl border-2 border-red-100 bg-white text-red-600 hover:bg-red-600 hover:text-white" onClick={() => { setItemToDelete({ id: item.id, name: item.name, target: 'secondary' }); setIsDeleteDialogOpen(true); }}><Trash2 className="h-5 w-5"/></Button>
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
                                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                                    <div className="p-10 bg-gradient-to-b from-primary/5 to-transparent rounded-full mb-8 relative">
                                        <Layers className="h-32 w-32 text-primary/10 animate-pulse" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <ListTree className="h-12 w-12 text-primary opacity-20" />
                                        </div>
                                    </div>
                                    <h3 className="text-3xl font-black text-[#1e1b4b] tracking-tighter max-w-sm">
                                        {view === 'transactions' ? 'دليل الخدمات الهندسية' : 'اختر تصنيفاً لإدارة هيكله الداخلي'}
                                    </h3>
                                    <p className="text-slate-400 font-bold mt-4">استخدم القائمة اليمنى لاختيار القسم أو المحافظة.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* الحوارات (Dialogs) */}
            <Dialog open={isPrimaryDialogOpen || isSecondaryDialogOpen} onOpenChange={closeDialog}>
                <DialogContent dir="rtl" className="max-w-md rounded-[2.8rem] p-10 shadow-[0_30px_60px_rgba(0,0,0,0.3)] border-none bg-white">
                    <form onSubmit={(e) => { e.preventDefault(); handleSave(isPrimaryDialogOpen ? 'primary' : 'secondary'); }}>
                        <DialogHeader>
                            <div className="p-3 bg-primary/10 rounded-2xl text-primary w-fit mb-4 shadow-inner"><PlusCircle className="h-8 w-8"/></div>
                            <DialogTitle className="text-3xl font-black text-[#1e1b4b] tracking-tighter">{editingItem ? 'تعديل السجل' : 'إضافة سجل جديد'}</DialogTitle>
                            <DialogDescription className="font-bold text-slate-500">سيتم حفظ التغييرات وتعميمها على كافة فروع النظام.</DialogDescription>
                        </DialogHeader>
                        <div className="py-8">
                            <Label className="font-black text-[#1e1b4b] pr-2 block mb-3 text-sm">الاسم الرسمي للسجل (بالعربية) *</Label>
                            <Input value={itemName} onChange={e => setItemName(e.target.value)} required className="h-14 rounded-2xl border-2 text-xl font-black text-primary bg-slate-50 focus:bg-white shadow-inner transition-all" placeholder="اكتب هنا..." />
                        </div>
                        <DialogFooter className="gap-3 pt-4 border-t">
                            <Button type="button" variant="ghost" onClick={closeDialog} className="rounded-xl font-black h-12 px-8">إلغاء</Button>
                            <Button type="submit" disabled={isSaving} className="rounded-2xl font-black h-12 px-14 bg-primary text-white shadow-xl shadow-primary/20">
                                {isSaving ? <Loader2 className="h-5 w-5 animate-spin"/> : <Save className="ml-2 h-5 w-5"/>} حفظ البيانات
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent dir="rtl" className="rounded-[2.5rem] border-none shadow-2xl p-10">
                    <AlertDialogHeader>
                        <div className="p-4 bg-red-50 text-red-600 rounded-3xl w-fit mb-4 shadow-inner"><Trash2 className="h-10 w-10"/></div>
                        <AlertDialogTitle className="text-2xl font-black text-red-700 tracking-tight">تأكيد الحذف النهائي؟</AlertDialogTitle>
                        <AlertDialogDescription className="text-lg font-bold text-slate-500 leading-relaxed mt-2">سيتم مسح سجل <strong className="text-red-900">"{itemToDelete?.name}"</strong> تماماً من المنظومة وكافة الارتباطات التابعة له. <br/><br/> هل أنت متأكد من المتابعة؟</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-8 gap-4">
                        <AlertDialogCancel className="rounded-2xl font-black h-12 px-8 border-2">تراجع</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={isSaving} className="bg-red-600 hover:bg-red-700 rounded-2xl font-black h-12 px-12 shadow-xl shadow-red-200">
                            {isSaving ? <Loader2 className="animate-spin h-5 w-5"/> : 'نعم، حذف'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={isImportConfirmOpen} onOpenChange={setIsImportConfirmOpen}>
                <AlertDialogContent dir="rtl" className="rounded-[2.5rem] border-none shadow-2xl p-10">
                    <AlertDialogHeader>
                        <div className="p-4 bg-primary/10 text-primary rounded-3xl w-fit mb-4 shadow-inner"><DownloadCloud className="h-10 w-10"/></div>
                        <AlertDialogTitle className="text-2xl font-black text-[#1e1b4b] tracking-tight">تأكيد استيراد القوالب؟</AlertDialogTitle>
                        <AlertDialogDescription className="text-lg font-bold text-slate-500 leading-relaxed mt-2">سيقوم هذا الإجراء بإضافة الأقسام والوظائف والمناطق الافتراضية المعتمدة للمكاتب الهندسية في الكويت آلياً لتوفير وقتك.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-8 gap-4">
                        <AlertDialogCancel className="rounded-2xl font-black h-12 px-8 border-2">تراجع</AlertDialogCancel>
                        <AlertDialogAction onClick={handleImportDefaults} disabled={isImporting} className="rounded-2xl font-black h-12 px-12 bg-primary shadow-xl shadow-primary/20">
                            {isImporting ? <Loader2 className="h-5 w-5 animate-spin"/> : 'نعم، ابدأ الاستيراد'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
