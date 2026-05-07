
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
    collectionGroup, 
    where, 
    serverTimestamp, 
    deleteField, 
    limit 
} from 'firebase/firestore';
import type { 
    Department, 
    Job, 
    Governorate, 
    Area, 
    TransactionType, 
    WorkStage, 
    CompanyActivityType, 
    SubcontractorType, 
    Employee 
} from '@/lib/types';
import { 
    Card, 
    CardHeader, 
    CardTitle, 
    CardContent, 
    CardDescription, 
    CardFooter 
} from '@/components/ui/card';
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from '@/components/ui/table';
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
    DownloadCloud, Users, Construction, Search, 
    Minus, Building, FileText, Globe, Workflow, 
    ArrowRight, Clock, ShieldCheck, ListTree, Settings2,
    MapPin, Calculator, Briefcase
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import { cn, getTenantPath, cleanFirestoreData } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '../ui/badge';
import { MultiSelect, type MultiSelectOption } from '../ui/multi-select';
import { useAuth } from '@/context/auth-context';
import { defaultDepartments, defaultGovernorates, defaultAreas, defaultJobs } from '@/lib/default-reference-data';

// --- مساعدات العرض السيادي ---

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

// --- المكون الرئيسي للإدارة (Sovereign Manager View) ---
function ManagerView({
  primaryTitle,
  primarySingularTitle,
  primaryCollectionName,
  secondaryTitle,
  secondarySingularTitle,
  secondaryCollectionName,
  icon,
  onBack,
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
  headerGradient: string;
  iconColorClass: string;
}) {
  const { firestore } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const tenantId = user?.currentCompanyId;

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
  
  const [itemName, setItemName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);

  // 🛡️ محرك الجلب السيادي الموحد
  const fetchPrimaryItems = useCallback(async () => {
    if (!firestore || !tenantId) return;
    setLoadingPrimary(true);
    try {
        const path = getTenantPath(primaryCollectionName, tenantId);
        const snapshot = await getDocs(query(collection(firestore, path)));
        const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        items.sort((a: any, b: any) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name, 'ar'));
        setPrimaryItems(items);
    } catch (e) { console.error(e); } finally { setLoadingPrimary(false); }
  }, [firestore, tenantId, primaryCollectionName]);

  useEffect(() => { fetchPrimaryItems(); }, [fetchPrimaryItems]);
  
  const fetchSecondaryItems = useCallback(async () => {
    if (!selectedPrimary || !firestore || !secondaryCollectionName || !tenantId) {
        setSecondaryItems([]);
        return;
    }
    setLoadingSecondary(true);
    try {
        const path = getTenantPath(`${primaryCollectionName}/${selectedPrimary.id}/${secondaryCollectionName}`, tenantId);
        const snapshot = await getDocs(query(collection(firestore, path)));
        const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        items.sort((a: any, b: any) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name, 'ar'));
        setSecondaryItems(items);
    } catch (e) { console.error(e); } finally { setLoadingSecondary(false); }
  }, [selectedPrimary, firestore, tenantId, primaryCollectionName, secondaryCollectionName]);

  useEffect(() => { fetchSecondaryItems(); }, [fetchSecondaryItems]);

  const handleSave = async (type: 'primary' | 'secondary') => {
    if (!firestore || !itemName.trim() || !tenantId) return;
    
    setIsSaving(true);
    try {
      const baseSubPath = type === 'primary' 
        ? primaryCollectionName 
        : `${primaryCollectionName}/${selectedPrimary?.id}/${secondaryCollectionName}`;
      
      const path = getTenantPath(baseSubPath, tenantId);
      const dataToSave = { name: itemName, companyId: tenantId, updatedAt: serverTimestamp() };

      if (editingItem) {
        await updateDoc(doc(firestore, path, editingItem.id), dataToSave);
      } else {
        const currentList = type === 'primary' ? primaryItems : secondaryItems;
        await addDoc(collection(firestore, path), { ...dataToSave, order: currentList.length, createdAt: serverTimestamp() });
      }

      toast({ title: 'نجاح الحفظ', description: 'تم تحديث البيانات المرجعية بنجاح.' });
      if (type === 'primary') await fetchPrimaryItems(); else await fetchSecondaryItems();
      setIsPrimaryDialogOpen(false);
      setIsSecondaryDialogOpen(false);
      setEditingItem(null);
      setItemName('');
    } catch (e) { toast({ variant: 'destructive', title: 'خطأ في الحفظ' }); } finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
      if (!firestore || !itemToDelete || !tenantId) return;
      setIsSaving(true);
      try {
        const baseSubPath = itemToDelete.type === 'primary' 
            ? primaryCollectionName 
            : `${primaryCollectionName}/${selectedPrimary?.id}/${secondaryCollectionName}`;
        
        const path = getTenantPath(baseSubPath, tenantId);
        await deleteDoc(doc(firestore, path, itemToDelete.id));
        
        toast({ title: 'تم الحذف' });
        if (itemToDelete.type === 'primary') await fetchPrimaryItems(); else await fetchSecondaryItems();
      } catch (e) { toast({ variant: 'destructive', title: 'فشل الحذف' }); } finally { setIsSaving(false); setIsDeleteDialogOpen(false); setItemToDelete(null); }
  };

  const handleImportDefaults = async () => {
    if(!firestore || !tenantId) return;
    setIsImporting(true);
    try {
        const batch = writeBatch(firestore);
        
        if (primaryCollectionName === 'departments') {
            const deptPath = getTenantPath('departments', tenantId);
            for (const dept of defaultDepartments) {
                const newDeptRef = doc(collection(firestore, deptPath));
                batch.set(newDeptRef, { ...dept, companyId: tenantId });
                
                const jobsForDept = defaultJobs[dept.name as keyof typeof defaultJobs];
                if (jobsForDept && secondaryCollectionName === 'jobs') {
                    const jobsPath = `${newDeptRef.path}/jobs`;
                    for (const job of jobsForDept) {
                        batch.set(doc(collection(firestore, jobsPath)), { ...job, companyId: tenantId });
                    }
                }
            }
        } else if (primaryCollectionName === 'governorates') {
            const govPath = getTenantPath('governorates', tenantId);
            for (const gov of defaultGovernorates) {
                const newGovRef = doc(collection(firestore, govPath));
                batch.set(newGovRef, { ...gov, companyId: tenantId });
                
                const areasForGov = defaultAreas[gov.name as keyof typeof defaultAreas];
                if (areasForGov && secondaryCollectionName === 'areas') {
                    const areasPath = `${newGovRef.path}/areas`;
                    for (const area of areasForGov) {
                        batch.set(doc(collection(firestore, areasPath)), { ...area, companyId: tenantId });
                    }
                }
            }
        }
        await batch.commit();
        toast({ title: 'نجاح الاستيراد' });
        fetchPrimaryItems();
    } finally { setIsImporting(false); setIsImportConfirmOpen(false); }
  };

  return (
    <div className="space-y-6">
      <Card className={cn("rounded-[2.5rem] border-none shadow-sm overflow-hidden", headerGradient)}>
        <CardHeader className="pb-8 px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4">
              <div className={cn("p-3 rounded-2xl shadow-inner bg-white/20 text-white", iconColorClass)}>{icon}</div>
              <div className="text-white">
                <CardTitle className="text-3xl font-black">{primaryTitle}</CardTitle>
                <CardDescription className="text-white/80 font-medium mt-1">إدارة قوائم {primaryTitle} الخاصة بمنشأتك.</CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
                {(primaryCollectionName === 'departments' || primaryCollectionName === 'governorates') && (
                    <Button variant="ghost" size="sm" onClick={() => setIsImportConfirmOpen(true)} className="rounded-xl text-white hover:bg-white/10 border border-white/20">
                        {isImporting ? <Loader2 className="animate-spin h-4 w-4"/> : <DownloadCloud className="h-4 w-4 ml-2" />} استيراد القائمة الافتراضية
                    </Button>
                )}
                <Button onClick={onBack} variant="ghost" className="rounded-xl font-bold gap-2 text-white hover:bg-white/10">
                    <ArrowRight className="h-4 w-4" /> العودة للرئيسية
                </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white">
        <CardContent className="p-0">
            <div className="grid grid-cols-1 md:grid-cols-12 min-h-[500px]">
                {/* Sidebar (Primary List) */}
                <div className="md:col-span-4 border-l bg-slate-50/50 flex flex-col">
                    <div className="p-6 border-b flex justify-between items-center">
                        <Label className="font-black text-[#1e1b4b] text-base">{primarySingularTitle}</Label>
                        <Button size="icon" variant="ghost" onClick={() => { setEditingItem(null); setItemName(''); setIsPrimaryDialogOpen(true); }} className="h-9 w-9 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all"><Plus className="h-5 w-5" /></Button>
                    </div>
                    <ScrollArea className="flex-1 p-4">
                        {loadingPrimary ? <div className="space-y-2 p-4"><Skeleton className="h-10 w-full rounded-xl"/><Skeleton className="h-10 w-full rounded-xl"/></div> : 
                        primaryItems.length === 0 ? <p className="text-center p-10 text-muted-foreground italic text-xs font-bold">لا توجد سجلات بعد.</p> :
                        <div className="space-y-2">
                            {primaryItems.map(item => (
                                <div key={item.id} onClick={() => setSelectedPrimary(item)} className={cn("group flex items-center justify-between p-4 rounded-[1.5rem] cursor-pointer transition-all border-2", selectedPrimary?.id === item.id ? "bg-primary border-primary text-white shadow-lg" : "hover:bg-muted/50 bg-white border-transparent")}>
                                    <span className="font-black text-sm truncate">{item.name}</span>
                                    <div className={cn("flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity", selectedPrimary?.id === item.id && "opacity-100")}>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-white/20 text-current" onClick={(e) => { e.stopPropagation(); setEditingItem(item); setItemName(item.name); setIsPrimaryDialogOpen(true); }}><Pencil className="h-3.5 w-3.5"/></Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-red-100/20 text-current" onClick={(e) => { e.stopPropagation(); setItemToDelete({ id: item.id, name: item.name, type: 'primary' }); setIsDeleteDialogOpen(true); }}><Trash2 className="h-3.5 w-3.5"/></Button>
                                    </div>
                                </div>
                            ))}
                        </div>}
                    </ScrollArea>
                </div>

                {/* Content Area (Secondary List) */}
                <div className="md:col-span-8 flex flex-col">
                    {selectedPrimary ? (
                        <>
                            <div className="p-8 border-b bg-muted/5 flex justify-between items-center">
                                <div>
                                    <h3 className="text-2xl font-black text-[#1e1b4b]">{secondaryTitle}</h3>
                                    <p className="text-sm font-bold text-primary mt-1">التابعة لـ {primarySingularTitle}: <span className="underline">{selectedPrimary.name}</span></p>
                                </div>
                                {secondaryCollectionName && (
                                    <Button onClick={() => { setEditingItem(null); setItemName(''); setIsSecondaryDialogOpen(true); }} className="rounded-2xl font-black h-12 px-6 shadow-lg shadow-primary/20">
                                        <PlusCircle className="ml-2 h-5 w-5" /> إضافة {secondarySingularTitle} جديد
                                    </Button>
                                )}
                            </div>
                            <ScrollArea className="flex-1 p-8">
                                {loadingSecondary ? <div className="space-y-4"><Skeleton className="h-16 w-full rounded-2xl"/><Skeleton className="h-16 w-full rounded-2xl"/></div> :
                                secondaryItems.length === 0 ? <div className="h-64 flex flex-col items-center justify-center grayscale opacity-20"><PlusCircle className="h-16 w-16 mb-4"/><p className="font-black text-xl">لا توجد سجلات فرعية.</p></div> :
                                <div className="grid gap-4">
                                    {secondaryItems.map(item => (
                                        <div key={item.id} className="flex items-center justify-between p-6 border-2 border-slate-100 bg-white rounded-[1.8rem] hover:border-primary/20 hover:shadow-md transition-all group">
                                            <span className="font-black text-lg text-[#1e1b4b]">{item.name}</span>
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl bg-slate-50 border shadow-inner" onClick={() => { setEditingItem(item); setItemName(item.name); setIsSecondaryDialogOpen(true); }}><Pencil className="h-5 w-5"/></Button>
                                                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl bg-red-50 border border-red-100 text-red-600 hover:bg-red-600 hover:text-white transition-colors" onClick={() => { setItemToDelete({ id: item.id, name: item.name, type: 'secondary' }); setIsDeleteDialogOpen(true); }}><Trash2 className="h-5 w-5"/></Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>}
                            </ScrollArea>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-20 grayscale">
                            <ListTree className="h-24 w-24 mb-6 text-primary animate-pulse" />
                            <h3 className="text-2xl font-black text-[#1e1b4b]">اختر {primarySingularTitle}</h3>
                            <p className="font-bold mt-2 text-lg">يرجى الاختيار من القائمة الجانبية لإدارة البيانات التابعة.</p>
                        </div>
                    )}
                </div>
            </div>
        </CardContent>
      </Card>

      {/* --- Dialogs --- */}
      <Dialog open={isPrimaryDialogOpen || isSecondaryDialogOpen} onOpenChange={closeDialog}>
        <DialogContent dir="rtl" className="max-w-md rounded-[2.5rem] p-8 shadow-2xl border-none">
            <DialogHeader>
                <DialogTitle className="text-2xl font-black text-[#1e1b4b]">
                    {editingItem ? 'تعديل' : 'إضافة'} {isPrimaryDialogOpen ? primarySingularTitle : secondarySingularTitle}
                </DialogTitle>
                <DialogDescription className="font-bold">أدخل الاسم الجديد وسيتم حفظه في سجلات منشأتك.</DialogDescription>
            </DialogHeader>
            <div className="py-8">
                <Label className="font-black text-[#1e1b4b] pr-1 block mb-2">الاسم الرسمي *</Label>
                <Input value={itemName} onChange={e => setItemName(e.target.value)} required className="h-12 rounded-2xl border-2 text-lg font-black shadow-inner" placeholder="اكتب هنا..." />
            </div>
            <DialogFooter className="gap-3">
                <Button variant="ghost" onClick={closeDialog} disabled={isSaving} className="rounded-xl font-bold h-12 px-8">إلغاء</Button>
                <Button onClick={() => handleSave(isPrimaryDialogOpen ? 'primary' : 'secondary')} disabled={isSaving || !itemName.trim()} className="rounded-xl font-black h-12 px-12 gap-2 shadow-xl shadow-primary/20">
                    {isSaving ? <Loader2 className="animate-spin h-5 w-5"/> : <Save className="h-5 w-5"/>} حفظ البيانات
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={() => setIsDeleteDialogOpen(false)}>
        <AlertDialogContent dir="rtl" className="rounded-3xl border-none shadow-2xl">
            <AlertDialogHeader>
                <AlertDialogTitle className="text-xl font-black text-red-700">تأكيد الحذف النهائي؟</AlertDialogTitle>
                <AlertDialogDescription className="text-base font-medium">سيتم مسح سجل "{itemToDelete?.name}" من النظام تماماً. لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
                <AlertDialogCancel className="rounded-xl font-bold">تراجع</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={isSaving} className="bg-red-600 hover:bg-red-700 rounded-xl font-black px-10">
                    {isSaving ? <Loader2 className="animate-spin h-4 w-4"/> : 'نعم، حذف'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isImportConfirmOpen} onOpenChange={setIsImportConfirmOpen}>
        <AlertDialogContent dir="rtl" className="rounded-3xl border-none shadow-2xl">
            <AlertDialogHeader>
                <AlertDialogTitle className="text-xl font-black text-primary">استيراد القائمة الافتراضية؟</AlertDialogTitle>
                <AlertDialogDescription className="text-base font-medium leading-relaxed">هذا الإجراء سيقوم بـ <strong>تصفير كافة البيانات الحالية</strong> لـ {primaryTitle} واستبدالها بالقائمة القياسية لنظام Nova ERP.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
                <AlertDialogCancel className="rounded-xl font-bold">إلغاء</AlertDialogCancel>
                <AlertDialogAction onClick={handleImportDefaults} disabled={isImporting} className="bg-primary hover:bg-primary/90 rounded-xl font-black px-10 shadow-lg shadow-primary/20">
                    {isImporting ? <Loader2 className="animate-spin h-4 w-4"/> : 'نعم، استبدال الآن'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function ReferenceDataManager() {
    const [view, setView] = useState<'main' | 'departments' | 'locations' | 'transactions'>('main');

    if (view === 'departments') {
        return (
            <ManagerView
                primaryTitle="إدارة الأقسام والوظائف"
                primarySingularTitle="القسم"
                primaryCollectionName="departments"
                secondaryTitle="الوظائف والمسميات"
                secondarySingularTitle="الوظيفة"
                secondaryCollectionName="jobs"
                icon={<Building className="h-8 w-8" />}
                onBack={() => setView('main')}
                headerGradient="bg-gradient-to-l from-[#1e1b4b] to-blue-600"
                iconColorClass="text-blue-200"
            />
        );
    }

    if (view === 'locations') {
        return (
            <ManagerView
                primaryTitle="إدارة المواقع والمناطق"
                primarySingularTitle="المحافظة"
                primaryCollectionName="governorates"
                secondaryTitle="المناطق السكنية"
                secondarySingularTitle="المنطقة"
                secondaryCollectionName="areas"
                icon={<Globe className="h-8 w-8" />}
                onBack={() => setView('main')}
                headerGradient="bg-gradient-to-l from-[#1e1b4b] to-emerald-600"
                iconColorClass="text-emerald-200"
            />
        );
    }

    if (view === 'transactions') {
        return (
            <ManagerView
                primaryTitle="أنواع المعاملات والخدمات"
                primarySingularTitle="نوع المعاملة"
                primaryCollectionName="transactionTypes"
                icon={<Workflow className="h-8 w-8" />}
                onBack={() => setView('main')}
                headerGradient="bg-gradient-to-l from-[#1e1b4b] to-purple-600"
                iconColorClass="text-purple-200"
            />
        );
    }

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
                            <CardDescription className="text-base font-medium">تخصيص القوائم المنسدلة وهيكل العمل الفني لمنشأتك.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard 
                    title="الأقسام والوظائف" 
                    count={0} 
                    icon={<Building className="h-6 w-6"/>} 
                    onNavigate={() => setView('departments')}
                    colorClass="bg-blue-100 text-blue-600"
                    loading={false}
                />
                <StatCard 
                    title="المواقع والمناطق" 
                    count={0} 
                    icon={<Globe className="h-6 w-6"/>} 
                    onNavigate={() => setView('locations')}
                    colorClass="bg-emerald-100 text-emerald-600"
                    loading={false}
                />
                <StatCard 
                    title="أنواع المعاملات" 
                    count={0} 
                    icon={<Workflow className="h-6 w-6"/>} 
                    onNavigate={() => setView('transactions')}
                    colorClass="bg-purple-100 text-purple-600"
                    loading={false}
                />
            </div>
        </div>
    );
}

