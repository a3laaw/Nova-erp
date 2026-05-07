'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
    where, 
    serverTimestamp,
    collectionGroup
} from 'firebase/firestore';
import type { 
    Department, 
    Job, 
    Governorate, 
    Area, 
    TransactionType, 
    WorkStage,
} from '@/lib/types';
import { 
    Card, 
    CardHeader, 
    CardTitle, 
    CardContent, 
    CardDescription, 
    CardFooter 
} from '@/components/ui/card';
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
import { 
    Plus, Pencil, Trash2, Loader2, Save, PlusCircle, 
    DownloadCloud, Building2, Globe, Workflow, 
    ArrowRight, ListTree, Settings2,
    MapPin, Briefcase, ChevronLeft, X
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import { cn, getTenantPath, cleanFirestoreData } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { defaultDepartments, defaultGovernorates, defaultAreas, defaultJobs, defaultWorkStages } from '@/lib/default-reference-data';

function StatCard({ title, count, icon, onNavigate, colorClass, loading }: { title: string, count: number, icon: React.ReactNode, onNavigate: () => void, colorClass: string, loading: boolean }) {
    return (
        <Card 
            onClick={onNavigate} 
            className="group cursor-pointer border-none shadow-sm rounded-3xl bg-white hover-lift overflow-hidden"
        >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-black text-slate-500 uppercase tracking-widest">{title}</CardTitle>
                <div className={cn("p-2 rounded-xl transition-colors shadow-inner", colorClass)}>{icon}</div>
            </CardHeader>
            <CardContent>
                {loading ? <Skeleton className="h-8 w-12 mt-1" /> : <div className="text-3xl font-black font-mono tracking-tighter text-[#1e1b4b]">{count}</div>}
                <div className="flex items-center gap-1 text-[10px] text-primary font-bold mt-2 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0">
                    فتح الإعدادات <ArrowRight className="h-2 w-2"/>
                </div>
            </CardContent>
        </Card>
    );
}

export function ReferenceDataManager() {
    const { firestore } = useFirebase();
    const { user } = useAuth();
    const { toast } = useToast();
    const tenantId = user?.currentCompanyId;

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

    const primaryCollection = useMemo(() => {
        if (view === 'departments') return 'departments';
        if (view === 'locations') return 'governorates';
        if (view === 'transactions') return 'transactionTypes';
        return '';
    }, [view]);

    const secondaryCollection = useMemo(() => {
        if (view === 'departments') return activeSubTab === 'jobs' ? 'jobs' : 'workStages';
        if (view === 'locations') return 'areas';
        return '';
    }, [view, activeSubTab]);

    const { data: primaryItems, loading: loadingPrimary } = useSubscription<any>(firestore, primaryCollection || null, [orderBy('name')]);
    
    const secondaryPath = useMemo(() => {
        if (!selectedPrimaryId || !primaryCollection || !secondaryCollection) return null;
        return `${primaryCollection}/${selectedPrimaryId}/${secondaryCollection}`;
    }, [selectedPrimaryId, primaryCollection, secondaryCollection]);
    
    const { data: secondaryItems, loading: loadingSecondary } = useSubscription<any>(firestore, secondaryPath, [orderBy('name')]);

    const selectedPrimary = useMemo(() => primaryItems.find(i => i.id === selectedPrimaryId), [primaryItems, selectedPrimaryId]);

    const closeDialog = () => {
        setIsPrimaryDialogOpen(false);
        setIsSecondaryDialogOpen(false);
        setEditingItem(null);
        setItemName('');
    };

    const handleSave = async (type: 'primary' | 'secondary') => {
        if (!firestore || !tenantId || !itemName.trim()) return;
        setIsSaving(true);
        try {
            const path = type === 'primary' ? primaryCollection : secondaryPath!;
            const dataToSave = cleanFirestoreData({
                name: itemName,
                companyId: tenantId,
                updatedAt: serverTimestamp()
            });

            if (editingItem) {
                await updateDoc(doc(firestore, getTenantPath(path, tenantId), editingItem.id), dataToSave);
            } else {
                await addDoc(collection(firestore, getTenantPath(path, tenantId)), {
                    ...dataToSave,
                    createdAt: serverTimestamp(),
                    order: (type === 'primary' ? primaryItems.length : secondaryItems.length) + 1
                });
            }
            toast({ title: 'نجاح الحفظ' });
            closeDialog();
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ في الحفظ' });
        } finally { setIsSaving(false); }
    };

    const handleDelete = async () => {
        if (!firestore || !itemToDelete || !tenantId) return;
        setIsSaving(true);
        try {
            const path = itemToDelete.type === 'primary' ? primaryCollection : secondaryPath!;
            await deleteDoc(doc(firestore, getTenantPath(path, tenantId), itemToDelete.id));
            toast({ title: 'تم الحذف' });
            setIsDeleteDialogOpen(false);
            setItemToDelete(null);
        } catch (e) {
            toast({ variant: 'destructive', title: 'فشل الحذف' });
        } finally { setIsSaving(false); }
    };

    const handleImportDefaults = async () => {
        if (!firestore || !tenantId) return;
        setIsImporting(true);
        try {
            const batch = writeBatch(firestore);
            if (view === 'departments') {
                for (const dept of defaultDepartments) {
                    const deptRef = doc(collection(firestore, getTenantPath('departments', tenantId)));
                    batch.set(deptRef, { ...dept, companyId: tenantId, createdAt: serverTimestamp() });
                }
            } else if (view === 'locations') {
                for (const gov of defaultGovernorates) {
                    const govRef = doc(collection(firestore, getTenantPath('governorates', tenantId)));
                    batch.set(govRef, { ...gov, companyId: tenantId, createdAt: serverTimestamp() });
                }
            }
            await batch.commit();
            toast({ title: 'نجاح الاستيراد' });
            setIsImportConfirmOpen(false);
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ في الاستيراد' });
        } finally { setIsImporting(false); }
    };

    if (view === 'main') {
        return (
            <div className="space-y-8" dir="rtl">
                <Card className="rounded-[2.5rem] border-none shadow-sm bg-gradient-to-l from-white to-purple-50">
                    <CardHeader className="pb-8 px-8 border-b">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner">
                                <Settings2 className="h-8 w-8" />
                            </div>
                            <div>
                                <CardTitle className="text-3xl font-black text-[#1e1b4b]">إدارة البيانات المرجعية</CardTitle>
                                <CardDescription className="text-base font-medium">تخصيص القوائم المنسدلة وهيكل العمل الفني للمنشأة.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <StatCard title="الأقسام والوظائف" count={primaryItems?.length || 0} icon={<Building2 className="h-6 w-6"/>} onNavigate={() => { setView('departments'); setActiveSubTab('jobs'); }} colorClass="bg-blue-100 text-blue-600" loading={loadingPrimary} />
                    <StatCard title="المواقع والمناطق" count={primaryItems?.length || 0} icon={<Globe className="h-6 w-6"/>} onNavigate={() => { setView('locations'); setActiveSubTab('areas'); }} colorClass="bg-emerald-100 text-emerald-600" loading={loadingPrimary} />
                    <StatCard title="أنواع المعاملات" count={primaryItems?.length || 0} icon={<Workflow className="h-6 w-6"/>} onNavigate={() => setView('transactions')} colorClass="bg-purple-100 text-purple-600" loading={loadingPrimary} />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-sm bg-[#1e1b4b] overflow-hidden">
                <CardHeader className="p-8">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/10 rounded-2xl text-white border border-white/20">
                                {view === 'departments' ? <Building2 className="h-8 w-8" /> : view === 'locations' ? <MapPin className="h-8 w-8" /> : <Workflow className="h-8 w-8" />}
                            </div>
                            <div className="text-white text-right">
                                <CardTitle className="text-2xl font-black">{view === 'departments' ? 'الأقسام والوظائف' : view === 'locations' ? 'المحافظات والمناطق' : 'أنواع الخدمات'}</CardTitle>
                                <CardDescription className="text-white/60 font-bold">إدارة الهيكل المرجعي الداخلي للمنشأة.</CardDescription>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="ghost" onClick={() => setIsImportConfirmOpen(true)} className="text-white hover:bg-white/10 border border-white/20 rounded-xl">
                                <DownloadCloud className="h-4 w-4 ml-2"/> استيراد الافتراضي
                            </Button>
                            <Button onClick={() => setView('main')} variant="ghost" className="text-white hover:bg-white/10 rounded-xl font-black gap-2">
                                <ArrowRight className="h-4 w-4" /> العودة للملخص
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white">
                <CardContent className="p-0">
                    <div className="grid grid-cols-1 md:grid-cols-12 min-h-[500px]">
                        <div className="md:col-span-4 border-l bg-slate-50/50 flex flex-col">
                            <div className="p-6 border-b flex justify-between items-center">
                                <Label className="font-black text-[#1e1b4b] text-base">{view === 'departments' ? 'القسم الفني' : 'المحافظة'}</Label>
                                <Button size="icon" variant="ghost" onClick={() => { setEditingItem(null); setItemName(''); setIsPrimaryDialogOpen(true); }} className="h-9 w-9 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all"><Plus className="h-5 w-5" /></Button>
                            </div>
                            <ScrollArea className="flex-1 p-4">
                                {loadingPrimary ? <div className="space-y-2 p-4"><Skeleton className="h-10 w-full rounded-xl"/><Skeleton className="h-10 w-full rounded-xl"/></div> : 
                                primaryItems.length === 0 ? <p className="text-center p-10 text-muted-foreground italic text-xs font-bold">لا توجد سجلات بعد.</p> :
                                <div className="space-y-2">
                                    {primaryItems.map(item => (
                                        <div key={item.id} onClick={() => setSelectedPrimaryId(item.id)} className={cn("group flex items-center justify-between p-4 rounded-[1.5rem] cursor-pointer transition-all border-2", selectedPrimaryId === item.id ? "bg-primary border-primary text-white shadow-lg" : "hover:bg-muted/50 bg-white border-transparent")}>
                                            <span className="font-black text-sm truncate">{item.name}</span>
                                            <div className={cn("flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity", selectedPrimaryId === item.id && "opacity-100")}>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-white/20 text-current" onClick={(e) => { e.stopPropagation(); setEditingItem(item); setItemName(item.name); setIsPrimaryDialogOpen(true); }}><Pencil className="h-3.5 w-3.5"/></Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-red-100/20 text-current" onClick={(e) => { e.stopPropagation(); setItemToDelete({ id: item.id, name: item.name, type: 'primary' }); setIsDeleteDialogOpen(true); }}><Trash2 className="h-3.5 w-3.5"/></Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>}
                            </ScrollArea>
                        </div>

                        <div className="md:col-span-8 flex flex-col">
                            {selectedPrimaryId ? (
                                <>
                                    <div className="p-6 border-b bg-muted/5">
                                        <div className="flex justify-between items-center mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-primary/10 rounded-xl"><ListTree className="h-5 w-5 text-primary"/></div>
                                                <h3 className="text-xl font-black text-[#1e1b4b]">{selectedPrimary?.name}</h3>
                                            </div>
                                            <Button onClick={() => { setEditingItem(null); setItemName(''); setIsSecondaryDialogOpen(true); }} className="rounded-xl font-black h-10 px-6">
                                                <PlusCircle className="ml-2 h-4 w-4" /> إضافة جديد
                                            </Button>
                                        </div>
                                        {view === 'departments' && (
                                            <Tabs value={activeSubTab} onValueChange={(v: any) => setActiveSubTab(v)} className="w-full">
                                                <TabsList className="bg-white/50 border h-11 p-1 rounded-xl">
                                                    <TabsTrigger value="jobs" className="rounded-lg gap-2 font-bold px-8">الوظائف</TabsTrigger>
                                                    <TabsTrigger value="stages" className="rounded-lg gap-2 font-bold px-8">مراحل العمل</TabsTrigger>
                                                </TabsList>
                                            </Tabs>
                                        )}
                                    </div>
                                    <ScrollArea className="flex-1 p-8">
                                        {loadingSecondary ? <div className="space-y-4"><Skeleton className="h-16 w-full rounded-2xl"/></div> :
                                        secondaryItems.length === 0 ? <div className="h-64 flex flex-col items-center justify-center grayscale opacity-20"><PlusCircle className="h-16 w-16 mb-4"/><p className="font-black text-xl">لا توجد سجلات فرعية.</p></div> :
                                        <div className="grid gap-4">
                                            {secondaryItems.map(item => (
                                                <div key={item.id} className="flex items-center justify-between p-6 border-2 border-slate-100 bg-white rounded-[1.8rem] hover:border-primary/20 transition-all group">
                                                    <span className="font-black text-lg text-[#1e1b4b]">{item.name}</span>
                                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl border" onClick={() => { setEditingItem(item); setItemName(item.name); setIsSecondaryDialogOpen(true); }}><Pencil className="h-5 w-5"/></Button>
                                                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl text-red-600 border" onClick={() => { setItemToDelete({ id: item.id, name: item.name, type: 'secondary' }); setIsDeleteDialogOpen(true); }}><Trash2 className="h-5 w-5"/></Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>}
                                    </ScrollArea>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-20 grayscale">
                                    <ListTree className="h-24 w-24 mb-6 text-primary animate-pulse" />
                                    <h3 className="text-2xl font-black text-[#1e1b4b]">اختر تصنيفاً</h3>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isPrimaryDialogOpen || isSecondaryDialogOpen} onOpenChange={closeDialog}>
                <DialogContent dir="rtl" className="max-w-md rounded-[2.5rem] p-8 shadow-2xl border-none">
                    <DialogHeader><DialogTitle className="text-2xl font-black text-[#1e1b4b]">{editingItem ? 'تعديل' : 'إضافة'} سجل</DialogTitle></DialogHeader>
                    <div className="py-8">
                        <Label className="font-black text-[#1e1b4b] pr-1 block mb-2">الاسم الرسمي *</Label>
                        <Input value={itemName} onChange={e => setItemName(e.target.value)} required className="h-12 rounded-2xl border-2 text-lg font-black" />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={closeDialog} className="rounded-xl font-bold h-12 px-8">إلغاء</Button>
                        <Button onClick={() => handleSave(isPrimaryDialogOpen ? 'primary' : 'secondary')} disabled={isSaving} className="rounded-xl font-black h-12 px-12">حفظ</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent dir="rtl" className="rounded-3xl border-none shadow-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-black text-red-700">تأكيد الحذف النهائي؟</AlertDialogTitle>
                        <AlertDialogDescription className="text-base font-medium">سيتم مسح سجل "{itemToDelete?.name}" تماماً.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="rounded-xl font-bold">تراجع</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={isSaving} className="bg-red-600 rounded-xl font-black px-10">
                            {isSaving ? <Loader2 className="animate-spin h-4 w-4"/> : 'نعم، حذف'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}