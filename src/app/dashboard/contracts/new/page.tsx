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
import type { Client, ClientTransaction, Account, Employee, Department, ContractTemplate } from '@/lib/types';
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
    CheckCircle2, 
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
    Layers,
    FileText
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
  totalArea: z.preprocess((v) => parseFloat(String(v || '0')), z.number().min(0)),
  floorsCount: z.preprocess((v) => parseInt(String(v || '1'), 10), z.number().min(1)),
  basementType: z.enum(['none', 'full', 'half', 'vault']).default('none'),
  roofExtension: z.enum(['none', 'quarter', 'half']).default('none'),
  workNature: z.enum(['labor_only', 'with_materials']).default('labor_only'),
  clauses: z.array(z.object({
    id: z.string(),
    name: z.string().min(1, "وصف الدفعة مطلوب."),
    condition: z.string().min(1, "شرط الاستحقاق مطلوب."),
    amount: z.preprocess((a) => parseFloat(String(a || '0')), z.number().min(0, "المبلغ مطلوب.")),
    percentage: z.number().optional(),
  })).min(1, 'يجب وجود دفعة واحدة على الأقل.'),
  financialsType: z.enum(['fixed', 'percentage']).default('fixed'),
  totalAmount: z.preprocess((a) => parseFloat(String(a || '0')), z.number().min(0)),
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

    const { register, handleSubmit, control, setValue, reset, watch, formState: { errors } } = useForm<ContractValues>({
        resolver: zodResolver(contractSchema),
        defaultValues: {
            clientId: searchParams.get('clientId') || '',
            transactionId: searchParams.get('transactionId') || '',
            totalArea: 0, floorsCount: 1, basementType: 'none', roofExtension: 'none', workNature: 'labor_only',
            financialsType: 'fixed',
            clauses: [{ id: generateId(), name: 'الدفعة الأولى عند توقيع العقد', condition: 'عند توقيع العقد', amount: 0 }]
        }
    });

    const { fields, append, remove, replace: replaceClauses } = useFieldArray({ control, name: 'clauses' });
    
    const currentClientId = useWatch({ control, name: 'clientId' });
    const watchedClauses = useWatch({ control, name: 'clauses' });
    const financialsType = useWatch({ control, name: 'financialsType' });
    const totalAmountFromForm = useWatch({ control, name: 'totalAmount' });

    const currentTotalCalculated = useMemo(() => {
        if (financialsType === 'fixed') {
            return (watchedClauses || []).reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0);
        } else {
            return (watchedClauses || []).reduce((sum: number, c: any) => sum + (Number(c.value || c.percentage) || 0), 0);
        }
    }, [watchedClauses, financialsType]);

    // 🛡️ جلب القوالب والعملاء
    const { data: allClients, loading: clientsLoading } = useSubscription<Client>(firestore, tenantId ? 'clients' : null);
    const { data: templates } = useSubscription<ContractTemplate>(firestore, tenantId ? 'contractTemplates' : null, [orderBy('title')]);
    const { data: accounts = [] } = useSubscription<Account>(firestore, tenantId ? 'chartOfAccounts' : null);

    const [clientTransactions, setClientTransactions] = useState<ClientTransaction[]>([]);
    const [txLoading, setTxLoading] = useState(false);

    // 🛡️ رادار المعاملات: يجلب فقط المعاملات التي لا تملك عقداً (Status Filter)
    useEffect(() => {
        if (!firestore || !currentClientId || !tenantId) {
            setClientTransactions([]);
            return;
        }
        setTxLoading(true);
        const txPath = getTenantPath(`clients/${currentClientId}/transactions`, tenantId);
        getDocs(query(collection(firestore, txPath!), where('status', 'in', ['new', 'in-progress']))).then(snap => {
            // فلترة المعاملات التي لا تملك عقداً مسبقاً (Sub-service Level)
            const availableTxs = snap.docs
                .map(d => ({ id: d.id, ...d.data() } as ClientTransaction))
                .filter(tx => !tx.contract); 
            setClientTransactions(availableTxs);
        }).finally(() => setTxLoading(false));
    }, [currentClientId, firestore, tenantId]);

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
                amount: template.financials?.type === 'fixed' ? Number(m.value) : 0,
                percentage: template.financials?.type === 'percentage' ? Number(m.value) : 0,
                value: Number(m.value) // for the local list state
            }));
            replaceClauses(newClauses as any);
        }
        toast({ title: '✅ تم استيراد هيكل الدفعات بنجاح' });
    };

    const clientOptions = useMemo(() => 
        allClients
            .filter(c => c.isActive !== false)
            .sort((a,b) => a.nameAr.localeCompare(b.nameAr, 'ar'))
            .map(c => ({ value: c.id!, label: c.nameAr }))
    , [allClients]);

    // ✨ التبديل للمستوى التفصيلي (Sub-service Name) ✨
    const transactionOptions = useMemo(() => 
        clientTransactions.map(t => ({ 
            value: t.id!, 
            label: t.subServiceName ? `${t.subServiceName} (${t.transactionType})` : t.transactionType 
        }))
    , [clientTransactions]);

    const templateOptions = useMemo(() => 
        templates.map(t => ({ value: t.id!, label: t.title }))
    , [templates]);

    const onSubmit = async (data: ContractValues) => {
        if (!firestore || !currentUser || !tenantId || savingRef.current) return;
        
        const totalToSave = financialsType === 'fixed' ? currentTotalCalculated : data.totalAmount;
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
                
                // حساب مصفوفة الدفعات النهائية كقيم نقدية
                const finalClauses = data.clauses.map((c: any) => {
                    const amount = financialsType === 'percentage' ? (c.value / 100) * data.totalAmount : c.amount;
                    return { ...c, amount, status: 'غير مستحقة' };
                });

                transaction_fs.update(txRef, {
                    status: 'in-progress',
                    contract: cleanFirestoreData({
                        clauses: finalClauses,
                        totalAmount: totalToSave,
                        financialsType: data.financialsType,
                        specs: { totalArea: data.totalArea, floorsCount: data.floorsCount, basementType: data.basementType, roofExtension: data.roofExtension, workNature: data.workNature }
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
                    totalDebit: totalToSave, totalCredit: totalToSave, 
                    status: 'draft', 
                    lines: [
                        { accountId: clientAccountId, accountName: selectedClient.nameAr, debit: totalToSave, credit: 0, auto_profit_center: data.transactionId },
                        { accountId: revenueAccSnap.docs[0]?.id || '4101', accountName: revenueAccSnap.docs[0]?.data()?.name || 'إيرادات عقود', debit: 0, credit: totalToSave, auto_profit_center: data.transactionId }
                    ],
                    clientId: data.clientId, transactionId: data.transactionId, createdAt: serverTimestamp(), createdBy: currentUser.id, companyId: tenantId
                }));

                transaction_fs.set(jeCounterRef, { [`counts.${currentYear}`]: nextJeNum }, { merge: true });
                transaction_fs.update(doc(firestore, getTenantPath(`clients/${data.clientId}`, tenantId)!), { status: 'contracted' });
            });

            toast({ title: '✅ تم توقيع واعتماد العقد المباشر' });
            router.push(`/dashboard/clients/${data.clientId}`);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'فشل التوقيع', description: e.message });
            setIsSaving(false);
            savingRef.current = false;
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-10 pb-20" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-gradient-to-r from-[#FF7A00] to-[#FFB000] text-white relative">
                <div className="absolute top-0 right-0 w-80 h-full bg-white/10 -skew-x-12 transform translate-x-32 pointer-events-none" />
                <CardHeader className="p-10 relative z-10">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                        <div className="flex items-center gap-6">
                            <div className="p-5 bg-white/20 rounded-[2rem] backdrop-blur-xl border border-white/40 shadow-2xl">
                                <FileSignature className="h-10 w-10 text-white" />
                            </div>
                            <div className="text-right">
                                <CardTitle className="text-3xl font-black text-white tracking-tighter">توقيع عقد مباشر</CardTitle>
                                <CardDescription className="text-white/90 font-bold text-sm">اعتماد المسار القانوني والمالي للخدمة المختارة.</CardDescription>
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
                                    <LayoutGrid className="h-3 w-3 text-[#FF7A00]"/> الخدمة أو الرخصة المختارة *
                                </Label>
                                <Controller control={control} name="transactionId" render={({ field }) => (
                                    <InlineSearchList 
                                        value={field.value} 
                                        onSelect={field.onChange} 
                                        options={transactionOptions} 
                                        placeholder={!currentClientId ? "اختر عميلاً أولاً" : txLoading ? "جاري التحميل..." : "اختر الخدمة التفصيلية..."} 
                                        disabled={!currentClientId || txLoading} 
                                        className="h-14 rounded-2xl border-2" 
                                    />
                                )} />
                            </div>
                        </div>

                        <Separator className="opacity-10" />

                        <div className="space-y-6">
                            <div className="flex items-center gap-3 border-r-8 border-indigo-600 pr-4">
                                <h3 className="font-black text-xl text-[#1e1b4b]">مواصفات وقالب العقد</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="grid gap-3">
                                    <Label className="font-black text-[11px] uppercase text-primary tracking-widest pr-2 flex items-center gap-2">
                                        <Sparkles className="h-4 w-4 animate-pulse"/> استيراد قالب الدفعات الموحد
                                    </Label>
                                    <InlineSearchList 
                                        value={importedTemplateId} 
                                        onSelect={handleTemplateSelect} 
                                        options={templateOptions} 
                                        placeholder="اختر القالب المرجعي لتعبئة الدفعات..." 
                                        className="h-12 border-primary/20 bg-primary/5 rounded-2xl shadow-sm"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label className="font-black text-[10px] text-slate-400 uppercase">المساحة م²</Label>
                                        <Input type="number" {...register('totalArea')} className="h-12 rounded-xl border-2 font-black text-lg text-center shadow-inner" />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label className="font-black text-[10px] text-slate-400 uppercase">عدد الأدوار</Label>
                                        <Input type="number" {...register('floorsCount')} className="h-12 rounded-xl border-2 font-black text-lg text-center shadow-inner" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-8 animate-in fade-in duration-700">
                            <div className="flex justify-between items-center bg-primary/5 p-6 rounded-[2.5rem] border-2 border-dashed border-primary/20">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-white rounded-2xl shadow-sm text-primary"><Calculator className="h-6 w-6"/></div>
                                    <Label className="text-xl font-black text-[#1e1b4b]">مصفوفة الدفعات المالية المعتمدة</Label>
                                </div>
                                <div className="flex items-center gap-4 no-print">
                                    <div className="grid gap-1">
                                        <Label className="text-[10px] font-black text-slate-400 uppercase">نظام السداد</Label>
                                        <Controller name="financialsType" control={control} render={({ field }) => (
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <SelectTrigger className="w-40 h-10 rounded-xl bg-white font-black text-primary border-none shadow-md"><SelectValue /></SelectTrigger>
                                                <SelectContent dir="rtl">
                                                    <SelectItem value="fixed">مبالغ ثابتة</SelectItem>
                                                    <SelectItem value="percentage">نسب مئوية</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )} />
                                    </div>
                                    {financialsType === 'percentage' && (
                                        <div className="grid gap-1">
                                            <Label className="text-[10px] font-black text-slate-400 uppercase">إجمالي العقد</Label>
                                            <Input type="number" {...register('totalAmount')} className="w-28 h-10 rounded-xl bg-white font-black text-lg text-center border-none shadow-md" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="border-2 rounded-[2.5rem] overflow-hidden shadow-xl bg-white">
                                <Table>
                                    <TableHeader className="bg-slate-900 h-14">
                                        <TableRow className="border-none">
                                            <TableHead className="w-24 text-center font-black text-white/40 border-l border-white/10">#</TableHead>
                                            <TableHead className="px-8 font-black text-white text-right">بيان شرط الاستحقاق الميداني (WBS LINK)</TableHead>
                                            <TableHead className="text-center font-black text-white w-64">
                                                {financialsType === 'percentage' ? 'النسبة (%)' : 'المبلغ (د.ك)'}
                                            </TableHead>
                                            <TableHead className="w-16"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {fields.map((c, i) => (
                                            <TableRow key={c.id} className="h-20 border-b last:border-0 hover:bg-primary/[0.01] group">
                                                <TableCell className="text-center bg-slate-50/50 border-l font-black text-slate-400">{i+1}</TableCell>
                                                <TableCell className="px-8">
                                                    <Input {...register(`clauses.${i}.name`)} className="border-none shadow-none font-black text-lg bg-transparent focus-visible:ring-0" placeholder="اسم الدفعة..." />
                                                    <p className="text-[8px] font-black text-primary/40 mr-2 uppercase tracking-widest">{watchedClauses[i]?.condition || 'بانتظار ربط المرحلة'}</p>
                                                </TableCell>
                                                <TableCell className="bg-primary/[0.01] border-r">
                                                    <Input 
                                                        type="number" step="any" 
                                                        {...register(financialsType === 'percentage' ? `clauses.${i}.percentage` : `clauses.${i}.amount`)} 
                                                        className="text-center font-black text-3xl text-primary border-none shadow-none font-mono" 
                                                    />
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
                                                <div className={cn("text-3xl font-black font-mono", financialsType === 'percentage' && currentTotalCalculated !== 100 ? "text-red-600" : "text-primary")}>
                                                    {financialsType === 'fixed' ? formatCurrency(currentTotalCalculated) : `${currentTotalCalculated}%`}
                                                </div>
                                            </TableCell>
                                            <TableCell />
                                        </TableRow>
                                    </TableFooter>
                                </Table>
                                <div className="p-6 flex justify-center bg-muted/5 border-t">
                                    <Button type="button" variant="ghost" onClick={() => append({ id: generateId(), name: `الدفعة الجديدة`, condition: '', amount: 0, percentage: 0 })} className="h-12 px-10 rounded-xl border-dashed border-2 font-black text-primary gap-2 hover:bg-white transition-all">
                                        <PlusCircle className="h-5 w-5" /> إضافة دفعة استحقاق يدوية +
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="p-10 border-t bg-muted/10 flex justify-between items-center">
                        <div className="space-y-1">
                            <p className="text-sm font-black text-primary flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 animate-pulse"/> سيتم تجميد المعاملة السابقة وفتح المسار المالي
                            </p>
                            <p className="text-[10px] text-muted-foreground font-bold pr-7">الاعتماد يولد قيد مديونية مسودة باسم العميل في المحاسبة.</p>
                        </div>
                        <Button type="submit" disabled={isSaving || !currentClientId || fields.length === 0} className="h-16 px-20 rounded-[2.2rem] font-black text-2xl shadow-xl shadow-primary/30 min-w-[350px] gap-4">
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
