'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, orderBy, doc, runTransaction, serverTimestamp, limit, getDoc } from 'firebase/firestore';
import type { Client, ClientTransaction, Account, ContractTemplate } from '@/lib/types';
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
    AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { formatCurrency, cleanFirestoreData, cn, getTenantPath } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const generateId = () => Math.random().toString(36).substring(2, 9);
const arabicOrdinals = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة'];

export default function DirectContractPage() {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    const tenantId = currentUser?.currentCompanyId;
    const savingRef = useRef(false);

    const [selectedClientId, setSelectedClientId] = useState('');
    const [selectedTxId, setSelectedTxId] = useState('');
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    
    const [clients, setClients] = useState<Client[]>([]);
    const [transactions, setTransactions] = useState<ClientTransaction[]>([]);
    const [templates, setTemplates] = useState<ContractTemplate[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [clauses, setClauses] = useState<any[]>([]);
    const [financialsType, setFinancialsType] = useState<'fixed' | 'percentage'>('fixed');
    const [totalContractValue, setTotalContractValue] = useState(0);

    // 🛡️ محرك جلب البيانات السيادي الموحد (Tenant-Aware Fetching)
    useEffect(() => {
        if (!firestore || !tenantId) return;
        const fetchRefData = async () => {
            setLoading(true);
            try {
                const clientPath = getTenantPath('clients', tenantId);
                const templatePath = getTenantPath('contractTemplates', tenantId);
                const coaPath = getTenantPath('chartOfAccounts', tenantId);

                const [clientsSnap, templatesSnap, accountsSnap] = await Promise.all([
                    getDocs(query(collection(firestore, clientPath!), where('isActive', '==', true), orderBy('nameAr'))),
                    getDocs(query(collection(firestore, templatePath!), orderBy('title'))),
                    getDocs(query(collection(firestore, coaPath!)))
                ]);
                
                setClients(clientsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Client)));
                setTemplates(templatesSnap.docs.map(d => ({ id: d.id, ...d.data() } as ContractTemplate)));
                setAccounts(accountsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Account)));
            } catch (e) { 
                console.error("Direct Contract Fetch Error:", e);
                toast({ variant: 'destructive', title: 'خطأ في جلب البيانات' });
            } finally { setLoading(false); }
        };
        fetchRefData();
    }, [firestore, tenantId, toast]);

    useEffect(() => {
        if (!firestore || !selectedClientId || !tenantId) {
            setTransactions([]);
            return;
        }
        const fetchTransactions = async () => {
            const txsPath = getTenantPath(`clients/${selectedClientId}/transactions`, tenantId);
            const q = query(collection(firestore, txsPath!), where('status', '==', 'new'));
            const snap = await getDocs(q);
            setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as ClientTransaction)));
        };
        fetchTransactions();
    }, [selectedClientId, firestore, tenantId]);

    const handleTemplateSelect = (tId: string) => {
        setSelectedTemplateId(tId);
        const template = templates.find(t => t.id === tId);
        if (template && template.financials) {
            setFinancialsType(template.financials.type);
            setTotalContractValue(template.financials.totalAmount || 0);
            setClauses((template.financials.milestones || []).map((m, idx) => ({
                id: generateId(),
                name: m.name,
                amount: template.financials?.type === 'fixed' ? Number(m.value) : 0,
                percentage: template.financials?.type === 'percentage' ? Number(m.value) : 0,
                condition: m.condition || '',
                status: 'غير مستحقة',
                ordinalName: `الدفعة ${arabicOrdinals[idx] || (idx + 1)}`
            })));
        }
    };

    const currentTotal = useMemo(() => {
        if (financialsType === 'fixed') return clauses.reduce((s, c) => s + (Number(c.amount) || 0), 0);
        return clauses.reduce((s, c) => s + (Number(c.percentage) || 0), 0);
    }, [clauses, financialsType]);

    const handleSaveContract = async () => {
        if (!firestore || !currentUser || !tenantId || !selectedClientId || !selectedTxId || clauses.length === 0 || savingRef.current) return;
        
        savingRef.current = true;
        setIsSaving(true);
        try {
            const selectedClient = clients.find(c => c.id === selectedClientId)!;
            const selectedTx = transactions.find(t => t.id === selectedTxId)!;
            const finalTotal = financialsType === 'fixed' ? currentTotal : totalContractValue;

            await runTransaction(firestore, async (transaction_fs) => {
                const currentYear = new Date().getFullYear();
                
                const revenueAccPath = getTenantPath('chartOfAccounts', tenantId);
                const revenueAccSnap = await getDocs(query(collection(firestore, revenueAccPath!), where('code', '==', '4101'), limit(1)));
                
                const clientAccSnap = await getDocs(query(collection(firestore, revenueAccPath!), where('name', '==', selectedClient.nameAr), limit(1)));
                
                const jeCounterPath = getTenantPath('counters/journalEntries', tenantId);
                const jeCounterRef = doc(firestore, jeCounterPath!);
                const jeCounterDoc = await transaction_fs.get(jeCounterRef);
                const nextJeNum = ((jeCounterDoc.data()?.counts || {})[currentYear] || 0) + 1;

                const txPath = getTenantPath(`clients/${selectedClientId}/transactions/${selectedTxId}`, tenantId);
                const txRef = doc(firestore, txPath!);
                
                transaction_fs.update(txRef, {
                    status: 'in-progress',
                    contract: cleanFirestoreData({
                        clauses: clauses.map(c => ({
                            ...c,
                            amount: financialsType === 'percentage' ? (c.percentage / 100) * totalContractValue : c.amount
                        })),
                        totalAmount: finalTotal,
                        financialsType
                    })
                });

                const clientPath = getTenantPath(`clients/${selectedClientId}`, tenantId);
                transaction_fs.update(doc(firestore, clientPath!), { status: 'contracted' });

                if (!revenueAccSnap.empty && !clientAccSnap.empty) {
                    const jePath = getTenantPath('journalEntries', tenantId);
                    const newJeRef = doc(collection(firestore, jePath!));
                    transaction_fs.set(newJeRef, {
                        entryNumber: `JV-DIRECT-${currentYear}-${String(nextJeNum).padStart(4, '0')}`,
                        date: serverTimestamp(),
                        narration: `إثبات مديونية عقد مباشر: ${selectedTx.transactionType} - ${selectedClient.nameAr}`,
                        totalDebit: finalTotal,
                        totalCredit: finalTotal,
                        status: 'posted',
                        lines: [
                            { accountId: clientAccSnap.docs[0].id, accountName: selectedClient.nameAr, debit: finalTotal, credit: 0, auto_profit_center: selectedTxId },
                            { accountId: revenueAccSnap.docs[0].id, accountName: revenueAccSnap.docs[0].data().name, debit: 0, credit: finalTotal, auto_profit_center: selectedTxId }
                        ],
                        clientId: selectedClientId,
                        transactionId: selectedTxId,
                        createdAt: serverTimestamp(),
                        createdBy: currentUser.id,
                        companyId: tenantId
                    });
                    transaction_fs.set(jeCounterRef, { counts: { [currentYear]: nextJeNum } }, { merge: true });
                }
            });

            toast({ title: 'نجاح تفعيل العقد', description: 'تم إنشاء العقد المباشر والترحيل المالي بنجاح.' });
            router.push(`/dashboard/construction/projects/new?clientId=${selectedClientId}&transactionId=${selectedTxId}`);

        } catch (e: any) {
            console.error("Contract Save Error:", e);
            toast({ variant: 'destructive', title: 'خطأ في الربط المالي', description: e.message });
            setIsSaving(false);
            savingRef.current = false;
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-10 pb-20" dir="rtl">
            {/* 🛡️ الهيدر الرئيسي الموحد 🛡️ */}
            <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-gradient-to-r from-[#FF7A00] to-[#FFB000] text-white relative group">
                <div className="absolute top-0 right-0 w-80 h-full bg-white/10 -skew-x-12 transform translate-x-32 pointer-events-none" />
                <CardHeader className="pb-10 pt-10 px-10 relative z-10">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                        <div className="flex items-center gap-6">
                            <div className="text-right">
                                <CardTitle className="text-3xl font-black text-white tracking-tighter">توقيع عقد مباشر</CardTitle>
                                <div className="flex items-center gap-2 mt-1">
                                    <Sparkles className="h-4 w-4 text-amber-200 animate-pulse" />
                                    <CardDescription className="text-white/90 font-bold text-sm">ربط مالي وقانوني فوري للمعاملات المفتوحة لبدء التنفيذ الميداني.</CardDescription>
                                </div>
                            </div>
                            <div className="p-5 bg-white/20 rounded-[2rem] backdrop-blur-xl border border-white/40 shadow-2xl">
                                <FileSignature className="h-10 w-10 text-white" />
                            </div>
                        </div>
                        <Button onClick={() => router.back()} variant="outline" className="h-12 px-8 rounded-2xl font-black gap-2 bg-white/10 text-white border-white/40 hover:bg-white/20 backdrop-blur-md">
                            <ArrowRight className="h-5 w-5" /> تراجع
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white/95">
                <CardContent className="p-10 space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="grid gap-3 group">
                            <Label className="font-black text-[11px] uppercase text-slate-400 tracking-widest pr-2 flex items-center gap-2">
                                <User className="h-3 w-3 text-[#FF7A00] opacity-40"/> العميل / المالك المستهدف *
                            </Label>
                            <InlineSearchList 
                                value={selectedClientId} 
                                onSelect={setSelectedClientId} 
                                options={clients.map(c => ({ value: c.id!, label: c.nameAr }))} 
                                placeholder={loading ? "جاري جلب الملفات..." : "ابحث عن عميل..."}
                                className="h-14 rounded-2xl border-2 shadow-inner bg-slate-50/50"
                            />
                        </div>
                        <div className="grid gap-3 group">
                            <Label className="font-black text-[11px] uppercase text-slate-400 tracking-widest pr-2 flex items-center gap-2">
                                <LayoutGrid className="h-3 w-3 text-[#FF7A00] opacity-40"/> المعاملة المفتوحة حالياً *
                            </Label>
                            <InlineSearchList 
                                value={selectedTxId} 
                                onSelect={setSelectedTxId} 
                                options={transactions.map(t => ({ value: t.id!, label: t.transactionType }))} 
                                placeholder={!selectedClientId ? "اختر عميلاً أولاً" : "اختر الخدمة لربط العقد..."}
                                disabled={!selectedClientId}
                                className="h-14 rounded-2xl border-2 shadow-inner bg-slate-50/50"
                            />
                        </div>
                    </div>

                    <Separator className="opacity-10" />

                    <div className="grid gap-3">
                        <Label className="font-black text-[11px] uppercase text-primary tracking-widest pr-2 flex items-center gap-2">
                            <Sparkles className="h-4 w-4 animate-pulse"/> استيراد مسودة العقد المالية (Templates)
                        </Label>
                        <InlineSearchList 
                            value={selectedTemplateId} 
                            onSelect={handleTemplateSelect} 
                            options={templates.map(t => ({ value: t.id!, label: t.title }))} 
                            placeholder="اختر قالباً لبرمجة الدفعات آلياً..."
                            className="h-12 border-2 border-primary/20 bg-primary/5 rounded-xl font-bold"
                        />
                    </div>

                    {clauses.length > 0 && (
                        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-700">
                            <div className="flex flex-col sm:flex-row justify-between items-center gap-6 bg-primary/5 p-6 rounded-[2.5rem] border-2 border-dashed border-primary/20">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-white rounded-2xl shadow-sm text-primary"><Calculator className="h-6 w-6"/></div>
                                    <Label className="text-xl font-black text-[#1e1b4b]">تخصيص الدفعات المالية المعتمدة</Label>
                                </div>
                                <div className="flex items-center gap-4 no-print">
                                    <Select value={financialsType} onValueChange={(v: any) => { setFinancialsType(v); setClauses([]); }}>
                                        <SelectTrigger className="w-48 h-11 rounded-xl border-none bg-white font-black text-primary shadow-md"><SelectValue /></SelectTrigger>
                                        <SelectContent dir="rtl">
                                            <SelectItem value="fixed">مبالغ ثابتة (KWD)</SelectItem>
                                            <SelectItem value="percentage">نسب مئوية (%)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    
                                    {financialsType === 'percentage' && (
                                        <div className="flex items-center gap-4 animate-in zoom-in-95">
                                            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">إجمالي العقد:</Label>
                                            <Input 
                                                type="number" 
                                                value={totalContractValue} 
                                                onChange={e => setTotalContractValue(Number(e.target.value))} 
                                                className="w-32 h-11 border-none text-center font-black text-xl text-primary rounded-xl shadow-md bg-white"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="border-2 rounded-[3rem] overflow-hidden shadow-2xl bg-white/95">
                                <Table>
                                    <TableHeader className="bg-slate-50 h-14">
                                        <TableRow className="border-none">
                                            <TableHead className="w-32 text-center font-black text-slate-400 border-l border-white/20">رقم الدفعة</TableHead>
                                            <TableHead className="px-10 font-black text-slate-400 text-right">بيان شرط الاستحقاق (Layer 3)</TableHead>
                                            <TableHead className="text-center font-black text-slate-400 w-64">
                                                {financialsType === 'percentage' ? 'النسبة (%)' : 'المبلغ (د.ك)'}
                                            </TableHead>
                                            <TableHead className="w-16"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {clauses.map((c, i) => (
                                            <TableRow key={c.id} className="h-24 border-b last:border-0 hover:bg-primary/[0.02] group transition-all">
                                                <TableCell className="text-center bg-slate-50/50 border-l">
                                                    <Badge variant="secondary" className="font-black text-xs px-4 h-8 rounded-full border-none shadow-sm bg-white text-slate-900">
                                                        {c.ordinalName}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="px-10">
                                                  <Input 
                                                    value={c.name} 
                                                    onChange={e => { const newC = [...clauses]; newC[i].name = e.target.value; setClauses(newC); }} 
                                                    placeholder="مثال: عند صب السقف..."
                                                    className="border-none shadow-none font-bold text-lg bg-transparent focus-visible:ring-0" 
                                                  />
                                                </TableCell>
                                                <TableCell className="bg-primary/[0.01] border-r border-slate-50">
                                                    <Input 
                                                        type="number" 
                                                        value={financialsType === 'fixed' ? c.amount : c.percentage} 
                                                        onChange={e => {
                                                            const newC = [...clauses];
                                                            if (financialsType === 'fixed') newC[i].amount = Number(e.target.value);
                                                            else newC[i].percentage = Number(e.target.value);
                                                            setClauses(newC);
                                                        }} 
                                                        className="text-center font-black text-4xl text-primary border-none shadow-none focus-visible:ring-0 bg-transparent font-mono"
                                                    />
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Button type="button" variant="ghost" size="icon" onClick={() => setClauses(clauses.filter(x => x.id !== c.id))} className="text-red-300 h-10 w-10 rounded-full hover:bg-red-50 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Trash2 className="h-5 w-5"/>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                    <TableFooter className="bg-slate-50 h-24">
                                        <TableRow className="border-none hover:bg-transparent">
                                            <TableCell colSpan={2} className="text-right px-12">
                                                <p className="text-2xl font-black tracking-tight text-slate-800">إجمالي قيمة التعاقد المبرم:</p>
                                            </TableCell>
                                            <TableCell className="text-center border-r border-slate-100 bg-white">
                                                <div className="flex flex-col items-center">
                                                    <div className={cn("text-4xl font-black font-mono tracking-tighter", financialsType === 'percentage' && currentTotal !== 100 ? "text-red-600" : "text-primary")}>
                                                        {financialsType === 'fixed' ? formatCurrency(currentTotal) : `${currentTotal}%`}
                                                    </div>
                                                    {financialsType === 'percentage' && currentTotal !== 100 && (
                                                        <div className="flex items-center gap-1 text-[10px] font-black text-red-500 animate-pulse mt-1 uppercase tracking-widest">
                                                            <AlertCircle className="h-3 w-3" /> يجب أن يكون المجموع 100%
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell />
                                        </TableRow>
                                    </TableFooter>
                                </Table>
                                <div className="p-8 flex justify-center bg-muted/5 border-t">
                                    <Button 
                                        type="button" 
                                        variant="ghost" 
                                        onClick={() => setClauses([...clauses, { id: generateId(), name: '', amount: 0, percentage: 0, status: 'غير مستحقة', ordinalName: `الدفعة ${arabicOrdinals[clauses.length] || (clauses.length + 1)}` }])} 
                                        className="h-14 px-16 rounded-[1.5rem] border-dashed border-2 font-black text-primary gap-4 hover:bg-white transition-all hover:scale-105 active:scale-95 shadow-md"
                                    >
                                        <PlusCircle className="h-6 w-6 text-primary" /> إضافة دفعة استحقاق جديدة +
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="p-10 border-t bg-muted/10 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="space-y-1 text-right">
                        <p className="text-sm font-black text-primary flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5"/> سيتم إنشاء قيد مديونية آلي بـ {financialsType === 'fixed' ? formatCurrency(currentTotal) : formatCurrency(totalContractValue)}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-bold pr-7">الاعتماد النهائي يغير حالة العميل من "جديد" إلى "متعاقد" آلياً.</p>
                    </div>
                    <Button 
                        onClick={handleSaveContract} 
                        disabled={isSaving || !selectedTxId || (financialsType === 'percentage' && currentTotal !== 100)}
                        className="h-20 px-20 rounded-[2.5rem] font-black text-3xl text-white shadow-2xl bg-[#7209B7] hover:bg-black gap-4 min-w-[400px] transition-all hover:scale-[1.02] active:scale-95 border-none"
                    >
                        {isSaving ? <Loader2 className="animate-spin h-10 w-10" /> : <CheckCircle2 className="h-10 w-10" />}
                        اعتماد العقد والبدء بالتنفيذ
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}

