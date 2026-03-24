'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useDocument, useSubscription } from '@/firebase';
import { doc, runTransaction, collection, serverTimestamp, getDocs, query, where, Timestamp, getDoc, orderBy, limit } from 'firebase/firestore';
import type { CustodyReconciliation, Account, JournalEntry, ConstructionProject, Client, Employee } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Save, ArrowRight, ShieldCheck, Calculator, Target, User, Banknote, ImageIcon, FileText, X, PencilLine, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { formatCurrency, cleanFirestoreData, cn } from '@/lib/utils';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { toFirestoreDate } from '@/services/date-converter';
import { useAuth } from '@/context/auth-context';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Input } from '../ui/input';
import Image from 'next/image';

const statusTranslations: Record<string, string> = {
    pending: 'بانتظار المراجعة',
    approved: 'تم الاعتماد والترحيل',
    rejected: 'مرفوضة',
};

interface Props {
  reconciliationId: string;
}

export function CustodyReconciliationDetails({ reconciliationId }: Props) {
    const { firestore } = useFirebase();
    const router = useRouter();
    const { toast } = useToast();
    const { user: currentUser } = useAuth();

    const [isSaving, setIsSaving] = useState(false);
    const [localItems, setLocalItems] = useState<any[]>([]);
    const [mappings, setMappings] = useState<Record<number, string>>({}); // index -> accountId

    const recRef = useMemo(() => (firestore && reconciliationId ? doc(firestore, 'custody_reconciliations', reconciliationId) : null), [firestore, reconciliationId]);
    const { data: rec, loading: recLoading } = useDocument<CustodyReconciliation>(firestore, recRef ? recRef.path : null);
    
    const { data: accounts = [], loading: accountsLoading } = useSubscription<Account>(firestore, 'chartOfAccounts', [orderBy('code')]);
    const { data: projects = [] } = useSubscription<ConstructionProject>(firestore, 'projects', [where('status', '==', 'قيد التنفيذ')]);
    const { data: clients = [] } = useSubscription<Client>(firestore, 'clients', [orderBy('nameAr')]);

    useEffect(() => {
        if (rec) {
            setLocalItems(rec.items || []);
            const initialMappings: Record<number, string> = {};
            rec.items.forEach((item, idx) => {
                if (item.category) initialMappings[idx] = item.category;
            });
            setMappings(initialMappings);
        }
    }, [rec]);

    const expenseAccounts = useMemo(() => 
        accounts.filter(a => a.type === 'expense').map(a => ({ value: a.id!, label: `${a.name} (${a.code})` }))
    , [accounts]);

    const costCenterOptions = useMemo(() => [
        ...projects.map(p => ({ value: p.id!, label: `مشروع: ${p.projectName}` })),
        ...clients.map(c => ({ value: c.id!, label: `عميل: ${c.nameAr}` }))
    ], [projects, clients]);

    const handleItemChange = (index: number, field: string, value: any) => {
        const updatedItems = [...localItems];
        updatedItems[index] = { ...updatedItems[index], [field]: value };
        
        if (field === 'projectId') {
            const proj = projects.find(p => p.id === value);
            updatedItems[index].projectName = proj?.projectName || null;
            updatedItems[index].projectId = value;
        } else if (field === 'clientId') {
            const client = clients.find(c => c.id === value);
            updatedItems[index].clientName = client?.nameAr || null;
            updatedItems[index].clientId = value;
        }

        setLocalItems(updatedItems);
    };

    const currentTotal = useMemo(() => 
        localItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
    , [localItems]);

    const handleApprove = async () => {
        if (!firestore || !rec || !currentUser) return;

        const allLinked = localItems.every((_, idx) => !!mappings[idx]);
        if (!allLinked) {
            toast({ variant: 'destructive', title: 'توجيه ناقص', description: 'يرجى اختيار حساب مصروف لكل بند قبل الاعتماد المالي.' });
            return;
        }

        setIsSaving(true);
        try {
            await runTransaction(firestore, async (transaction) => {
                const currentYear = new Date().getFullYear();
                
                const custodyAccQuery = query(
                    collection(firestore, 'chartOfAccounts'), 
                    where('employeeId', '==', rec.employeeId),
                    limit(1)
                );
                const custodyAccSnap = await getDocs(custodyAccQuery);

                if (custodyAccSnap.empty) {
                    throw new Error(`⚠️ تنبيه رقابي: لم يتم العثور على حساب عهدة مربوط بالموظف ${rec.employeeName} في شجرة الحسابات.`);
                }

                const custodyAccDoc = custodyAccSnap.docs[0];
                const custodyAcc = { id: custodyAccDoc.id, ...custodyAccDoc.data() } as Account;

                const jeCounterRef = doc(firestore, 'counters', 'journalEntries');
                const jeCounterDoc = await transaction.get(jeCounterRef);
                const nextJeNum = ((jeCounterDoc.data()?.counts || {})[currentYear] || 0) + 1;
                const jeNumber = `JV-REC-${currentYear}-${String(nextJeNum).padStart(4, '0')}`;

                const newJeRef = doc(collection(firestore, 'journalEntries'));
                
                const jeLines: any[] = [];
                const finalItemsToSave = localItems.map((item, idx) => {
                    const selectedAcc = accounts.find(a => a.id === mappings[idx])!;
                    
                    jeLines.push({
                        accountId: selectedAcc.id,
                        accountName: selectedAcc.name,
                        debit: Number(item.amount),
                        credit: 0,
                        auto_profit_center: item.projectId || null,
                        clientId: item.clientId || null,
                        transactionId: item.projectId || null,
                        auto_resource_id: rec.employeeId 
                    });

                    return {
                        ...item,
                        category: mappings[idx],
                        categoryName: selectedAcc.name
                    };
                });

                jeLines.push({
                    accountId: custodyAcc.id!,
                    accountName: custodyAcc.name,
                    debit: 0,
                    credit: currentTotal
                });

                transaction.set(newJeRef, cleanFirestoreData({
                    entryNumber: jeNumber,
                    date: rec.date,
                    narration: `اعتماد تسوية عهدة #${rec.reconciliationNumber} - الموظف: ${rec.employeeName}`,
                    status: 'posted',
                    totalDebit: currentTotal,
                    totalCredit: currentTotal,
                    lines: jeLines,
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.id
                }));

                transaction.update(recRef!, {
                    status: 'approved',
                    journalEntryId: newJeRef.id,
                    totalAmount: currentTotal, 
                    items: finalItemsToSave
                });

                transaction.set(jeCounterRef, { counts: { [currentYear]: nextJeNum } }, { merge: true });
            });

            toast({ title: 'تم الاعتماد والترحيل', description: 'تم إنشاء قيد اليومية وتحديث مديونية العهدة بنجاح.' });
            router.push('/dashboard/hr/custody-reconciliation');
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'خطأ في الربط المالي', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    if (recLoading || accountsLoading) return <div className="p-8 max-w-5xl mx-auto"><Skeleton className="h-96 w-full rounded-[2.5rem]" /></div>;
    if (!rec) return <div className="text-center p-20">التسوية غير موجودة.</div>;

    const isProcessed = rec.status !== 'pending';

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-20" dir="rtl">
            <div className="flex items-center justify-between px-2">
                <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors font-bold">
                    <ArrowRight className="h-4 w-4" /> العودة للقائمة
                </button>
                <div className="flex items-center gap-3">
                    {!isProcessed && <Badge className="bg-primary/10 text-primary border-primary/20 flex items-center gap-1.5"><PencilLine className="h-3 w-3"/> وضع التدقيق والتعديل نشط</Badge>}
                    <Badge variant="outline" className={cn("px-4 py-1 font-black", isProcessed ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700")}>
                        {statusTranslations[rec.status]}
                    </Badge>
                </div>
            </div>

            <Card className="rounded-[2.5rem] shadow-xl border-none overflow-hidden bg-card">
                <CardHeader className="bg-primary/5 pb-8 px-8 border-b">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <CardTitle className="text-2xl font-black">مراجعة تسوية عهدة #{rec.reconciliationNumber}</CardTitle>
                            <CardDescription className="font-bold flex items-center gap-2">
                                <User className="h-4 w-4 text-primary" /> الموظف: {rec.employeeName}
                            </CardDescription>
                        </div>
                        <div className="text-left bg-white p-4 rounded-2xl border shadow-inner">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground block mb-1">إجمالي المبلغ (بعد التدقيق)</Label>
                            <p className="text-3xl font-black text-primary font-mono">{formatCurrency(currentTotal)}</p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow className="h-14">
                                <TableHead className="px-8 font-black text-slate-900">بيان المصروف والوثائق</TableHead>
                                <TableHead className="font-black w-64 text-slate-900">الارتباط بمشروع / عميل</TableHead>
                                <TableHead className="text-center font-black w-32 text-slate-900">المبلغ (د.ك)</TableHead>
                                <TableHead className="w-72 font-black text-primary bg-primary/5">توجيه حساب المصروف *</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {localItems.map((item, idx) => (
                                <TableRow key={idx} className="h-auto border-b last:border-0 hover:bg-muted/5 transition-colors">
                                    <TableCell className="px-8 py-6 space-y-4">
                                        {isProcessed ? (
                                            <p className="font-bold text-lg">{item.description}</p>
                                        ) : (
                                            <Input 
                                                value={item.description} 
                                                onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                                                className="font-bold text-base h-10 rounded-xl bg-white border-2 text-foreground shadow-sm"
                                            />
                                        )}
                                        
                                        {item.attachmentUrls && item.attachmentUrls.length > 0 && (
                                            <ScrollArea className="w-full bg-muted/20 rounded-2xl border h-24">
                                                <div className="flex p-2 gap-3">
                                                    {item.attachmentUrls.map((url: string, imgIdx: number) => (
                                                        <a 
                                                            key={imgIdx} 
                                                            href={url} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-white shadow-sm flex-shrink-0 hover:scale-105 transition-transform group"
                                                        >
                                                            <Image src={url} alt="Receipt" fill className="object-cover" />
                                                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                <ImageIcon className="h-4 w-4 text-white" />
                                                            </div>
                                                        </a>
                                                    ))}
                                                </div>
                                                <ScrollBar orientation="horizontal" />
                                            </ScrollArea>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {isProcessed ? (
                                            <div className="space-y-1">
                                                {item.projectName && <p className="text-xs font-black text-primary flex items-center gap-1"><Target className="h-3 w-3"/> {item.projectName}</p>}
                                                {item.clientName && <p className="text-[10px] font-bold text-muted-foreground flex items-center gap-1"><User className="h-3 w-3"/> {item.clientName}</p>}
                                                {!item.projectName && !item.clientName && <span className="text-xs text-muted-foreground italic">عام / إداري</span>}
                                            </div>
                                        ) : (
                                            <InlineSearchList 
                                                value={item.projectId || item.clientId || ''}
                                                onSelect={(v) => {
                                                    const isProject = projects.some(p => p.id === v);
                                                    handleItemChange(idx, isProject ? 'projectId' : 'clientId', v);
                                                }}
                                                options={costCenterOptions}
                                                placeholder="اربط بمشروع..."
                                                className="h-10 rounded-xl text-xs border-dashed bg-white shadow-sm"
                                            />
                                        )}
                                    </TableCell>
                                    <TableCell className="text-center font-black">
                                        {isProcessed ? (
                                            <span className="font-mono text-xl">{formatCurrency(item.amount)}</span>
                                        ) : (
                                            <Input 
                                                type="number" 
                                                step="any"
                                                value={item.amount} 
                                                onChange={(e) => handleItemChange(idx, 'amount', e.target.value)}
                                                className="text-center font-black font-mono text-lg h-10 rounded-xl border-2 border-primary/20 text-primary bg-white shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                onWheel={(e) => e.currentTarget.blur()}
                                            />
                                        )}
                                    </TableCell>
                                    <TableCell className="bg-primary/[0.02] px-4">
                                        {isProcessed ? (
                                            <Badge variant="outline" className="bg-white text-primary border-primary/20 font-black px-4 py-1 rounded-full w-full justify-center">
                                                {item.categoryName}
                                            </Badge>
                                        ) : (
                                            <InlineSearchList 
                                                value={mappings[idx] || ''}
                                                onSelect={v => setMappings(prev => ({ ...prev, [idx]: v }))}
                                                options={expenseAccounts}
                                                placeholder="اختر حساب المصروف..."
                                                className="bg-white border-primary/30 rounded-xl h-10 shadow-sm"
                                            />
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter className="bg-muted/10 h-16">
                            <TableRow>
                                <TableCell colSpan={2} className="text-right px-8 font-black">إجمالي المصروفات المعالجة:</TableCell>
                                <TableCell className="text-center font-black font-mono text-xl text-primary">{formatCurrency(currentTotal)}</TableCell>
                                <TableCell />
                            </TableRow>
                        </TableFooter>
                    </Table>

                    <div className="p-8 space-y-4">
                        <Label className="font-black text-lg flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-primary" /> ملاحظات الموظف وبيانات التسوية
                        </Label>
                        <div className="p-6 bg-white rounded-[2rem] border-2 border-dashed text-sm italic leading-relaxed shadow-inner">
                            {rec.notes || 'لم يتم إدراج ملاحظات إضافية من الموظف.'}
                        </div>
                    </div>
                </CardContent>
                
                {!isProcessed && (
                    <CardFooter className="p-10 bg-primary/5 border-t flex justify-between items-center">
                        <div className="space-y-1">
                            <p className="text-sm font-black text-primary flex items-center gap-2">
                                <Calculator className="h-5 w-5"/> سيتم توليد قيد يومية آلي بالمبالغ المحدثة أعلاه.
                            </p>
                            <p className="text-[10px] text-muted-foreground font-bold pr-7">التغييرات التي أجريتها الآن لن تُحفظ في المستند الأصلي إلا بعد الضغط على زر الاعتماد.</p>
                        </div>
                        <Button onClick={handleApprove} disabled={isSaving} className="h-16 px-20 rounded-3xl font-black text-2xl shadow-xl shadow-primary/30 gap-4 min-w-[350px]">
                            {isSaving ? <Loader2 className="animate-spin h-8 w-8" /> : <Save className="h-8 w-8" />}
                            اعتماد وترحيل القيد المحاسبي
                        </Button>
                    </CardFooter>
                )}
            </Card>
        </div>
    );
}
