
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useDocument, useSubscription } from '@/firebase';
import { doc, runTransaction, collection, serverTimestamp, getDocs, query, where, Timestamp, getDoc, orderBy } from 'firebase/firestore';
import type { CustodyReconciliation, Account, JournalEntry } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, CheckCircle2, Save, ArrowRight, ShieldCheck, Calculator, Target, User, Banknote } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { toFirestoreDate } from '@/services/date-converter';
import { useAuth } from '@/context/auth-context';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';

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
    const [mappings, setMappings] = useState<Record<number, string>>({}); // index -> accountId

    const recRef = useMemo(() => (firestore && reconciliationId ? doc(firestore, 'custody_reconciliations', reconciliationId) : null), [firestore, reconciliationId]);
    const { data: rec, loading: recLoading } = useDocument<CustodyReconciliation>(firestore, recRef?.path || null);
    
    const { data: accounts = [], loading: accountsLoading } = useSubscription<Account>(firestore, 'chartOfAccounts', [orderBy('code')]);

    const expenseAccounts = useMemo(() => 
        accounts.filter(a => a.type === 'expense').map(a => ({ value: a.id!, label: `${a.name} (${a.code})` }))
    , [accounts]);

    const handleMappingChange = (index: number, accountId: string) => {
        setMappings(prev => ({ ...prev, [index]: accountId }));
    };

    const handleApprove = async () => {
        if (!firestore || !rec || !currentUser) return;

        // التحقق من ربط كافة الحسابات
        const allLinked = rec.items.every((_, idx) => !!mappings[idx]);
        if (!allLinked) {
            toast({ variant: 'destructive', title: 'توجيه ناقص', description: 'يرجى اختيار حساب مصروف لكل بند قبل الاعتماد المالي.' });
            return;
        }

        setIsSaving(true);
        try {
            await runTransaction(firestore, async (transaction) => {
                const currentYear = new Date().getFullYear();
                const jeCounterRef = doc(firestore, 'counters', 'journalEntries');
                const jeCounterDoc = await transaction.get(jeCounterRef);
                const nextJeNum = ((jeCounterDoc.data()?.counts || {})[currentYear] || 0) + 1;
                const jeNumber = `JV-REC-${currentYear}-${String(nextJeNum).padStart(4, '0')}`;

                // البحث عن حساب عهدة الموظف (تحت 110102)
                const custodyAcc = accounts.find(a => a.parentCode === '110102' && a.name.includes(rec.employeeName));
                if (!custodyAcc) throw new Error(`لم يتم العثور على حساب عهدة للموظف ${rec.employeeName} في شجرة الحسابات.`);

                const newJeRef = doc(collection(firestore, 'journalEntries'));
                
                const jeLines: any[] = [];
                // 1. أسطر المصاريف (Debits)
                rec.items.forEach((item, idx) => {
                    const selectedAcc = accounts.find(a => a.id === mappings[idx])!;
                    jeLines.push({
                        accountId: selectedAcc.id,
                        accountName: selectedAcc.name,
                        debit: item.amount,
                        credit: 0,
                        auto_profit_center: item.projectId || null,
                        clientId: item.clientId || null,
                        transactionId: item.projectId || null
                    });
                });

                // 2. سطر العهدة (Credit)
                jeLines.push({
                    accountId: custodyAcc.id,
                    accountName: custodyAcc.name,
                    debit: 0,
                    credit: rec.totalAmount
                });

                // ترحيل القيد
                transaction.set(newJeRef, cleanFirestoreData({
                    entryNumber: jeNumber,
                    date: rec.date,
                    narration: `اعتماد تسوية عهدة #${rec.reconciliationNumber} - الموظف: ${rec.employeeName}`,
                    status: 'posted',
                    totalDebit: rec.totalAmount,
                    totalCredit: rec.totalAmount,
                    lines: jeLines,
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.id
                }));

                // تحديث حالة التسوية
                transaction.update(recRef!, {
                    status: 'approved',
                    journalEntryId: newJeRef.id,
                    items: rec.items.map((item, idx) => ({
                        ...item,
                        category: mappings[idx],
                        categoryName: accounts.find(a => a.id === mappings[idx])?.name
                    }))
                });

                transaction.set(jeCounterRef, { counts: { [currentYear]: nextJeNum } }, { merge: true });
            });

            toast({ title: 'تم الاعتماد والترحيل', description: 'تم إنشاء قيد اليومية وتصفية مديونية عهدة الموظف بنجاح.' });
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
        <div className="max-w-5xl mx-auto space-y-6 pb-20" dir="rtl">
            <div className="flex items-center justify-between px-2">
                <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors font-bold">
                    <ArrowRight className="h-4 w-4" /> العودة للقائمة
                </button>
                <Badge variant="outline" className={cn("px-4 py-1 font-black", isProcessed ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700")}>
                    الحالة: {statusTranslations[rec.status]}
                </Badge>
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
                        <div className="text-left">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground block mb-1">المبلغ المطلوب تسويته</Label>
                            <p className="text-3xl font-black text-primary font-mono">{formatCurrency(rec.totalAmount)}</p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow className="h-14">
                                <TableHead className="px-8 font-black">بيان الموظف</TableHead>
                                <TableHead className="font-black">المشروع / العميل</TableHead>
                                <TableHead className="text-center font-black">المبلغ</TableHead>
                                <TableHead className="w-80 font-black text-primary bg-primary/5">التوجيه المحاسبي (المصروف) *</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rec.items.map((item, idx) => (
                                <TableRow key={idx} className="h-20 border-b last:border-0 hover:bg-muted/5 transition-colors">
                                    <TableCell className="px-8 font-bold">{item.description}</TableCell>
                                    <TableCell>
                                        <div className="space-y-1">
                                            {item.projectName && <p className="text-xs font-black text-primary flex items-center gap-1"><Target className="h-3 w-3"/> {item.projectName}</p>}
                                            {item.clientName && <p className="text-[10px] font-bold text-muted-foreground flex items-center gap-1"><User className="h-3 w-3"/> {item.clientName}</p>}
                                            {!item.projectName && !item.clientName && <span className="text-xs text-muted-foreground italic">عام / إداري</span>}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center font-black font-mono text-lg">{formatCurrency(item.amount)}</TableCell>
                                    <TableCell className="bg-primary/[0.02] px-4">
                                        {isProcessed ? (
                                            <Badge variant="outline" className="bg-white text-primary border-primary/20 font-bold px-4 py-1">
                                                {item.categoryName}
                                            </Badge>
                                        ) : (
                                            <InlineSearchList 
                                                value={mappings[idx] || ''}
                                                onSelect={(v) => handleMappingChange(idx, v)}
                                                options={expenseAccounts}
                                                placeholder="اربط بحساب مصروف..."
                                                className="bg-white border-primary/20 rounded-xl"
                                            />
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter className="bg-muted/10 h-16">
                            <TableRow>
                                <TableCell colSpan={2} className="text-right px-8 font-black">إجمالي البنود:</TableCell>
                                <TableCell className="text-center font-black font-mono text-xl text-primary">{formatCurrency(rec.totalAmount)}</TableCell>
                                <TableCell />
                            </TableRow>
                        </TableFooter>
                    </Table>

                    <div className="p-8 space-y-4">
                        <Label className="font-black text-lg flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-primary" /> ملاحظات المراجعة النهائية
                        </Label>
                        <div className="p-6 bg-muted/20 rounded-[2rem] border-2 border-dashed text-sm italic leading-relaxed">
                            {rec.notes || 'لم يتم إدراج ملاحظات إضافية من الموظف.'}
                        </div>
                    </div>
                </CardContent>
                
                {!isProcessed && (
                    <CardFooter className="p-8 bg-primary/5 border-t flex justify-between items-center">
                        <div className="space-y-1">
                            <p className="text-xs font-bold text-muted-foreground flex items-center gap-2">
                                <Calculator className="h-4 w-4"/> سيتم توليد قيد يومية آلي فور الاعتماد.
                            </p>
                        </div>
                        <Button onClick={handleApprove} disabled={isSaving} className="h-14 px-16 rounded-2xl font-black text-xl shadow-xl shadow-primary/20 gap-3 min-w-[300px]">
                            {isSaving ? <Loader2 className="animate-spin h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
                            اعتماد وترحيل القيد المحاسبي
                        </Button>
                    </CardFooter>
                )}
            </Card>
        </div>
    );
}
