'use client';

import { useState, useMemo, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirebase, useSubscription } from '@/firebase';
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    orderBy, 
    doc, 
    runTransaction, 
    serverTimestamp, 
    getDoc, 
    Timestamp, 
    limit 
} from 'firebase/firestore';
import type { Client, ClientTransaction, Account, Employee, Department, ContractTemplate, TransactionType } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { 
    FileSignature, 
    User, 
    ArrowRight, 
    Loader2, 
    Calculator,
    LayoutGrid,
    Trash2,
    Sparkles,
    Target,
    ShieldCheck,
    PlusCircle,
    Ruler,
    Building2,
    Workflow,
    Save,
    Home
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { formatCurrency, cleanFirestoreData, cn, getTenantPath } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const generateId = () => Math.random().toString(36).substring(2, 9);
const arabicOrdinals = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة'];

const contractSchema = z.object({
  clientId: z.string().min(1, 'العميل مطلوب.'),
  transactionId: z.string().min(1, 'المعاملة مطلوبة.'),
  totalArea: z.preprocess((v) => v === '' ? undefined : parseFloat(String(v)), z.number().min(0).optional()),
  floorsCount: z.preprocess((v) => v === '' ? undefined : parseInt(String(v), 10), z.number().min(1).optional()),
  basementType: z.enum(['none', 'full', 'half', 'vault']).default('none'),
  roofExtension: z.enum(['none', 'quarter', 'half']).default('none'),
  workNature: z.enum(['labor_only', 'with_materials']).default('labor_only'),
  clauses: z.array(z.object({
    id: z.string(),
    name: z.string().min(1, "وصف الدفعة مطلوب."),
    condition: z.string().min(1, "شرط الاستحقاق مطلوب."),
    amount: z.preprocess((a) => a === '' ? undefined : parseFloat(String(a)), z.number().min(0, "المبلغ مطلوب.").optional()),
    percentage: z.number().optional(),
  })).min(1, 'يجب وجود دفعة واحدة على الأقل.'),
  financialsType: z.enum(['fixed', 'percentage']).default('fixed'),
  totalAmount: z.preprocess((a) => a === '' ? undefined : parseFloat(String(a)), z.number().min(0).optional()),
});

type ContractValues = z.infer<typeof contractSchema>;

function DirectContractContent() {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();

    const tenantId = currentUser?.currentCompanyId;
    const [isSaving, setIsSaving] = useState(false);
    const savingRef = useRef(false);
    const [importedTemplateId, setImportedTemplateId] = useState('');

    const { register, handleSubmit, control, setValue, watch, reset, formState: { errors } } = useForm<ContractValues>({
        resolver: zodResolver(contractSchema),
        defaultValues: {
            clientId: searchParams.get('clientId') || '',
            transactionId: searchParams.get('transactionId') || '',
            totalArea: undefined, 
            floorsCount: undefined, 
            basementType: 'none', 
            roofExtension: 'none', 
            workNature: 'labor_only',
            financialsType: 'fixed',
            clauses: [{ id: generateId(), name: 'الدفعة الأولى عند توقيع العقد', condition: 'عند توقيع العقد', amount: undefined }]
        }
    });

    const { fields, append, remove, replace: replaceClauses } = useFieldArray({ control, name: 'clauses' });
    
    const currentClientId = watch('clientId');
    const currentTransactionId = watch('transactionId');
    const watchedClauses = watch('clauses');
    const financialsType = watch('financialsType');

    const currentTotalCalculated = useMemo(() => {
        const items = watchedClauses || [];
        if (financialsType === 'fixed') {
            return items.reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0);
        } else {
            return items.reduce((sum: number, c: any) => sum + (Number(c.percentage || c.value) || 0), 0);
        }
    }, [watchedClauses, financialsType]);

    const { data: allClients } = useSubscription<Client>(firestore, tenantId ? 'clients' : null);
    const { data: templates } = useSubscription<ContractTemplate>(firestore, tenantId ? 'contractTemplates' : null, [orderBy('title')]);
    const { data: accounts = [] } = useSubscription<Account>(firestore, tenantId ? 'chartOfAccounts' : null);
    const { data: employees = [] } = useSubscription<Employee>(firestore, 'employees');
    const { data: departments = [] } = useSubscription<Department>(firestore, 'departments');
    const { data: transactionTypesData = [] } = useSubscription<TransactionType>(firestore, 'transactionTypes');

    const [clientTransactions, setClientTransactions] = useState<ClientTransaction[]>([]);
    const [txLoading, setTxLoading] = useState(false);

    useEffect(() => {
        if (!firestore || !currentClientId || !tenantId) {
            setClientTransactions([]);
            return;
        }
        setTxLoading(true);
        const txPath = getTenantPath(`clients/${currentClientId}/transactions`, tenantId);
        getDocs(query(collection(firestore, txPath!), where('status', 'in', ['new', 'in-progress']))).then(snap => {
            const availableTxs = snap.docs
                .map(d => ({ id: d.id, ...d.data() } as ClientTransaction))
                .filter(tx => !tx.contract); 
            setClientTransactions(availableTxs);
        }).finally(() => setTxLoading(false));
    }, [currentClientId, firestore, tenantId]);

    const showWorkNature = useMemo(() => {
        const selectedTx = clientTransactions.find(t => t.id === currentTransactionId);
        if (!selectedTx || !transactionTypesData) return false;
        const type = transactionTypesData.find(t => t.id === selectedTx.transactionTypeId);
        return type?.activityType === 'construction';
    }, [clientTransactions, currentTransactionId, transactionTypesData]);

    const handleTemplateSelect = (templateId: string) => {
        const template = templates.find(t => t.id === templateId);
        if (!template) return;
        
        setImportedTemplateId(templateId);
        setValue('workNature', template.workNature || 'labor_only');
        setValue('financialsType', template.financials?.type || 'fixed');
        setValue('totalAmount', template.financials?.totalAmount || 0);
        
        if (template.financials?.milestones) {
            const newClauses = template.financials.milestones.map((m, idx) => ({
                id: generateId(),
                name: m.name || `الدفعة ${arabicOrdinals[idx] || (idx + 1)}`,
                condition: m.condition || '',
                amount: template.financials?.type === 'fixed' ? Number(m.value) : undefined,
                percentage: template.financials?.type === 'percentage' ? Number(m.value) : 0,
            }));
            replaceClauses(newClauses as any);
        }
        toast({ title: '✅ تم استيراد هيكل العقد' });
    };

    const onSubmit = async (data: ContractValues) => {
        if (!firestore || !currentUser || !tenantId || savingRef.current) return;
        
        const totalToSave = financialsType === 'fixed' ? currentTotalCalculated : (data.totalAmount || 0);
        if (financialsType === 'percentage' && currentTotalCalculated !== 100) {
            toast({ variant: 'destructive', title: 'خطأ في النسب', description: 'مجموع نسب الدفعات يجب أن يكون 100%.' });
            return;
        }

        savingRef.current = true;
        setIsSaving(true);

        try {
            await runTransaction(firestore, async (transaction_fs) => {
                const currentYear = new Date().getFullYear();
                const selectedClient = allClients.find(c => c.id === data.clientId)!;
                const selectedTx = clientTransactions.find(t => t.id === data.transactionId)!;

                const coaPath = getTenantPath('chartOfAccounts', tenantId)!;
                const revenueAccSnap = await getDocs(query(collection(firestore, coaPath), where('code', '==', '4101'), limit(1)));
                const clientAccSnap = await getDocs(query(collection(firestore, coaPath), where('name', '==', selectedClient.nameAr), where('parentCode', '==', '1102'), limit(1)));

                let clientAccountId = '';
                if (clientAccSnap.empty) {
                    const coaSubCounterRef = doc(firestore, getTenantPath('counters/coa_clients', tenantId)!);
                    const coaSubSnap = await transaction_fs.get(coaSubCounterRef);
                    const nextClientNum = (coaSubSnap.data()?.lastNumber || 0) + 1;
                    const clientCode = `1102C${String(nextClientNum).padStart(4, '0')}`;
                    const newAccRef = doc(collection(firestore, coaPath));
                    clientAccountId = newAccRef.id;
                    transaction_fs.set(newAccRef, {
                        code: clientCode, name: selectedClient.nameAr, type: 'asset', level: 3,
                        parentCode: '1102', isPayable: true, statement: 'Balance Sheet', balanceType: 'Debit',
                        companyId: tenantId, createdAt: serverTimestamp()
                    });
                    transaction_fs.set(coaSubCounterRef, { lastNumber: nextClientNum }, { merge: true });
                } else {
                    clientAccountId = clientAccSnap.docs[0].id;
                }

                const txPath = getTenantPath(`clients/${data.clientId}/transactions/${data.transactionId}`, tenantId);
                const txRef = doc(firestore, txPath!);
                
                const finalClauses = data.clauses.map((c: any) => {
                    const amount = financialsType === 'percentage' ? (c.percentage / 100) * (data.totalAmount || 0) : (c.amount || 0);
                    return { ...c, amount, status: 'غير مستحقة', percentage: c.percentage || 0 };
                });

                transaction_fs.update(txRef, {
                    status: 'in-progress',
                    contract: cleanFirestoreData({
                        clauses: finalClauses,
                        totalAmount: totalToSave,
                        financialsType: data.financialsType,
                        specs: { 
                            totalArea: data.totalArea || 0, 
                            floorsCount: data.floorsCount || 1, 
                            basementType: data.basementType, 
                            roofExtension: data.roofExtension, 
                            workNature: showWorkNature ? data.workNature : 'consulting' 
                        }
                    }),
                    updatedAt: serverTimestamp()
                });

                const jeCounterRef = doc(firestore, getTenantPath('counters/journalEntries', tenantId)!);
                const jeCounterDoc = await transaction_fs.get(jeCounterRef);
                const nextJeNum = ((jeCounterDoc.data()?.counts || {})[currentYear] || 0) + 1;
                const newJeRef = doc(collection(firestore, getTenantPath('journalEntries', tenantId)!));

                transaction_fs.set(newJeRef, cleanFirestoreData({
                    entryNumber: `JV-PR-${currentYear}-${String(nextJeNum).padStart(4, '0')}`,
                    date: serverTimestamp(), 
                    narration: `[إثبات مديونية عقد] ${selectedTx.subServiceName || selectedTx.transactionType} لـ ${selectedClient.nameAr}`,
                    totalDebit: totalToSave, totalCredit: totalToSave, status: 'draft',
                    lines: [
                        { accountId: clientAccountId, accountName: selectedClient.nameAr, debit: totalToSave, credit: 0, auto_profit_center: data.transactionId },
                        { accountId: revenueAccSnap.docs[0]?.id || '4101', accountName: revenueAccSnap.docs[0]?.data()?.name || 'إيرادات عقود', debit: 0, credit: totalToSave, auto_profit_center: data.transactionId }
                    ],
                    clientId: data.clientId, transactionId: data.transactionId, createdAt: serverTimestamp(), createdBy: currentUser.id, companyId: tenantId
                }));

                transaction_fs.set(jeCounterRef, { [`counts.${currentYear}`]: nextJeNum }, { merge: true });
                transaction_fs.update(doc(firestore, getTenantPath(`clients/${data.clientId}`, tenantId)!), { status: 'contracted' });
            });

            toast({ title: '✅ تم توقيع العقد بنجاح' });
            router.push(`/dashboard/clients/${data.clientId}`);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'فشل التوقيع', description: e.message });
            setIsSaving(false);
            savingRef.current = false;
        }
    };

    const clientOptions = useMemo(() => (allClients || []).filter(c => c.isActive !== false).map(c => ({ value: c.id!, label: c.nameAr })), [allClients]);
    const transactionOptions = useMemo(() => clientTransactions.map(t => ({ value: t.id!, label: t.subServiceName ? `${t.subServiceName} (${t.transactionType})` : t.transactionType })), [clientTransactions]);
    const templateOptions = useMemo(() => (templates || []).map(t => ({ value: t.id!, label: t.title })), [templates]);

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-gradient-to-r from-[#FF7A00] to-[#FFB000] text-white relative">
                <div className="absolute top-0 right-0 w-80 h-full bg-white/10 -skew-x-12 transform translate-x-32 pointer-events-none" />
                <CardHeader className="p-10 relative z-10">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                        <div className="flex items-center gap-6">
                            <div className="p-5 bg-white/20 rounded-[2rem] backdrop-blur-xl border border-white/40 shadow-2xl">
                                <FileSignature className="h-10 w-10 text-white" />
                            </div>
                            <div className="text-right">
                                <CardTitle className="text-3xl font-black text-white tracking-tighter">توقيع العقد المباشر</CardTitle>
                                <CardDescription className="text-white/90 font-bold text-sm">اعتماد المسار القانوني والمالي للخدمة المختارة آلياً.</CardDescription>
                            </div>
                        </div>
                        <Button onClick={() => router.back()} variant="outline" className="h-12 px-8 rounded-2xl font-black gap-2 bg-white/10 text-white border-white/40 hover:bg-white/20">
                            <ArrowRight className="h-5 w-5" /> تراجع
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <form onSubmit={handleSubmit(onSubmit)}>
                <Card className="rounded-[3rem] border-none shadow-xl overflow-hidden bg-white/95">
                    <CardContent className="p-10 space-y-10">
                        {/* Section 1: Client & Transaction Selection */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="grid gap-3">
                                <Label className="font-black text-[11px] uppercase text-slate-400 tracking-widest pr-2 flex items-center gap-2">
                                    <User className="h-3 w-3 text-[#FF7A00]"/> المالك / العميل المستهدف *
                                </Label>
                                <Controller control={control} name="clientId" render={({ field }) => (
                                    <InlineSearchList value={field.value} onSelect={field.onChange} options={clientOptions} placeholder="ابحث عن عميل..." className="h-14 rounded-2xl border-2" />
                                )} />
                            </div>
                            <div className="grid gap-3">
                                <Label className="font-black text-[11px] uppercase text-slate-400 tracking-widest pr-2 flex items-center gap-2">
                                    <LayoutGrid className="h-3 w-3 text-[#FF7A00]"/> الخدمة / المعاملة المطلوبة *
                                </Label>
                                <Controller control={control} name="transactionId" render={({ field }) => (
                                    <InlineSearchList 
                                        value={field.value} 
                                        onSelect={field.onChange} 
                                        options={transactionOptions} 
                                        placeholder={!currentClientId ? "اختر عميلاً أولاً" : txLoading ? "جاري التحميل..." : "اختر المعاملة..."} 
                                        disabled={!currentClientId || txLoading} 
                                        className="h-14 rounded-2xl border-2" 
                                    />
                                )} />
                            </div>
                        </div>

                        <Separator className="opacity-10" />

                        {/* Section 2: Unified Specs & Template Import */}
                        <div className="space-y-8">
                            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                                <h3 className="font-black text-xl text-[#1e1b4b] border-r-8 border-indigo-600 pr-4">مواصفات وقالب العقد</h3>
                                <div className="grid gap-3 w-full md:w-80 no-print">
                                    <Label className="font-black text-[11px] uppercase text-primary tracking-widest pr-2 flex items-center gap-2">
                                        <Sparkles className="h-4 w-4 animate-pulse"/> استيراد مصفوفة دفعات جاهزة
                                    </Label>
                                    <InlineSearchList 
                                        value={importedTemplateId} 
                                        onSelect={handleTemplateSelect} 
                                        options={templateOptions} 
                                        placeholder="اختر القالب المرجعي..." 
                                        className="h-11 border-primary/20 bg-primary/5 rounded-2xl shadow-sm"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 p-8 bg-slate-50/50 rounded-[2.5rem] border-2 border-dashed border-indigo-100 relative">
                                <div className="absolute top-0 right-0 w-2 h-full bg-indigo-500/10 rounded-r-3xl" />
                                <div className="grid gap-2">
                                    <Label className="font-black text-[10px] text-slate-400 uppercase pr-1 flex items-center gap-1"><Ruler className="h-3 w-3 text-indigo-600" /> المساحة م²</Label>
                                    <Input type="number" step="any" {...register('totalArea')} onWheel={(e) => e.currentTarget.blur()} className="h-12 rounded-xl border-2 font-black text-lg text-center" />
                                </div>
                                <div className="grid gap-2">
                                    <Label className="font-black text-[10px] text-slate-400 uppercase pr-1 flex items-center gap-1"><Building2 className="h-3 w-3 text-indigo-600" /> عدد الأدوار</Label>
                                    <Input type="number" {...register('floorsCount')} onWheel={(e) => e.currentTarget.blur()} className="h-12 rounded-xl border-2 font-black text-lg text-center" />
                                </div>
                                <div className="grid gap-2">
                                    <Label className="font-black text-[10px] text-slate-400 uppercase pr-1 flex items-center gap-1"><Home className="h-3 w-3 text-indigo-600" /> خيار السرداب</Label>
                                    <Controller name="basementType" control={control} render={({ field }) => (
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <SelectTrigger className="h-12 rounded-xl border-2 font-black text-sm"><SelectValue /></SelectTrigger>
                                            <SelectContent dir="rtl">
                                                <SelectItem value="none">بدون سرداب</SelectItem>
                                                <SelectItem value="full">كامل</SelectItem>
                                                <SelectItem value="half">نص</SelectItem>
                                                <SelectItem value="vault">قبو</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )} />
                                </div>
                                <div className="grid gap-2">
                                    <Label className="font-black text-[10px] text-slate-400 uppercase pr-1">توسعة السطح</Label>
                                    <Controller name="roofExtension" control={control} render={({ field }) => (
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <SelectTrigger className="h-12 rounded-xl border-2 font-black text-sm"><SelectValue /></SelectTrigger>
                                            <SelectContent dir="rtl">
                                                <SelectItem value="none">لا يوجد</SelectItem>
                                                <SelectItem value="quarter">ربع دور</SelectItem>
                                                <SelectItem value="half">نصف دور</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )} />
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Financial Milestones Table */}
                        <div className="space-y-8 animate-in fade-in duration-700">
                            <div className="flex justify-between items-center bg-[#FF7A00]/5 p-6 rounded-[2.5rem] border-2 border-dashed border-[#FF7A00]/20">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-white rounded-2xl shadow-sm text-[#FF7A00]"><Calculator className="h-6 w-6"/></div>
                                    <Label className="text-xl font-black text-[#1e1b4b]">مصفوفة الدفعات المالية المعتمدة</Label>
                                </div>
                                <div className="flex items-center gap-4 no-print">
                                    <div className="grid gap-1">
                                        <Label className="text-[10px] font-black text-slate-400 uppercase">نظام السداد</Label>
                                        <Controller name="financialsType" control={control} render={({ field }) => (
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <SelectTrigger className="w-40 h-10 rounded-xl bg-white font-black text-[#FF7A00] border-none shadow-md"><SelectValue /></SelectTrigger>
                                                <SelectContent dir="rtl"><SelectItem value="fixed">مبالغ ثابتة</SelectItem><SelectItem value="percentage">نسب مئوية</SelectItem></SelectContent>
                                            </Select>
                                        )} />
                                    </div>
                                    {financialsType === 'percentage' && (
                                        <div className="grid gap-1">
                                            <Label className="text-[10px] font-black text-slate-400 uppercase">إجمالي العقد</Label>
                                            <Input type="number" step="any" {...register('totalAmount')} onWheel={(e) => e.currentTarget.blur()} className="w-28 h-10 rounded-xl bg-white font-black text-lg text-center border-none shadow-md" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="border-2 rounded-[2.5rem] overflow-hidden shadow-xl bg-white">
                                <Table>
                                    <TableHeader className="bg-slate-900 h-14">
                                        <TableRow className="border-none">
                                            <TableHead className="w-24 text-center font-black text-white/40 border-l border-white/10">#</TableHead>
                                            <TableHead className="px-8 font-black text-white text-right">بيان الدفعة وشرط الاستحقاق الميداني</TableHead>
                                            <TableHead className="text-center font-black text-white w-64">
                                                {financialsType === 'percentage' ? 'النسبة (%)' : 'المبلغ (د.ك)'}
                                            </TableHead>
                                            <TableHead className="w-16"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {fields.map((c, i) => (
                                            <TableRow key={c.id} className="h-20 border-b last:border-0 hover:bg-orange-50/10 group">
                                                <TableCell className="text-center bg-slate-50/50 border-l font-black text-slate-400">{i+1}</TableCell>
                                                <TableCell className="px-8">
                                                    <Input {...register(`clauses.${i}.name`)} className="border-none shadow-none font-black text-lg bg-transparent focus-visible:ring-0 text-black" placeholder="اسم الدفعة..." />
                                                    <p className="text-[8px] font-black text-[#FF7A00]/40 mr-2 uppercase tracking-widest">بانتظار الإنجاز الميداني</p>
                                                </TableCell>
                                                <TableCell className="bg-[#FF7A00]/5 border-r">
                                                    <Input type="number" step="any" {...register(financialsType === 'percentage' ? `clauses.${i}.percentage` : `clauses.${i}.amount`)} onWheel={(e) => e.currentTarget.blur()} className="text-center font-black text-3xl text-[#FF7A00] border-none shadow-none focus-visible:ring-0 bg-transparent font-mono" />
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <button type="button" onClick={() => remove(i)} className="text-red-300 h-8 w-8 rounded-full hover:bg-red-50 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="h-4 w-4"/></button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                    <TableFooter className="bg-slate-50 h-20">
                                        <TableRow className="border-none">
                                            <TableCell colSpan={2} className="text-right px-10"><p className="text-xl font-black">إجمالي قيمة التعاقد المباشر:</p></TableCell>
                                            <TableCell className="text-center border-r bg-white">
                                                <div className={cn("text-3xl font-black font-mono", financialsType === 'percentage' && currentTotalCalculated !== 100 ? "text-red-600" : "text-[#FF7A00]")}>
                                                    {financialsType === 'fixed' ? formatCurrency(currentTotalCalculated) : `${currentTotalCalculated}%`}
                                                </div>
                                            </TableCell>
                                            <TableCell />
                                        </TableRow>
                                    </TableFooter>
                                </Table>
                                <div className="p-6 flex justify-center bg-muted/5 border-t">
                                    <Button type="button" variant="ghost" onClick={() => append({ id: generateId(), name: `الدفعة الجديدة`, condition: '', amount: undefined, percentage: 0 } as any)} className="h-12 px-10 rounded-xl border-dashed border-2 font-black text-[#FF7A00] gap-2 hover:bg-white transition-all shadow-sm">
                                        <PlusCircle className="h-5 w-5" /> إضافة دفعة استحقاق يدوية +
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="p-10 border-t bg-muted/10 flex justify-between items-center">
                        <div className="space-y-1">
                            <p className="text-sm font-black text-[#FF7A00] flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 animate-pulse"/> الاعتماد النهائي يثبت مديونية العميل في شجرة الحسابات
                            </p>
                        </div>
                        <Button type="submit" disabled={isSaving || !currentClientId || fields.length === 0} className="h-16 px-20 rounded-[2.2rem] font-black text-2xl shadow-xl shadow-[#FF7A00]/30 min-w-[350px] gap-4 bg-[#FF7A00] text-white border-none">
                            {isSaving ? <Loader2 className="animate-spin h-8 w-8" /> : <Save className="h-8 w-8" />}
                            توقيـع واعتمـاد العقـد
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </div>
    );
}

export default function NewDirectContractPage() {
    return (
        <Suspense fallback={<div className="p-20 text-center"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary" /></div>}>
            <DirectContractContent />
        </Suspense>
    );
}