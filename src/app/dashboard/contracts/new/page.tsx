
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { collection, query, getDocs, orderBy, where, doc, runTransaction, serverTimestamp, limit } from 'firebase/firestore';
import type { Client, ClientTransaction, Account, ContractTemplate } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { 
    FileSignature, 
    User, 
    ArrowRight, 
    Loader2, 
    CheckCircle2, 
    AlertCircle,
    Calculator,
    LayoutGrid,
    Trash2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { formatCurrency, cleanFirestoreData, cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const generateId = () => Math.random().toString(36).substring(2, 9);

export default function DirectContractPage() {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    const [selectedClientId, setSelectedClientId] = useState('');
    const [selectedTxId, setSelectedTxId] = useState('');
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    
    const [clients, setClients] = useState<Client[]>([]);
    const [transactions, setTransactions] = useState<ClientTransaction[]>([]);
    const [templates, setTemplates] = useState<ContractTemplate[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // بنود العقد الحالي
    const [clauses, setClauses] = useState<any[]>([]);
    const [financialsType, setFinancialsType] = useState<'fixed' | 'percentage'>('fixed');
    const [totalContractValue, setTotalContractValue] = useState(0);

    useEffect(() => {
        if (!firestore) return;
        const fetchRefData = async () => {
            setLoading(true);
            try {
                const [clientsSnap, templatesSnap, accountsSnap] = await Promise.all([
                    getDocs(query(collection(firestore, 'clients'), where('isActive', '==', true))),
                    getDocs(query(collection(firestore, 'contractTemplates'), orderBy('title'))),
                    getDocs(query(collection(firestore, 'chartOfAccounts')))
                ]);
                
                setClients(clientsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Client)));
                setTemplates(templatesSnap.docs.map(d => ({ id: d.id, ...d.data() } as ContractTemplate)));
                setAccounts(accountsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Account)));
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetchRefData();
    }, [firestore]);

    useEffect(() => {
        if (!firestore || !selectedClientId) {
            setTransactions([]);
            return;
        }
        const fetchTransactions = async () => {
            const q = query(collection(firestore, `clients/${selectedClientId}/transactions`), where('status', '==', 'new'));
            const snap = await getDocs(q);
            setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as ClientTransaction)));
        };
        fetchTransactions();
    }, [selectedClientId, firestore]);

    const handleTemplateSelect = (tId: string) => {
        setSelectedTemplateId(tId);
        const template = templates.find(t => t.id === tId);
        if (template && template.financials) {
            setFinancialsType(template.financials.type);
            setTotalContractValue(template.financials.totalAmount || 0);
            setClauses((template.financials.milestones || []).map(m => ({
                id: generateId(),
                name: m.name,
                amount: template.financials?.type === 'fixed' ? m.value : 0,
                percentage: template.financials?.type === 'percentage' ? m.value : 0,
                condition: m.condition || '',
                status: 'غير مستحقة'
            })));
        }
    };

    const currentTotal = useMemo(() => {
        if (financialsType === 'fixed') return clauses.reduce((s, c) => s + (Number(c.amount) || 0), 0);
        return clauses.reduce((s, c) => s + (Number(c.percentage) || 0), 0);
    }, [clauses, financialsType]);

    const handleSaveContract = async () => {
        if (!firestore || !currentUser || !selectedClientId || !selectedTxId || clauses.length === 0) return;
        
        setIsSaving(true);
        try {
            const selectedClient = clients.find(c => c.id === selectedClientId)!;
            const selectedTx = transactions.find(t => t.id === selectedTxId)!;
            const finalTotal = financialsType === 'fixed' ? currentTotal : totalContractValue;

            await runTransaction(firestore, async (transaction_fs) => {
                const currentYear = new Date().getFullYear();
                const revenueAccSnap = await getDocs(query(collection(firestore, 'chartOfAccounts'), where('code', '==', '4101'), limit(1)));
                const clientAccSnap = await getDocs(query(collection(firestore, 'chartOfAccounts'), where('name', '==', selectedClient.nameAr), limit(1)));
                const jeCounterRef = doc(firestore, 'counters', 'journalEntries');
                const jeCounterDoc = await transaction_fs.get(jeCounterRef);
                const nextJeNum = ((jeCounterDoc.data()?.counts || {})[currentYear] || 0) + 1;

                const txRef = doc(firestore, `clients/${selectedClientId}/transactions/${selectedTxId}`);
                
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

                transaction_fs.update(doc(firestore, 'clients', selectedClientId), { status: 'contracted' });

                if (!revenueAccSnap.empty && !clientAccSnap.empty) {
                    const newJeRef = doc(collection(firestore, 'journalEntries'));
                    transaction_fs.set(newJeRef, {
                        entryNumber: `JV-DIRECT-${currentYear}-${String(nextJeNum).padStart(4, '0')}`,
                        date: serverTimestamp(),
                        narration: `إثبات مديونية عقد مباشر: ${selectedTx.transactionType}`,
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
                        createdBy: currentUser.id
                    });
                    transaction_fs.set(jeCounterRef, { counts: { [currentYear]: nextJeNum } }, { merge: true });
                }
            });

            toast({ title: 'نجاح الربط المالي', description: 'تم إنشاء العقد والقيد المحاسبي. سننتقل الآن لتأسيس هيكل المشروع.' });
            router.push(`/dashboard/construction/projects/new?clientId=${selectedClientId}&transactionId=${selectedTxId}`);

        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ في الترحيل' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-gradient-to-l from-white to-emerald-50">
                <CardHeader className="pb-8">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-[#1B4D3E]/10 rounded-2xl text-[#1B4D3E] shadow-inner">
                            <FileSignature className="h-8 w-8" />
                        </div>
                        <div>
                            <CardTitle className="text-3xl font-black text-[#1B4D3E]">توقيع عقد مباشر</CardTitle>
                            <CardDescription className="text-base font-medium">ربط مالي وقانوني فوري للمعاملات المعتمدة بدون الحاجة لمسودة عرض سعر.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card className="rounded-3xl border-none shadow-xl overflow-hidden">
                <CardContent className="p-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="grid gap-2">
                            <Label className="font-bold flex items-center gap-2"><User className="h-4 w-4 text-[#1B4D3E]"/> العميل / المالك *</Label>
                            <InlineSearchList 
                                value={selectedClientId} 
                                onSelect={setSelectedClientId} 
                                options={clients.map(c => ({ value: c.id!, label: c.nameAr }))} 
                                placeholder={loading ? "جاري التحميل..." : "ابحث عن عميل..."}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold flex items-center gap-2"><LayoutGrid className="h-4 w-4 text-[#1B4D3E]"/> المعاملة المستهدفة *</Label>
                            <InlineSearchList 
                                value={selectedTxId} 
                                onSelect={setSelectedTxId} 
                                options={transactions.map(t => ({ value: t.id!, label: t.transactionType }))} 
                                placeholder={!selectedClientId ? "اختر عميلاً أولاً" : "اختر الخدمة لربط العقد..."}
                                disabled={!selectedClientId}
                            />
                        </div>
                    </div>

                    <Separator />

                    <div className="grid gap-2">
                        <Label className="font-black text-[#1B4D3E]">تحميل بيانات العقد من نموذج جاهز</Label>
                        <InlineSearchList 
                            value={selectedTemplateId} 
                            onSelect={handleTemplateSelect} 
                            options={templates.map(t => ({ value: t.id!, label: t.title }))} 
                            placeholder="اختر قالباً للتعبئة التلقائية..."
                        />
                    </div>

                    {clauses.length > 0 && (
                        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-black flex items-center gap-2 text-foreground"><Calculator className="h-5 w-5 text-[#1B4D3E]"/> ترتيب الدفعات المالية</h3>
                                {financialsType === 'fixed' ? (
                                    <Badge variant="outline" className="bg-emerald-50 text-[#1B4D3E] border-[#1B4D3E]/20 font-black">نظام المبالغ الثابتة</Badge>
                                ) : (
                                    <div className="flex items-center gap-3 bg-emerald-50 p-2 rounded-xl border border-emerald-100">
                                        <Label className="text-xs font-black text-[#1B4D3E]">إجمالي العقد التقديري:</Label>
                                        <Input 
                                            type="number" 
                                            value={totalContractValue} 
                                            onChange={e => setTotalContractValue(Number(e.target.value))} 
                                            className="w-32 h-8 font-mono font-black text-center border-[#1B4D3E]/20"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="border-2 rounded-[2rem] overflow-hidden shadow-sm bg-muted/10">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow className="h-12 border-b-2">
                                            <TableHead className="px-6 font-bold">بيان الدفعة</TableHead>
                                            <TableHead className="text-center w-40 font-bold">{financialsType === 'percentage' ? 'النسبة (%)' : 'المبلغ (د.ك)'}</TableHead>
                                            <TableHead className="w-12"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {clauses.map((c, i) => (
                                            <TableRow key={c.id} className="h-14 bg-white border-b last:border-0">
                                                <TableCell className="px-4"><Input value={c.name} onChange={e => { const newC = [...clauses]; newC[i].name = e.target.value; setClauses(newC); }} className="border-none shadow-none font-bold" /></TableCell>
                                                <TableCell>
                                                    <Input 
                                                        type="number" 
                                                        value={financialsType === 'fixed' ? c.amount : c.percentage} 
                                                        onChange={e => {
                                                            const newC = [...clauses];
                                                            if (financialsType === 'fixed') newC[i].amount = Number(e.target.value);
                                                            else newC[i].percentage = Number(e.target.value);
                                                            setClauses(newC);
                                                        }} 
                                                        className="text-center font-black text-xl text-[#1B4D3E] border-none shadow-none"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" onClick={() => setClauses(clauses.filter(x => x.id !== c.id))} className="text-destructive rounded-full"><Trash2 className="h-4 w-4"/></Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                    <TableFooter className="bg-emerald-50">
                                        <TableRow className="h-16">
                                            <TableCell className="text-right px-12 font-black text-lg">المجموع الحالي للبنود:</TableCell>
                                            <TableCell className={cn("text-center font-mono text-2xl font-black", financialsType === 'percentage' && currentTotal !== 100 ? "text-red-600" : "text-[#1B4D3E]")}>
                                                {financialsType === 'fixed' ? formatCurrency(currentTotal) : `${currentTotal}%`}
                                            </TableCell>
                                            <TableCell />
                                        </TableRow>
                                    </TableFooter>
                                </Table>
                            </div>
                            
                            {financialsType === 'percentage' && currentTotal !== 100 && (
                                <Alert variant="destructive" className="rounded-2xl border-2">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>خلل في النسب</AlertTitle>
                                    <AlertDescription>يجب أن يكون مجموع نسب الدفعات 100% ليتمكن النظام من توزيع مديونية العقد بدقة.</AlertDescription>
                                </Alert>
                            )}
                        </div>
                    )}
                </CardContent>
                <CardFooter className="p-8 border-t bg-muted/10 flex justify-between items-center">
                    <Button variant="ghost" onClick={() => router.back()} className="font-bold gap-2">
                        <ArrowRight className="h-4 w-4" /> العودة
                    </Button>
                    <Button 
                        onClick={handleSaveContract} 
                        disabled={isSaving || !selectedTxId || (financialsType === 'percentage' && currentTotal !== 100)}
                        style={{ backgroundColor: '#1B4D3E' }}
                        className="h-14 px-16 rounded-2xl font-black text-xl text-white shadow-2xl shadow-emerald-200 gap-3 min-w-[300px] hover:brightness-110 transition-all"
                    >
                        {isSaving ? <Loader2 className="animate-spin h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}
                        اعتماد العقد المباشر
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
