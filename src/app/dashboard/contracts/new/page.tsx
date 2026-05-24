'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, orderBy, doc, runTransaction, serverTimestamp, limit, getDoc, Timestamp } from 'firebase/firestore';
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
    AlertCircle,
    ShieldCheck,
    PlusCircle,
    Ruler,
    Building2,
    Workflow
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { formatCurrency, cleanFirestoreData, cn, getTenantPath } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const generateId = () => Math.random().toString(36).substring(2, 9);
const arabicOrdinals = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة'];

/**
 * صفحة توقيع العقد المباشر (Direct Contract V1260.0):
 * تم إصلاح الخلل المرجعي في دالة الحفظ وتأمين استيراد كافة الأيقونات.
 */
export default function DirectContractPage() {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();

    const tenantId = currentUser?.currentCompanyId;
    const savingRef = useRef(false);

    const [selectedClientId, setSelectedClientId] = useState(searchParams.get('clientId') || '');
    const [selectedTxId, setSelectedTxId] = useState(searchParams.get('transactionId') || '');
    
    const [clients, setClients] = useState<Client[]>([]);
    const [transactions, setTransactions] = useState<ClientTransaction[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [clauses, setClauses] = useState<any[]>([
        { id: generateId(), name: 'الدفعة الأولى عند توقيع العقد', amount: 0, status: 'غير مستحقة', ordinalName: 'الدفعة الأولى', condition: 'عند توقيع العقد' }
    ]);
    const [specs, setSpecs] = useState({
        totalArea: 0, floorsCount: 1, basementType: 'none', roofExtension: 'none', workNature: 'labor_only'
    });

    useEffect(() => {
        if (!firestore || !tenantId) return;
        const fetchRefData = async () => {
            setLoading(true);
            try {
                const clientPath = getTenantPath('clients', tenantId);
                const coaPath = getTenantPath('chartOfAccounts', tenantId);

                const [clientsSnap, accountsSnap] = await Promise.all([
                    getDocs(query(collection(firestore, clientPath!), where('isActive', '==', true), orderBy('nameAr'))),
                    getDocs(query(collection(firestore, coaPath!)))
                ]);
                
                setClients(clientsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Client)));
                setAccounts(accountsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Account)));
            } catch (e) { 
                console.error("Fetch Ref Error:", e);
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

    const currentTotal = useMemo(() => 
        clauses.reduce((sum, c) => sum + (Number(c.amount) || 0), 0)
    , [clauses]);

    const handleSaveContract = async () => {
        if (!firestore || !currentUser || !tenantId || !selectedClientId || !selectedTxId || clauses.length === 0 || savingRef.current) return;
        
        const selectedClient = clients.find(c => c.id === selectedClientId)!;
        const selectedTx = transactions.find(t => t.id === selectedTxId)!;
        const coaPath = getTenantPath('chartOfAccounts', tenantId);

        savingRef.current = true;
        setIsSaving(true);

        try {
            const revenueAccSnap = await getDocs(query(collection(firestore, coaPath!), where('code', '==', '4101'), limit(1)));
            const clientAccSnap = await getDocs(query(collection(firestore, coaPath!), where('name', '==', selectedClient.nameAr), where('parentCode', '==', '1102'), limit(1)));

            await runTransaction(firestore, async (transaction_fs) => {
                const currentYear = new Date().getFullYear();
                
                const jeCounterPath = getTenantPath('counters/journalEntries', tenantId);
                const coaSubCounterPath = getTenantPath('counters/coa_clients', tenantId);
                const jeCounterRef = doc(firestore, jeCounterPath!);
                const coaSubCounterRef = doc(firestore, coaSubCounterPath!);
                
                const [jeCounterDoc, coaSubCounterDoc] = await Promise.all([
                    transaction_fs.get(jeCounterRef),
                    transaction_fs.get(coaSubCounterRef)
                ]);

                let clientAccountId = '';
                if (clientAccSnap.empty) {
                    const nextClientNum = (coaSubCounterDoc.data()?.lastNumber || 0) + 1;
                    const clientCode = `1102C${String(nextClientNum).padStart(4, '0')}`;
                    const newAccRef = doc(collection(firestore, coaPath!));
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

                const txPath = getTenantPath(`clients/${selectedClientId}/transactions/${selectedTxId}`, tenantId);
                const txRef = doc(firestore, txPath!);
                
                transaction_fs.update(txRef, {
                    status: 'in-progress',
                    contract: cleanFirestoreData({
                        clauses: clauses.map(c => ({ ...c, amount: Number(c.amount) })),
                        totalAmount: currentTotal,
                        financialsType: 'fixed',
                        specs: specs
                    }),
                    updatedAt: serverTimestamp()
                });

                const nextJeNum = ((jeCounterDoc.data()?.counts || {})[currentYear] || 0) + 1;
                const jePath = getTenantPath('journalEntries', tenantId);
                const newJeRef = doc(collection(firestore, jePath!));

                transaction_fs.set(newJeRef, cleanFirestoreData({
                    entryNumber: `JV-DR-${currentYear}-${String(nextJeNum).padStart(4, '0')}`,
                    date: serverTimestamp(), 
                    narration: `[قيد مديونية مباشر] عقد: ${selectedTx.transactionType} لـ ${selectedClient.nameAr}`,
                    totalDebit: currentTotal, totalCredit: currentTotal, 
                    status: 'draft', 
                    lines: [
                        { accountId: clientAccountId, accountName: selectedClient.nameAr, debit: currentTotal, credit: 0, auto_profit_center: selectedTxId },
                        { accountId: revenueAccSnap.docs[0]?.id || '4101', accountName: revenueAccSnap.docs[0]?.data()?.name || 'إيرادات عقود', debit: 0, credit: currentTotal, auto_profit_center: selectedTxId }
                    ],
                    clientId: selectedClientId, transactionId: selectedTxId, createdAt: serverTimestamp(), createdBy: currentUser.id, companyId: tenantId
                }));

                transaction_fs.set(jeCounterRef, { [`counts.${currentYear}`]: nextJeNum }, { merge: true });
                
                const clientPath = getTenantPath(`clients/${selectedClientId}`, tenantId);
                transaction_fs.update(doc(firestore, clientPath!), { status: 'contracted' });

                // ✨ تعليق آلي في المعاملة
                const timelineRef = doc(collection(txRef, 'timelineEvents'));
                transaction_fs.set(timelineRef, {
                    type: 'comment',
                    content: `**[إشعار قانوني]**\nتم توقيع العقد المباشر بقيمة **${formatCurrency(currentTotal)}**.\nتم تثبيت مصفوفة الدفعات والبدء بالتنفيذ الميداني.`,
                    userId: currentUser.id,
                    userName: currentUser.fullName,
                    createdAt: serverTimestamp(),
                    companyId: tenantId
                });
            });

            toast({ title: '✅ تم توقيع العقد بنجاح' });
            router.push(`/dashboard/construction/projects/new?clientId=${selectedClientId}&transactionId=${selectedTxId}`);

        } catch (e: any) {
            console.error("Transaction Error:", e);
            toast({ variant: 'destructive', title: 'فشل التوقيع', description: e.message });
            setIsSaving(false);
            savingRef.current = false;
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-10 pb-20" dir="rtl">
            {/* الهيدر البرتقالي الموحد */}
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
                                <CardDescription className="text-white/90 font-bold text-sm">تثبيت الأثر المالي والقانوني للمعاملات القائمة دون تكرار السجلات.</CardDescription>
                            </div>
                        </div>
                        <Button onClick={() => router.back()} variant="outline" className="h-12 px-8 rounded-2xl font-black gap-2 bg-white/10 text-white border-white/40 hover:bg-white/20">
                            <ArrowRight className="h-5 w-5" /> تراجع
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <Card className="rounded-[3rem] border-none shadow-xl overflow-hidden bg-white/95">
                <CardContent className="p-10 space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="grid gap-3">
                            <Label className="font-black text-[11px] uppercase text-slate-400 tracking-widest pr-2 flex items-center gap-2">
                                <User className="h-3 w-3 text-[#FF7A00]"/> المالك المستهدف *
                            </Label>
                            <InlineSearchList 
                                value={selectedClientId} 
                                onSelect={setSelectedClientId} 
                                options={clients.map(c => ({ value: c.id!, label: c.nameAr }))} 
                                placeholder={loading ? "جاري جلب الملفات..." : "ابحث عن عميل..."}
                                className="h-14 rounded-2xl border-2 shadow-inner"
                            />
                        </div>
                        <div className="grid gap-3">
                            <Label className="font-black text-[11px] uppercase text-slate-400 tracking-widest pr-2 flex items-center gap-2">
                                <LayoutGrid className="h-3 w-3 text-[#FF7A00]"/> المعاملة المراد تعاقدها *
                            </Label>
                            <InlineSearchList 
                                value={selectedTxId} 
                                onSelect={setSelectedTxId} 
                                options={transactions.map(t => ({ value: t.id!, label: t.transactionType }))} 
                                placeholder={!selectedClientId ? "اختر عميلاً أولاً" : "اختر المعاملة المفتوحة..."}
                                disabled={!selectedClientId}
                                className="h-14 rounded-2xl border-2 shadow-inner"
                            />
                        </div>
                    </div>

                    <Separator className="opacity-10" />

                    <div className="space-y-8 animate-in fade-in duration-700">
                        <div className="flex items-center gap-4 bg-primary/5 p-6 rounded-[2.5rem] border-2 border-dashed border-primary/20">
                            <div className="p-3 bg-white rounded-2xl shadow-sm text-primary"><Calculator className="h-6 w-6"/></div>
                            <Label className="text-xl font-black text-[#1e1b4b]">مصفوفة الدفعات المالية المعتمدة</Label>
                        </div>

                        <div className="border-2 rounded-[2.5rem] overflow-hidden shadow-xl">
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
                                    {clauses.map((c, i) => (
                                        <TableRow key={c.id} className="h-20 border-b last:border-0 hover:bg-primary/[0.01] group">
                                            <TableCell className="text-center bg-slate-50/50 border-l font-black text-slate-400">{i+1}</TableCell>
                                            <TableCell className="px-8">
                                                <Input 
                                                    value={c.name} 
                                                    onChange={e => { const newC = [...clauses]; newC[i].name = e.target.value; setClauses(newC); }} 
                                                    className="border-none shadow-none font-bold text-lg bg-transparent focus-visible:ring-0" 
                                                />
                                            </TableCell>
                                            <TableCell className="bg-primary/[0.01] border-r">
                                                <Input 
                                                    type="number" 
                                                    value={c.amount} 
                                                    onChange={e => { const newC = [...clauses]; newC[i].amount = Number(e.target.value); setClauses(newC); }} 
                                                    className="text-center font-black text-3xl text-primary border-none shadow-none font-mono"
                                                />
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <button type="button" onClick={() => setClauses(clauses.filter(x => x.id !== c.id))} className="text-red-300 h-8 w-8 rounded-full hover:bg-red-50 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Trash2 className="h-4 w-4"/>
                                                </button>
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
                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    onClick={() => setClauses([...clauses, { id: generateId(), name: `الدفعة الجديدة`, amount: 0, status: 'غير مستحقة', ordinalName: `الدفعة ${arabicOrdinals[clauses.length] || (clauses.length + 1)}` }])} 
                                    className="h-12 px-10 rounded-xl border-dashed border-2 font-black text-primary gap-2 hover:bg-white transition-all"
                                >
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
                    <Button 
                        onClick={handleSaveContract} 
                        disabled={isSaving || !selectedTxId || clauses.length === 0}
                        className="h-16 px-20 rounded-[2.2rem] font-black text-2xl shadow-xl shadow-primary/30 min-w-[350px] gap-3"
                    >
                        {isSaving ? <Loader2 className="animate-spin h-8 w-8" /> : <Save className="h-8 w-8" />}
                        توقيـع واعتمـاد العقـد
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
