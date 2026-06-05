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
    Briefcase
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn, getTenantPath, cleanFirestoreData } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { MultiSelect, type MultiSelectOption } from '../ui/multi-select';


// Correctly importing types (using `type`) and values
import {
    defaultDepartments,
    defaultJobs,
    defaultGovernorates,
    defaultAreas,
    defaultTransactionTypes,
    defaultServiceTypes,
} from '@/lib/default-reference-data';
import type {
    Department,
    Job,
    ServiceType,
    TransactionType,
    Governorate,
    Area
} from '@/lib/default-reference-data';


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

    const [view, setView] = useState<'main' | 'departments' | 'locations' | 'transactions' | 'serviceTypes'>('main');
    const [selectedPrimaryId, setSelectedPrimaryId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isImporting, setIsImporting] = useState(false);

    const [isPrimaryDialogOpen, setIsPrimaryDialogOpen] = useState(false);
    const [isSecondaryDialogOpen, setIsSecondaryDialogOpen] = useState(false);
    const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);

    // 💡 متغيرات تتبع حالة نافذة تأكيد الحذف والعنصر المستهدف
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<any | null>(null);

    const [editingItem, setEditingItem] = useState<any | null>(null);
    const [itemName, setItemName] = useState('');
    const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);

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
        return null;
    }, [view]);

    const { data: departmentsData, loading: loadingDepartments } = useSubscription<Department>(firestore, getTenantPath('departments', tenantId));
    const { data: locationsData, loading: loadingLocations } = useSubscription<Governorate>(firestore, getTenantPath('governorates', tenantId));
    const { data: transactionsData, loading: loadingTransactions } = useSubscription<TransactionType>(firestore, getTenantPath('transactionTypes', tenantId));
    const { data: serviceTypesData, loading: loadingServiceTypes } = useSubscription<ServiceType>(firestore, getTenantPath('serviceTypes', tenantId));
    const { data: allDepartments = [] } = useSubscription<Department>(firestore, getTenantPath('departments', tenantId));

    const { data: rawPrimaryItems, loading: loadingPrimary } = useSubscription<any>(firestore, getTenantPath(primaryCollectionName, tenantId));
    
    const secondaryRelativePath = useMemo(() => {
        if (!selectedPrimaryId || !primaryCollectionName || !secondaryCollectionName) return null;
        return `${primaryCollectionName}/${selectedPrimaryId}/${secondaryCollectionName}`;
    }, [selectedPrimaryId, primaryCollectionName, secondaryCollectionName]);

    const { data: rawSecondaryItems, loading: loadingSecondary } = useSubscription<any>(firestore, getTenantPath(secondaryRelativePath, tenantId));

    const primaryItems = useMemo(() => rawPrimaryItems ? [...rawPrimaryItems].sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name, 'ar')) : [], [rawPrimaryItems]);
    const secondaryItems = useMemo(() => rawSecondaryItems ? [...rawSecondaryItems].sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name, 'ar')) : [], [rawSecondaryItems]);

    const selectedPrimary = useMemo(() => primaryItems.find(i => i.id === selectedPrimaryId), [primaryItems, selectedPrimaryId]);
    const departmentOptions = useMemo(() => allDepartments.map((d: any) => ({ value: d.id!, label: d.name })), [allDepartments]);

    const getTitle = () => {
        switch(view) {
            case 'departments': return 'إدارة الأقسام والوظائف';
            case 'locations': return 'إدارة المواقع الجغرافية';
            case 'transactions': return 'إدارة أنواع العقود والمراحل';
            case 'serviceTypes': return 'إدارة أنشطة الأعمال (الخدمات)';
            default: return '';
        }
    };

    const closeDialog = useCallback(() => {
        setIsPrimaryDialogOpen(false);
        setIsSecondaryDialogOpen(false);
        setEditingItem(null);
        setItemName('');
        setSelectedDeptIds([]);
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

            if (view === 'transactions' && type === 'primary') payload.departmentIds = selectedDeptIds;
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

    // 💡 دالة الحذف المعتمدة للتواصل مع Firestore وإلغاء الربط نهائياً
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
            
            // في حال تم حذف عنصر رئيسي، نقوم بإلغاء تحديده من الشاشة الفرعية منعاً للتعليق
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

    const handleImportDefaults = async () => {
        if (!firestore || !tenantId) return;
        setIsImporting(true);
        try {
            const batch = writeBatch(firestore);
            let hasWritten = false;

            const collectionsToImport: { name: string, data: any[] }[] = [
                { name: 'departments', data: defaultDepartments },
                { name: 'governorates', data: defaultGovernorates },
                { name: 'transactionTypes', data: defaultTransactionTypes as any[] },
                { name: 'serviceTypes', data: defaultServiceTypes as any[] },
            ];

            for (const { name, data } of collectionsToImport) {
                const collectionPath = getTenantPath(name, tenantId)!;
                const existingDocs = await getDocs(query(collection(firestore, collectionPath)));
                if (existingDocs.empty) {
                    hasWritten = true;
                    data.forEach((item, index) => {
                        const docRef = doc(collection(firestore, collectionPath));
                        batch.set(docRef, { ...item, order: index, companyId: tenantId, createdAt: serverTimestamp() });
                    });
                }
            }

            if (hasWritten) await batch.commit();

            const subCollectionBatch = writeBatch(firestore);
            let subHasWritten = false;

            const deptsSnapshot = await getDocs(query(collection(firestore, getTenantPath('departments', tenantId)!)));
            for (const deptDoc of deptsSnapshot.docs) {
                const deptData = deptDoc.data();
                const jobsToImport = (defaultJobs as any)[deptData.name] || [];
                if (jobsToImport.length > 0) {
                    const jobsPath = `departments/${deptDoc.id}/jobs`;
                    const jobsCollectionPath = getTenantPath(jobsPath, tenantId)!;
                    const jobsSnapshot = await getDocs(query(collection(firestore, jobsCollectionPath)));
                    if (jobsSnapshot.empty) {
                        subHasWritten = true;
                        jobsToImport.forEach((job: any, index: number) => {
                            const jobRef = doc(collection(firestore, jobsCollectionPath));
                            subCollectionBatch.set(jobRef, { ...job, order: index, parentId: deptDoc.id, companyId: tenantId, createdAt: serverTimestamp() });
                        });
                    }
                }
            }

            const govSnapshot = await getDocs(query(collection(firestore, getTenantPath('governorates', tenantId)!)));
            for (const govDoc of govSnapshot.docs) {
                const govData = govDoc.data();
                const areasToImport = (defaultAreas as any)[govData.name] || [];
                if (areasToImport.length > 0) {
                    const areasPath = `governorates/${govDoc.id}/areas`;
                    const areasCollectionPath = getTenantPath(areasPath, tenantId)!;
                    const areasSnapshot = await getDocs(query(collection(firestore, areasCollectionPath)));
                    if (areasSnapshot.empty) {
                        subHasWritten = true;
                        areasToImport.forEach((area: any, index: number) => {
                            const areaRef = doc(collection(firestore, areasCollectionPath));
                            subCollectionBatch.set(areaRef, { ...area, order: index, parentId: govDoc.id, companyId: tenantId, createdAt: serverTimestamp() });
                        });
                    }
                }
            }

            if (subHasWritten) await subCollectionBatch.commit();

            if (hasWritten || subHasWritten) {
                toast({ title: 'نجاح الاستيراد', description: 'تم استيراد البيانات المرجعية الأساسية.' });
            } else {
                toast({ title: 'لا يوجد جديد', description: 'القوائم المرجعية لديك تحتوي على بيانات بالفعل.' });
            }

        } catch (e: any) { console.error("Import failed: ", e); toast({ variant: 'destructive', title: 'فشل الاستيراد', description: e.message }); } finally { setIsImporting(false); setIsImportConfirmOpen(false); }
    };

    if (view === 'main') {
        return (
            <div className="space-y-12" dir="rtl">
                <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-gradient-to-r from-[#FF7A00] to-[#FFB000] text-white relative">
                    <div className="absolute top-0 right-0 w-80 h-full bg-white/10 -skew-x-12 transform translate-x-32 pointer-events-none" />
                    <CardHeader className="p-10 relative z-10 border-b border-white/10">
                         <div className="flex items-center gap-6">
                            <div className="p-5 bg-white/20 rounded-[2rem] backdrop-blur-xl border border-white/40 shadow-2xl">
                                <Settings2 className="h-10 w-10 text-white" />
                            </div>
                            <div className="text-right">
                                <CardTitle className="text-3xl font-black text-white tracking-tighter">إدارة القوائم والبيانات المرجعية</CardTitle>
                                <div className="flex items-center gap-2 mt-1">
                                    <Sparkles className="h-4 w-4 text-amber-200 animate-pulse" />
                                    <CardDescription className="text-white/90 font-bold text-sm">تخصيص الأقسام، المواقع، وهيكل مراحل العمل (WBS).</CardDescription>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 px-2">
                    <SummaryCard title="الأقسام والوظائف" count={departmentsData?.length || 0} icon={<Building2 className="h-10 w-10"/>} onNavigate={() => { setView('departments'); setSelectedPrimaryId(null); }} colorClass="bg-blue-600/10 text-blue-600" loading={loadingDepartments} description="إدارة الهيكل التنظيمي والوظائف المعتمدة." />
                    <SummaryCard title="المناطق والمواقع" count={locationsData?.length || 0} icon={<MapPin className="h-10 w-10"/>} onNavigate={() => { setView('locations'); setSelectedPrimaryId(null); }} colorClass="bg-emerald-600/10 text-emerald-600" loading={loadingLocations} description="إدارة المحافظات والمناطق الجغرافية." />
                    <SummaryCard title="أنواع العقود والمراحل" count={transactionsData?.length || 0} icon={<Workflow className="h-10 w-10"/>} onNavigate={() => { setView('transactions'); setSelectedPrimaryId(null); }} colorClass="bg-orange-600/10 text-primary" loading={loadingTransactions} description="قائمة المعاملات وربطها بمراحل الإنجاز (WBS)." />
                    <SummaryCard title="أنشطة الأعمال (الخدمات)" count={serviceTypesData?.length || 0} icon={<Briefcase className="h-10 w-10"/>} onNavigate={() => { setView('serviceTypes'); setSelectedPrimaryId(null);}} colorClass="bg-purple-600/10 text-purple-600" loading={loadingServiceTypes} description="تصنيف العقود لأغراض التحليل المالي." />
                </div>

                <div className="flex justify-center no-print">
                    <Button onClick={() => setIsImportConfirmOpen(true)} variant="outline" className="h-14 px-12 rounded-[2.2rem] border-2 border-dashed font-black text-xl text-primary gap-3 hover:bg-primary/5">
                        <DownloadCloud className="h-6 w-6" /> استيراد الهيكل المرجعي الموحد
                    </Button>
                </div>

                 <AlertDialog open={isImportConfirmOpen} onOpenChange={setIsImportConfirmOpen}>
                    <AlertDialogContent dir="rtl" className="rounded-[2.5rem] border-none shadow-2xl p-10">
                        <AlertDialogHeader>
                            <div className="p-4 bg-primary/10 text-primary rounded-2xl w-fit mb-4 shadow-inner"><DownloadCloud className="h-10 w-10"/></div>
                            <AlertDialogTitle className="text-2xl font-black text-[#1e1b4b] tracking-tighter">تأكيد استيراد القوالب الموحدة؟</AlertDialogTitle>
                            <AlertDialogDescription className="text-lg font-bold text-slate-500 leading-relaxed mt-2">سيقوم هذا الإجراء بإضافة القوائم الأساسية الموصى بها (والقوائم الفرعية لها) إذا كانت فارغة. لن يتم الكتابة فوق أي بيانات موجودة.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="mt-8 gap-3">
                            <AlertDialogCancel className="rounded-xl font-black h-12 px-8 border-2">تراجع</AlertDialogCancel>
                            <AlertDialogAction onClick={handleImportDefaults} disabled={isImporting}>{isImporting ? <Loader2 className="h-4 w-4 animate-spin"/> : 'نعم، ابدأ الاستيراد'}</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
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
                            <Button onClick={() => { setView('main'); setSelectedPrimaryId(null); }} variant="outline" className="bg-white/10 text-white border-white/40 hover:bg-white/20 rounded-2xl font-black h-12 px-8 gap-2 backdrop-blur-md shadow-xl">
                                <X className="h-5 w-5" /> إغلاق
                            </Button>
                        </div>
                        <div className="flex items-center gap-6">
                             <div className="p-5 bg-white/20 rounded-[2rem] backdrop-blur-xl border border-white/40 shadow-2xl">
                                {view === 'departments' ? <Building2 className="h-10 w-10 text-white" /> : view === 'locations' ? <MapPin className="h-10 w-10 text-white" /> : view === 'serviceTypes' ? <Briefcase className="h-10 w-10 text-white"/> : <Workflow className="h-10 w-10 text-white" />}
                            </div>
                            <div className="text-right">
                                <CardTitle className="text-3xl font-black tracking-tighter text-white">{getTitle()}</CardTitle>
                                <div className="flex items-center gap-2 mt-2 justify-end">
                                    <Sparkles className="h-4 w-4 text-amber-200 animate-pulse" />
                                    <CardDescription className="text-white/90 font-black text-sm uppercase tracking-widest">الآن يمكنك الإضافة والتعديل.</CardDescription>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-12 min-h-[600px] gap-6">
                <Card className="md:col-span-4 border-none rounded-[2rem] shadow-xl bg-white/45 backdrop-blur-xl overflow-hidden flex flex-col border-white/60">
                    <div className="p-8 border-b bg-primary/5 flex justify-between items-center">
                        <Label className="font-black text-[#1e1b4b] text-lg tracking-tight">القائمة الرئيسية</Label>
                        <Button onClick={() => { setEditingItem(null); setItemName(''); setSelectedDeptIds([]); setIsPrimaryDialogOpen(true); }} className="h-10 w-10 rounded-xl shadow-xl shadow-primary/20"><Plus className="h-5 w-5" /></Button>
                    </div>
                    <ScrollArea className="flex-1 p-6">
                        {loadingPrimary ? <div className="space-y-4"><Skeleton className="h-16 w-full rounded-xl"/><Skeleton className="h-16 w-full rounded-xl"/></div> :
                        primaryItems.length === 0 ? <p className="text-center p-20 text-muted-foreground italic font-black opacity-20">.لا توجد سجلات</p> :
                        <div className="space-y-2">
                            {primaryItems.map(item => (
                                <div key={item.id} 
                                    className={cn("group relative flex items-center justify-between p-4 rounded-[1.8rem] transition-all border-2 mb-2 cursor-pointer",
                                        selectedPrimaryId === item.id ? "bg-primary border-primary text-white shadow-xl scale-[1.01]" : "bg-white/60 hover:bg-white hover:border-primary/20 border-transparent shadow-sm"
                                    )}
                                    onClick={() => { setSelectedPrimaryId(item.id); }}
                                >
                                    <span className="font-black text-sm truncate pr-2">{item.name}</span>
                                    <div className={cn("flex gap-1.5 transition-all", selectedPrimaryId === item.id ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-white/30 text-current" onClick={(e) => { e.stopPropagation(); setEditingItem(item); setItemName(item.name); if(view === 'transactions') { setSelectedDeptIds(item.departmentIds || []) } setIsPrimaryDialogOpen(true); }}><Pencil className="h-4 w-4"/></Button>
                                        
                                        {/* 💡 تفعيل زر الحذف المعتمد للقائمة الرئيسية وفتح نافذة التأكيد */}
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-7 w-7 rounded-lg hover:bg-red-500/20 text-red-500 hover:text-red-600" 
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                setItemToDelete({ id: item.id, name: item.name, target: 'primary' }); 
                                                setIsDeleteDialogOpen(true); 
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4"/>
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>}
                    </ScrollArea>
                </Card>

                <Card className="md:col-span-8 border-none rounded-[2rem] shadow-xl bg-white/45 backdrop-blur-xl overflow-hidden flex flex-col border-white/60">
                    {selectedPrimaryId ? (
                        <>
                            <div className="p-8 border-b bg-muted/5">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-5">
                                        <div className="p-3 bg-white rounded-xl shadow-xl border border-primary/10">
                                            {(secondaryCollectionName) ? <ListTree className="h-6 w-6 text-primary"/> : <Briefcase className="h-6 w-6 text-primary"/> }
                                        </div>
                                        <div className="space-y-0.5">
                                            <h3 className="text-2xl font-black text-[#1e1b4b] tracking-tight">{selectedPrimary?.name}</h3>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{(secondaryCollectionName) ? 'إدارة البنود الفرعية' : ''}</p>
                                        </div>
                                    </div>
                                    {(secondaryCollectionName) &&
                                    <Button onClick={() => { setEditingItem(null); setItemName(''); setIsSecondaryDialogOpen(true); }} className="rounded-xl font-black h-11 px-8 shadow-xl shadow-primary/20 gap-2">
                                        <PlusCircle className="h-5 w-5" /> إضافة بند
                                    </Button>}
                                </div>
                            </div>
                            <ScrollArea className="flex-1 p-8">
                                {loadingSecondary ? <div className="space-y-4"><Skeleton className="h-12 w-full rounded-xl"/><Skeleton className="h-12 w-full rounded-xl"/></div> :
                                !secondaryCollectionName || secondaryItems.length === 0 ? (
                                    <div className="h-64 flex flex-col items-center justify-center grayscale opacity-20 border-4 border-dashed rounded-[2.5rem] border-primary/10 m-8">
                                        <PlusCircle className="h-16 w-16 mb-4 text-primary"/>
                                        <p className="font-black text-xl text-slate-500">{!secondaryCollectionName ? "هذه القائمة لا تحتوي على بنود فرعية." : "لا توجد بيانات فرعية."}</p>
                                        {(secondaryCollectionName) && <p className="font-bold text-slate-400 mt-2">يمكنك إضافة بنود من الزر أعلاه.</p>}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-3">
                                        {secondaryItems.map(item => (
                                            <div key={item.id} className="group flex items-center justify-between p-4 rounded-[1.8rem] bg-white/70">
                                                <div className="flex items-center gap-4">
                                                    <GitBranch className="h-4 w-4 text-primary opacity-60"/>
                                                    <span className="font-black text-lg text-[#1e1b4b]">{item.name}</span>
                                                </div>
                                                <div className={cn("flex gap-2 transition-opacity", "opacity-0 group-hover:opacity-100")}>
                                                    {/* WBS Button is disabled for now to ensure stability */}
                                                    {view === 'transactions' && (
                                                        <Button variant="outline" disabled className="rounded-xl border-dashed border-primary/50 text-primary font-black gap-2 h-9 px-4 text-xs">
                                                            <Workflow className="h-3 w-3"/> WBS
                                                        </Button>
                                                    )}
                                                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl border-2 border-primary/10 bg-white hover:bg-primary hover:text-white" onClick={(e) => { 
                                                        e.stopPropagation();
                                                        setEditingItem(item); 
                                                        setItemName(item.name); 
                                                        setIsSecondaryDialogOpen(true); 
                                                    }}><Pencil className="h-4 w-4"/></Button>
                                                    
                                                    {/* 💡 تفعيل زر الحذف المعتمد للقائمة الفرعية وفتح نافذة التأكيد */}
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-9 w-9 rounded-xl border-2 border-red-100 bg-white text-red-600 hover:bg-red-600 hover:text-white" 
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            setItemToDelete({ id: item.id, name: item.name, target: 'secondary' }); 
                                                            setIsDeleteDialogOpen(true); 
                                                        }}
                                                    >
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
                        <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
                            <div className="p-12 bg-primary/5 rounded-full mb-8">
                               <ListTree className="h-24 w-24 text-primary opacity-20" />
                            </div>
                            <h3 className="text-3xl font-black text-[#1e1b4b] tracking-tighter">اختر عنصراً من القائمة الرئيسية لعرض التفاصيل.</h3>
                        </div>
                    )}
                </Card>
            </div>

            <Dialog open={isPrimaryDialogOpen || isSecondaryDialogOpen} onOpenChange={closeDialog}>
                <DialogContent dir="rtl" className="max-w-xl rounded-[2.5rem] p-0 shadow-2xl border-none bg-white overflow-hidden">
                    <form onSubmit={(e) => { e.preventDefault(); handleSave(isPrimaryDialogOpen ? 'primary' : 'secondary'); }}>
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
                        </div>

                        <DialogFooter className="p-8 bg-muted/10 border-t flex gap-3">
                            <Button type="button" variant="outline" onClick={closeDialog} className="rounded-xl font-bold h-12 px-8">إلغاء</Button>
                            <Button type="submit" disabled={isSaving} className="rounded-xl font-black h-12 px-12 shadow-xl shadow-primary/30 min-w-[200px]">
                                {isSaving ? <Loader2 className="h-5 w-5 animate-spin"/> : <><Save className="ml-2 h-5 w-5"/> اعتماد الحفظ</>}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* 💡 مكون الـ AlertDialog الزجاجي المطور لحماية عمليات الحذف النهائي في المكون الموحد */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent dir="rtl" className="rounded-[2.5rem] border-none shadow-2xl p-10">
                    <AlertDialogHeader>
                        <div className="p-4 bg-red-100 text-red-600 rounded-2xl w-fit mb-4 shadow-inner"><Trash2 className="h-10 w-10"/></div>
                        <AlertDialogTitle className="text-2xl font-black text-red-700 tracking-tighter">تأكيد الحذف المعتمد؟</AlertDialogTitle>
                        <AlertDialogDescription className="text-lg font-bold text-slate-600 leading-relaxed mt-2">
                            سيتم مسح سجل <strong className="text-red-900">"{itemToDelete?.name}"</strong> نهائياً. هذا الإجراء لا يمكن التراجع عنه وسينعكس فوراً على قاعدة البيانات.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-8 gap-3">
                        <AlertDialogCancel onClick={() => { setItemToDelete(null); setIsDeleteDialogOpen(false); }} className="rounded-xl font-black h-12 px-8 border-2">
                            تراجع
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={isSaving} className="bg-red-600 hover:bg-red-700 rounded-xl font-black h-12 px-12 shadow-xl shadow-red-200">
                            {isSaving ? <Loader2 className="h-5 w-5 animate-spin"/> : 'نعم، تأكيد الحذف النهائي'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

        </div>
    );
}