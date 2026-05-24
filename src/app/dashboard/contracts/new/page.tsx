'use client';

import { useState, useMemo, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, where, getDocs, orderBy, doc, runTransaction, serverTimestamp, getDoc, Timestamp, limit } from 'firebase/firestore';
import type { Client, ClientTransaction, Account, Employee, Department } from '@/lib/types';
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
    Save 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { formatCurrency, cleanFirestoreData, cn, getTenantPath } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

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
  })).min(1, 'يجب وجود دفعة واحدة على الأقل.')
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

    // 🛡️ استخدام الاشتراكات المحصنة لضمان ثبات البيانات
    const { data: allClients, loading: clientsLoading } = useSubscription<Client>(firestore, tenantId ? 'clients' : null);
    const { data: allTransactions, loading: txLoading } = useSubscription<ClientTransaction>(firestore, tenantId ? 'transactions' : null, [], true);
    const { data: accounts = [] } = useSubscription<Account>(firestore, tenantId ? 'chartOfAccounts' : null);
    const { data: employees = [] } = useSubscription<Employee>(firestore, tenantId ? 'employees' : null);
    const { data: departments = [] } = useSubscription<Department>(firestore, tenantId ? 'departments' : null);

    const { register, handleSubmit, control, setValue, reset, watch, formState: { errors } } = useForm<ContractValues>({
        resolver: zodResolver(contractSchema),
        defaultValues: {
            clientId: searchParams.get('clientId') || '',
            transactionId: searchParams.get('transactionId') || '',
            totalArea: 0, floorsCount: 1, basementType: 'none', roofExtension: 'none', workNature: 'labor_only',
            clauses: [{ id: generateId(), name: 'الدفعة الأولى عند توقيع العقد', condition: 'عند توقيع العقد', amount: 0 }]
        }
    });

    const { fields, append, remove } = useFieldArray({ control, name: 'clauses' });
    const watchedClientId = watch('clientId');
    const watchedClauses = watch('clauses');
    const currentTotal = useMemo(() => watchedClauses.reduce((sum, c) => sum + (Number(c.amount) || 0), 0), [watchedClauses]);

    const clientOptions = useMemo(() => 
        allClients
            .filter(c => c.isActive !== false)
            .sort((a,b) => a.nameAr.localeCompare(b.nameAr, 'ar'))
            .map(c => ({ value: c.id!, label: c.nameAr }))
    , [allClients]);

    const transactionOptions = useMemo(() => 
        allTransactions
            .filter(t => t.clientId === watchedClientId && ['new', 'in-progress'].includes(t.status))
            .map(t => ({ value: t.id!, label: t.transactionType }))
    , [allTransactions, watchedClientId]);

    const onSubmit = async (data: ContractValues) => {
        if (!firestore || !currentUser || !tenantId || savingRef.current) return;
        
        const selectedClient = allClients.find(c => c.id === data.clientId)!;
        const selectedTx = allTransactions.find(t => t.id === data.transactionId)!;

        savingRef.current = true;
        setIsSaving(true);

        try {
            await runTransaction(firestore, async (transaction_fs) => {
                const currentYear = new Date().getFullYear();
                const coaPath = getTenantPath('chartOfAccounts', tenantId)!;
                
                const revenueAccQuery = query(collection(firestore, coaPath), where('code', '==', '4101'), limit(1));
                const revenueAccSnap = await getDocs(revenueAccQuery);

                const clientAccQuery = query(collection(firestore, coaPath), where('name', '==', selectedClient.nameAr), where('parentCode', '==', '1102'), limit(1));
                const clientAccSnap = await getDocs(clientAccQuery);

                const jeCounterRef = doc(firestore, getTenantPath('counters/journalEntries', tenantId)!);
                const coaSubCounterRef = doc(firestore, getTenantPath('counters/coa_clients', tenantId)!);
                
                const [jeCounterDoc, coaSubCounterDoc] = await Promise.all([
                    transaction_fs.get(jeCounterRef),
                    transaction_fs.get(coaSubCounterRef)
                ]);

                let clientAccountId = '';
                if (clientAccSnap.empty) {
                    const nextClientNum = (coaSubCounterDoc.data()?.lastNumber || 0) + 1;
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
                
                transaction_fs.update(txRef, {
                    status: 'in-progress',
                    contract: cleanFirestoreData({
                        clauses: data.clauses,
                        totalAmount: currentTotal,
                        financialsType: 'fixed',
                        specs: { totalArea: data.totalArea, floorsCount: data.floorsCount, basementType: data.basementType, roofExtension: data.roofExtension, workNature: data.workNature }
                    }),
                    updatedAt: serverTimestamp()
                });

                const nextJeNum = ((jeCounterDoc.data()?.counts || {})[currentYear] || 0) + 1;
                const newJeRef = doc(collection(firestore, getTenantPath('journalEntries', tenantId)!));

                transaction_fs.set(newJeRef, cleanFirestoreData({
                    entryNumber: `JV-DR-${currentYear}-${String(nextJeNum).padStart(4, '0')}`,
                    date: serverTimestamp(), 
                    narration: `[قيد مديونية مباشر] عقد: ${selectedTx.transactionType} لـ ${selectedClient.nameAr}`,
                    totalDebit: currentTotal, totalCredit: currentTotal, 
                    status: 'draft', 
                    lines: [
                        { accountId: clientAccountId, accountName: selectedClient.nameAr, debit: currentTotal, credit: 0, auto_profit_center: data.transactionId },
                        { accountId: revenueAccSnap.docs[0]?.id || '4101', accountName: revenueAccSnap.docs[0]?.data()?.name || 'إيرادات عقود', debit: 0, credit: currentTotal, auto_profit_center: data.transactionId }
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

    const loading = clientsLoading || txLoading;

    if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary" /></div>;

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
                                <CardDescription className="text-white/90 font-bold text-sm">تثبيت الأثر المالي والقانوني للمشاريع المعتمدة.</CardDescription>
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
                                    <User className="h-3 w-3 text-[#FF7A00]"/> المالك المستهدف *
                                </Label>
                                <Controller control={control} name="clientId" render={({ field }) => (
                                    <InlineSearchList value={field.value} onSelect={field.onChange} options={clientOptions} placeholder="ابحث عن عميل..." className="h-14 rounded-2xl border-2" />
                                )} />
                            </div>
                            <div className="grid gap-3">
                                <Label className="font-black text-[11px] uppercase text-slate-400 tracking-widest pr-2 flex items-center gap-2">
                                    <LayoutGrid className="h-3 w-3 text-[#FF7A00]"/> المعاملة المراد تعاقدها *
                                </Label>
                                <Controller control={control} name="transactionId" render={({ field }) => (
                                    <InlineSearchList value={field.value} onSelect={field.onChange} options={transactionOptions} placeholder={!watchedClientId ? "اختر عميلاً أولاً" : "اختر المعاملة المفتوحة..."} disabled={!watchedClientId} className="h-14 rounded-2xl border-2" />
                                )} />
                            </div>
                        </div>

                        <Separator className="opacity-10" />

                        <div className="space-y-8 animate-in fade-in duration-700">
                            <div className="flex items-center gap-4 bg-primary/5 p-6 rounded-[2.5rem] border-2 border-dashed border-primary/20">
                                <div className="p-3 bg-white rounded-2xl shadow-sm text-primary"><Calculator className="h-6 w-6"/></div>
                                <Label className="text-xl font-black text-[#1e1b4b]">مصفوفة الدفعات المالية المعتمدة</Label>
                            </div>

                            <div className="border-2 rounded-[2.5rem] overflow-hidden shadow-xl bg-white">
                                <Table>
                                    <TableHeader className="bg-slate-900 h-14">
                                        <TableRow className="border-none">
                                            <TableHead className="w-24 text-center font-black text-white/40 border-l border-white/10">#</TableHead>
                                            <TableHead className="px-8 font-black text-white text-right">بيان شرط الاستحقاق</TableHead>
                                            <TableHead className="text-center font-black text-white w-64">المبلغ (د.ك)</TableHead>
                                            <TableHead className="w-16"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {fields.map((c, i) => (
                                            <TableRow key={c.id} className="h-20 border-b last:border-0 hover:bg-primary/[0.01] group">
                                                <TableCell className="text-center bg-slate-50/50 border-l font-black text-slate-400">{i+1}</TableCell>
                                                <TableCell className="px-8">
                                                    <Input {...register(`clauses.${i}.name`)} className="border-none shadow-none font-bold text-lg bg-transparent focus-visible:ring-0" />
                                                </TableCell>
                                                <TableCell className="bg-primary/[0.01] border-r">
                                                    <Input type="number" step="any" {...register(`clauses.${i}.amount`)} className="text-center font-black text-3xl text-primary border-none shadow-none font-mono" />
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <button type="button" onClick={() => remove(i)} className="text-red-300 h-8 w-8 rounded-full hover:bg-red-50 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="h-4 w-4"/></button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                    <TableFooter className="bg-slate-50 h-20">
                                        <TableRow className="border-none">
                                            <TableCell colSpan={2} className="text-right px-10"><p className="text-xl font-black">إجمالي قيمة التعاقد:</p></TableCell>
                                            <TableCell className="text-center border-r bg-white">
                                                <div className="text-3xl font-black font-mono text-primary">{formatCurrency(currentTotal)}</div>
                                            </TableCell>
                                            <TableCell />
                                        </TableRow>
                                    </TableFooter>
                                </Table>
                                <div className="p-6 flex justify-center bg-muted/5 border-t">
                                    <Button type="button" variant="ghost" onClick={() => append({ id: generateId(), name: `الدفعة الجديدة`, condition: '', amount: 0 })} className="h-12 px-10 rounded-xl border-dashed border-2 font-black text-primary gap-2 hover:bg-white transition-all">
                                        <PlusCircle className="h-5 w-5" /> إضافة دفعة يدوية +
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="p-10 border-t bg-muted/10 flex justify-between items-center">
                        <div className="space-y-1">
                            <p className="text-sm font-black text-primary flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 animate-pulse"/> سيتم توليد قيد مديونية مسودة آلياً
                            </p>
                            <p className="text-[10px] text-muted-foreground font-bold pr-7">الاعتماد يثبت مديونية العميل في شجرة الحسابات.</p>
                        </div>
                        <Button type="submit" disabled={isSaving || !watchedClientId || fields.length === 0} className="h-16 px-20 rounded-[2.2rem] font-black text-2xl shadow-xl shadow-primary/30 min-w-[350px] gap-4">
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
