'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useFirebase, useSubscription } from '@/firebase/index.tsx';
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
} from 'firebase/firestore';
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    CardDescription,
    CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
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
    MapPin, X, 
    Sparkles,
    GitBranch,
    Briefcase,
    Activity,
    ArrowLeft
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn, getTenantPath, cleanFirestoreData } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { MultiSelect } from '../ui/multi-select';
import { InlineSearchList } from '../ui/inline-search-list';
import { WbsEditor } from './wbs-editor';

import type {
    Department,
    Job,
    ServiceType,
    TransactionType,
    Governorate,
    Area,
    SubService
} from '@/lib/types';


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

// Simplified list for flat data structures like ServiceTypes
function SimpleListManager({
    items,
    loading,
    title,
    onAddItem,
    onEditItem,
    onDeleteItem
}: {
    items: any[],
    loading: boolean,
    title: string,
    onAddItem: () => void,
    onEditItem: (item: any) => void,
    onDeleteItem: (item: any) => void
}) {
    return (
         <Card className="md:col-span-12 border-none rounded-[2rem] shadow-xl bg-white/45 backdrop-blur-xl overflow-hidden flex flex-col border-white/60">
            <ScrollArea className="flex-1">
                 <div className="p-6 space-y-3">
                    {loading ? (
                        Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-[1.8rem]" />)
                    ) : items.length === 0 ? (
                        <div className="text-center py-20 text-gray-400 flex flex-col items-center">
                            <ListTree className="h-12 w-12 mb-4"/>
                            <h3 className="font-bold">القائمة فارغة</h3>
                            <p className="text-sm">ابدأ بإضافة عنصر جديد من الزر في الأعلى.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {items.map(item => (
                                <div key={item.id} className="group flex items-center justify-between p-4 rounded-[1.8rem] bg-white/70 hover:bg-white hover:scale-105 transition-all duration-300 shadow-sm hover:shadow-lg">
                                    <div className="flex items-center gap-4">
                                        <Briefcase className="h-4 w-4 text-primary opacity-60"/>
                                        <span className="font-black text-lg text-[#1e1b4b]">{item.name}</span>
                                    </div>
                                    <div className={cn("flex gap-2 transition-opacity", "opacity-0 group-hover:opacity-100")}>
                                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-gray-200" onClick={() => onEditItem(item)}><Pencil className="h-4 w-4"/></Button>
                                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-red-500 hover:bg-red-100" onClick={() => onDeleteItem(item)}><Trash2 className="h-4 w-4"/></Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </ScrollArea>
        </Card>
    )
}


export function ReferenceDataManager() {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();

    const [view, setView] = useState<'main' | 'departments' | 'locations' | 'transactions' | 'serviceTypes'>('main');
    const [selectedPrimaryId, setSelectedPrimaryId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    const [isPrimaryDialogOpen, setIsPrimaryDialogOpen] = useState(false);
    const [isSecondaryDialogOpen, setIsSecondaryDialogOpen] = useState(false);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<any | null>(null);

    const [isWbsEditorOpen, setIsWbsEditorOpen] = useState(false);
    const [wbsItem, setWbsItem] = useState<SubService | null>(null);

    const [editingItem, setEditingItem] = useState<any | null>(null);
    const [itemName, setItemName] = useState('');
    const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
    const [selectedServiceTypeId, setSelectedServiceTypeId] = useState('');

    const tenantId = currentUser?.currentCompanyId;

    const primaryCollectionName = useMemo(() => {
        if (view === 'departments') return 'departments';
        if (view === 'locations') return 'governorates';
        if (view === 'transactions') return 'transactionTypes';
        if (view === 'serviceTypes') return 'serviceTypes';
        return null;
    }, [view]);

    const secondaryCollectionName = useMemo(() => {
        if (view === 'departments') return 'jobs';
        if (view === 'locations') return 'areas';
        if (view === 'transactions') return 'subServices';
        // serviceTypes has no secondary collection, so it returns null
        return null;
    }, [view]);

    const { data: departmentsData, loading: loadingDepartments } = useSubscription<Department>(getTenantPath('departments', tenantId));
    const { data: locationsData, loading: loadingLocations } = useSubscription<Governorate>(getTenantPath('governorates', tenantId));
    const { data: transactionsData, loading: loadingTransactions } = useSubscription<TransactionType>(getTenantPath('transactionTypes', tenantId));
    const { data: serviceTypesData, loading: loadingServiceTypes } = useSubscription<ServiceType>(getTenantPath('serviceTypes', tenantId));
    
    const { data: rawPrimaryItems, loading: loadingPrimary } = useSubscription<any>(getTenantPath(primaryCollectionName, tenantId));
    
    const secondaryRelativePath = useMemo(() => {
        if (!selectedPrimaryId || !primaryCollectionName || !secondaryCollectionName) return null;
        return `${primaryCollectionName}/${selectedPrimaryId}/${secondaryCollectionName}`;
    }, [selectedPrimaryId, primaryCollectionName, secondaryCollectionName]);

    const { data: rawSecondaryItems, loading: loadingSecondary } = useSubscription<any>(getTenantPath(secondaryRelativePath, tenantId));

    const primaryItems = useMemo(() => rawPrimaryItems ? [...rawPrimaryItems].sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name, 'ar')) : [], [rawPrimaryItems]);
    const secondaryItems: SubService[] = useMemo(() => rawSecondaryItems ? [...rawSecondaryItems].sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name, 'ar')) : [], [rawSecondaryItems]);

    const selectedPrimary = useMemo(() => primaryItems.find(i => i.id === selectedPrimaryId) as TransactionType | undefined, [primaryItems, selectedPrimaryId]);
    const departmentOptions = useMemo(() => departmentsData.map((d: any) => ({ value: d.id!, label: d.name })), [departmentsData]);
    const serviceTypeOptions = useMemo(() => serviceTypesData.map((s: any) => ({ value: s.id!, label: s.name })), [serviceTypesData]);

    const getTitle = () => {
        switch(view) {
            case 'departments': return 'الأقسام والوظائف';
            case 'locations': return 'المواقع الجغرافية';
            case 'transactions': return 'أنواع العقود والمراحل';
            case 'serviceTypes': return 'أنشطة الأعمال (الخدمات)';
            default: return '';
        }
    };

    const openWbsEditor = (item: SubService) => {
        setWbsItem(item);
        setIsWbsEditorOpen(true);
    };

    const openPrimaryDialog = (item: any | null) => {
        setEditingItem(item);
        setItemName(item ? item.name : '');
        if (view === 'transactions' && item) {
            setSelectedDeptIds(item.departmentIds || []);
            setSelectedServiceTypeId(item.serviceTypeId || '');
        } else if (view === 'transactions') {
             setSelectedDeptIds([]);
            setSelectedServiceTypeId('');
        }
        setIsPrimaryDialogOpen(true);
    };

    const closeDialog = useCallback(() => {
        setIsPrimaryDialogOpen(false);
        setIsSecondaryDialogOpen(false);
        setEditingItem(null);
        setItemName('');
        setSelectedDeptIds([]);
        setSelectedServiceTypeId('');
    }, []);

    const handleSave = async (type: 'primary' | 'secondary') => {
        if (!firestore || !itemName.trim() || !tenantId) return;

        const relPath = type === 'primary' ? primaryCollectionName : secondaryRelativePath;
        if (!relPath) return;

        setIsSaving(true);
        try {
            const finalPath = getTenantPath(relPath, tenantId)!;
            const currentList = type === 'primary' ? primaryItems : secondaryItems;

            let payload: any = { name: itemName, updatedAt: serverTimestamp(), companyId: tenantId };

            if (view === 'transactions' && type === 'primary') {
                payload.departmentIds = selectedDeptIds;
                payload.serviceTypeId = selectedServiceTypeId;
            }
            if (type === 'secondary' && selectedPrimaryId) payload.parentId = selectedPrimaryId;

            if (editingItem) {
                await updateDoc(doc(firestore, finalPath, editingItem.id), cleanFirestoreData(payload));
            } else {
                payload.order = currentList.length;
                await addDoc(collection(firestore, finalPath), { ...payload, createdAt: serverTimestamp() });
            }

            toast({ title: 'تم الحفظ بنجاح' });
            closeDialog();
        } catch (e) { console.error(e); toast({ variant: 'destructive', title: 'خطأ في الحفظ' }); } finally { setIsSaving(false); }
    };

    const handleDelete = async () => {
        if (!firestore || !itemToDelete || !tenantId) return;
        
        const relPath = itemToDelete.target === 'primary' ? primaryCollectionName : secondaryRelativePath;
        if (!relPath) return;

        setIsSaving(true);
        try {
            const finalPath = getTenantPath(relPath, tenantId)!;
            await deleteDoc(doc(firestore, finalPath, itemToDelete.id));
            
            toast({ title: 'تم الحذف بنجاح نهائياً' });
            setIsDeleteDialogOpen(false);
            setItemToDelete(null);
            
            if (itemToDelete.target === 'primary' && selectedPrimaryId === itemToDelete.id) {
                setSelectedPrimaryId(null);
            }
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'فشل عملية الحذف المعتمدة' });
        } finally {
            setIsSaving(false);
        }
    };

    if (view === 'main') {
        return (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" dir="rtl">
                <SummaryCard 
                    title="إدارة أنواع العقود والمراحل"
                    description="تحديد وتصنيف أنواع العقود ومراحلها"
                    count={transactionsData.length}
                    loading={loadingTransactions}
                    onNavigate={() => setView('transactions')}
                    icon={<Workflow className="h-8 w-8 text-white"/>}
                    colorClass="bg-gradient-to-br from-purple-500 to-indigo-600"
                />
                <SummaryCard 
                    title="إدارة الأقسام والوظائف"
                    description="تنظيم الهيكل الوظيفي وتحديد مسؤوليات الأقسام"
                    count={departmentsData.length}
                    loading={loadingDepartments}
                    onNavigate={() => setView('departments')}
                    icon={<Building2 className="h-8 w-8 text-white"/>}
                    colorClass="bg-gradient-to-br from-sky-500 to-blue-600"
                />
                 <SummaryCard 
                    title="إدارة المواقع الجغرافية"
                    description="تحديد المحافظات والمناطق لتسهيل العمليات الميدانية"
                    count={locationsData.length}
                    loading={loadingLocations}
                    onNavigate={() => setView('locations')}
                    icon={<MapPin className="h-8 w-8 text-white"/>}
                    colorClass="bg-gradient-to-br from-amber-500 to-orange-600"
                />
                 <SummaryCard 
                    title="إدارة أنشطة الأعمال (الخدمات)"
                    description="تصنيف الخدمات والأنشطة التي تقدمها الشركة"
                    count={serviceTypesData.length}
                    loading={loadingServiceTypes}
                    onNavigate={() => setView('serviceTypes')}
                    icon={<Briefcase className="h-8 w-8 text-white"/>}
                    colorClass="bg-gradient-to-br from-teal-500 to-cyan-600"
                />
            </div>
        )
    }

    const renderContent = () => {
        // If the view has no secondary collection, it's a flat list. Render the simple manager.
        if (!secondaryCollectionName) {
            return (
                <SimpleListManager 
                    items={primaryItems}
                    loading={loadingPrimary}
                    title={getTitle()}
                    onAddItem={() => openPrimaryDialog(null)}
                    onEditItem={(item) => openPrimaryDialog(item)}
                    onDeleteItem={(item) => {
                        setItemToDelete({ ...item, target: 'primary' });
                        setIsDeleteDialogOpen(true);
                    }}
                />
            )
        }

        // Otherwise, render the master-detail view
        return (
            <div className="grid grid-cols-1 md:grid-cols-12 min-h-[600px] gap-6">
                <Card className="md:col-span-4 border-none rounded-[2rem] shadow-xl bg-white/45 backdrop-blur-xl overflow-hidden flex flex-col border-white/60">
                    <ScrollArea className="flex-1">
                         <div className="p-6 space-y-3">
                            {loadingPrimary ? (
                                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[4.5rem] w-full rounded-[1.8rem]" />)
                            ) : primaryItems.length === 0 ? (
                                <div className="text-center py-20 text-gray-400 flex flex-col items-center">
                                    <ListTree className="h-12 w-12 mb-4"/>
                                    <h3 className="font-bold">القائمة فارغة</h3>
                                    <p className="text-sm">ابدأ بإضافة عنصر جديد من الزر أعلاه.</p>
                                </div>
                            ) : (
                                primaryItems.map(item => (
                                    <div
                                        key={item.id}
                                        onClick={() => setSelectedPrimaryId(item.id)}
                                        className={cn(
                                            "group flex items-center justify-between p-4 rounded-[1.8rem] cursor-pointer transition-all duration-300",
                                            selectedPrimaryId === item.id
                                                ? 'bg-primary text-primary-foreground shadow-lg scale-105'
                                                : 'bg-white/70 hover:bg-white hover:scale-105 hover:shadow-md'
                                        )}
                                    >
                                        <div className="flex items-center gap-4">
                                            <span className="font-black text-lg">{item.name}</span>
                                        </div>
                                        <div className={cn("flex gap-2 transition-opacity", selectedPrimaryId === item.id ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
                                             <Button variant="ghost" size="icon" className={cn("h-9 w-9 rounded-xl", selectedPrimaryId === item.id ? 'bg-white/20 hover:bg-white/30' : 'hover:bg-gray-200')} onClick={(e) => { e.stopPropagation(); openPrimaryDialog(item); }}><Pencil className="h-4 w-4"/></Button>
                                            <Button variant="ghost" size="icon" className={cn("h-9 w-9 rounded-xl text-red-500", selectedPrimaryId === item.id ? 'bg-white/20 hover:bg-white/30' : 'hover:bg-red-100')} onClick={(e) => { e.stopPropagation(); setItemToDelete({ id: item.id, name: item.name, target: 'primary' }); setIsDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4"/></Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </ScrollArea>
                </Card>

                <Card className="md:col-span-8 border-none rounded-[2rem] shadow-xl bg-white/45 backdrop-blur-xl overflow-hidden flex flex-col border-white/60">
                    {selectedPrimaryId ? (
                        <>
                           <CardHeader className="flex flex-row items-center justify-between p-6 border-b border-gray-200/80">
                                <div>
                                    <CardTitle className="text-xl font-black text-[#1e1b4b]">القائمة الفرعية لـ "{selectedPrimary?.name}"</CardTitle>
                                    <CardDescription>اسحب وأفلت لترتيب العناصر أو قم بإضافة عنصر جديد.</CardDescription>
                                </div>
                                {secondaryCollectionName && 
                                    <Button onClick={() => { setEditingItem(null); setItemName(''); setIsSecondaryDialogOpen(true); }} className="rounded-full h-11 px-5 font-black gap-2"><PlusCircle className="h-5 w-5"/>إضافة عنصر جديد</Button>
                                }
                           </CardHeader>
                            <ScrollArea className="flex-1 px-8 py-6">
                                {loadingSecondary ? (
                                     Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-[1.8rem]" />)
                                ) : !secondaryCollectionName || secondaryItems.length === 0 ? (
                                     <div className="text-center py-20 text-gray-400 flex flex-col items-center">
                                        <ListTree className="h-12 w-12 mb-4"/>
                                        <h3 className="font-bold">لا توجد عناصر تابعة</h3>
                                        <p className="text-sm">ابدأ بإضافة عنصر جديد من الزر أعلاه.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-3">
                                        {secondaryItems.map(item => (
                                            <div key={item.id} className="group flex items-center justify-between p-4 rounded-[1.8rem] bg-white/70 hover:bg-white hover:scale-105 transition-all duration-300 shadow-sm hover:shadow-lg">
                                                <div className="flex items-center gap-4">
                                                    <GitBranch className="h-4 w-4 text-primary opacity-60"/>
                                                    <span className="font-black text-lg text-[#1e1b4b]">{item.name}</span>
                                                </div>
                                                <div className={cn("flex gap-2 transition-opacity", "opacity-0 group-hover:opacity-100")}>
                                                    {view === 'transactions' && (
                                                        <Button variant="outline" onClick={() => openWbsEditor(item)} className="rounded-xl border-dashed border-primary/50 text-primary font-black gap-2 h-9 px-4 text-xs">
                                                            <Workflow className="h-3 w-3"/> WBS
                                                        </Button>
                                                    )}
                                                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-gray-200" onClick={(e) => { 
                                                        e.stopPropagation();
                                                        setEditingItem(item); 
                                                        setItemName(item.name); 
                                                        setIsSecondaryDialogOpen(true); 
                                                    }}><Pencil className="h-4 w-4"/></Button>
                                                    
                                                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-red-500 hover:bg-red-100" onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            setItemToDelete({ id: item.id, name: item.name, target: 'secondary' }); 
                                                            setIsDeleteDialogOpen(true); 
                                                        }}>
                                                        <Trash2 className="h-4 w-4"/>
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center p-8">
                            <ListTree className="h-16 w-16 text-gray-300 mb-4" />
                            <h3 className="text-lg font-bold text-gray-500">الرجاء تحديد عنصر من القائمة</h3>
                            <p className="text-sm text-gray-400">حدد عنصرًا من القائمة اليمنى لعرض وتحرير التفاصيل التابعة له.</p>
                        </div>
                    )}
                </Card>
            </div>
        );
    };

    return (
        <div className="space-y-6" dir="rtl">
             <Card className="border-none rounded-[2rem] shadow-lg bg-gradient-to-r from-orange-600 to-yellow-400 text-white overflow-hidden">
                <CardHeader className="flex-row items-center justify-between p-6">
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="icon" className="h-12 w-12 rounded-full bg-white/15 hover:bg-white/25 text-white border-white/20" onClick={() => setView('main')}><ArrowRight className="h-5 w-5"/></Button>
                        <CardTitle className="text-2xl font-black">{getTitle()}</CardTitle>
                    </div>
                    <Button onClick={() => openPrimaryDialog(null)} variant="outline" className="rounded-full h-12 px-6 font-black gap-2 bg-white/15 hover:bg-white/25 border-white/20"><PlusCircle className="h-5 w-5"/>إضافة {view === 'transactions' ? 'عقد' : view === 'departments' ? 'قسم' : view === 'locations' ? 'محافظة' : 'نشاط'}</Button>
                </CardHeader>
            </Card>

            {renderContent()}

            {/* Dialog for Primary Item (covers both simple and master-detail) */}
            <Dialog open={isPrimaryDialogOpen} onOpenChange={setIsPrimaryDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingItem ? 'تعديل' : 'إضافة'} {primaryCollectionName === 'serviceTypes' ? 'نشاط' : 'عنصر'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="itemName">الاسم</Label>
                            <Input id="itemName" value={itemName} onChange={(e) => setItemName(e.target.value)} />
                        </div>
                        {view === 'transactions' && (
                            <>
                                <div className="space-y-2">
                                    <Label>الأقسام المسؤولة</Label>
                                    <MultiSelect 
                                        options={departmentOptions} 
                                        selected={selectedDeptIds}
                                        onChange={setSelectedDeptIds}
                                        placeholder="اختر الأقسام"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>نشاط العمل الرئيسي</Label>
                                     <InlineSearchList 
                                        options={serviceTypeOptions}
                                        value={selectedServiceTypeId}
                                        onSelect={setSelectedServiceTypeId} // CORRECTED: from onChange to onSelect
                                        placeholder="ابحث عن نشاط..."
                                     />
                                </div>
                            </>
                        )}
                    </div>
                    <DialogFooter>
                         <Button variant="ghost" onClick={closeDialog}>إلغاء</Button>
                        <Button onClick={() => handleSave('primary')} disabled={isSaving}>{isSaving ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>} حفظ</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

             {/* Dialog for Secondary Item */}
             <Dialog open={isSecondaryDialogOpen} onOpenChange={setIsSecondaryDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingItem ? 'تعديل عنصر' : 'إضافة عنصر جديد'} لـ "{selectedPrimary?.name}"</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <Label htmlFor="itemName">اسم العنصر</Label>
                        <Input id="itemName" value={itemName} onChange={(e) => setItemName(e.target.value)} />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={closeDialog}>إلغاء</Button>
                        <Button onClick={() => handleSave('secondary')} disabled={isSaving}>{isSaving ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>} حفظ</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {isWbsEditorOpen && wbsItem && selectedPrimary && (
                <WbsEditor 
                    isOpen={isWbsEditorOpen}
                    onClose={() => setIsWbsEditorOpen(false)}
                    subService={wbsItem}
                    transactionType={selectedPrimary}
                />
            )}

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>هل أنت متأكد تماماً؟</AlertDialogTitle>
                        <AlertDialogDescription>
                            هذا الإجراء سيقوم بحذف العنصر <span className="font-bold text-red-500">{itemToDelete?.name}</span> نهائياً. لا يمكن التراجع عن هذا الإجراء.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={isSaving} className="bg-red-600 hover:bg-red-700">
                           {isSaving ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4"/>} متابعة الحذف
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}