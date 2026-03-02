
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { 
  Save, 
  X, 
  Loader2, 
  HardHat, 
  Briefcase, 
  FileCheck,
  Calculator
} from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, getDocs, runTransaction, doc, getDoc, serverTimestamp, orderBy, where, Timestamp, collectionGroup } from 'firebase/firestore';
import type { Subcontractor, ConstructionProject, Account, Employee, Department, ClientTransaction } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cleanFirestoreData, numberToArabicWords } from '@/lib/utils';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useAuth } from '@/context/auth-context';
import { DateInput } from '@/components/ui/date-input';

export function SubcontractorCertificateForm() {
    const router = useRouter();
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();

    const [isSaving, setIsSaving] = useState(false);
    const [certNumber, setCertNumber] = useState('جاري التوليد...');
    const [accounts, setAccounts] = useState<Account[]>([]);

    const [formData, setFormData] = useState({
        date: new Date(),
        subcontractorId: '',
        projectId: '',
        amount: '',
        description: '',
    });

    const { data: subcontractors = [], loading: subsLoading } = useSubscription<Subcontractor>(firestore, 'subcontractors', [where('isActive', '==', true)]);
    const { data: projects = [], loading: projectsLoading } = useSubscription<ConstructionProject>(firestore, 'projects', [where('status', '==', 'قيد التنفيذ')]);
    
    const [transactions, setTransactions] = useState<any[]>([]);
    useEffect(() => {
        if (!firestore) return;
        
        getDocs(collectionGroup(firestore, 'transactions')).then(snap => {
            const txs = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter((t: any) => t.status === 'in-progress' || t.status === 'new');
            setTransactions(txs);
        });

        getDocs(query(collection(firestore, 'chartOfAccounts'))).then(snap => {
            setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Account)));
        });
    }, [firestore]);

    useEffect(() => {
        if (!firestore) return;
        const generateCertNumber = async () => {
            const currentYear = new Date().getFullYear();
            const counterRef = doc(firestore, 'counters', 'subcontractorCertificates');
            const counterDoc = await getDoc(counterRef);
            let nextNumber = 1;
            if (counterDoc.exists()) {
                const counts = counterDoc.data()?.counts || {};
                nextNumber = (counts[currentYear] || 0) + 1;
            }
            setCertNumber(`SPC-${currentYear}-${String(nextNumber).padStart(4, '0')}`);
        };
        generateCertNumber();
    }, [firestore]);

    const subOptions = useMemo(() => subcontractors.map(s => ({ value: s.id!, label: s.name })), [subcontractors]);
    const projectOptions = useMemo(() => [
        ...projects.map(p => ({ value: p.id!, label: `مشروع: ${p.projectName}` })),
        ...transactions.map(t => ({ value: t.id!, label: `معاملة: ${t.transactionType}` }))
    ], [projects, transactions]);

    const amountInWords = useMemo(() => {
        const val = parseFloat(formData.amount);
        return isNaN(val) ? '' : numberToArabicWords(val);
    }, [formData.amount]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !currentUser) return;

        if (!formData.subcontractorId || !formData.projectId || !formData.amount) {
            toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'الرجاء اختيار المقاول والمشروع والمبلغ.' });
            return;
        }

        setIsSaving(true);
        try {
            const subExpenseAccount = accounts.find(a => a.code === '5102'); // تكاليف المقاولين
            const parentApAccount = accounts.find(a => a.code === '2101'); // حساب الموردين الرئيسي

            if (!subExpenseAccount || !parentApAccount) throw new Error("حسابات التكاليف أو الموردين غير موجودة في الشجرة.");

            await runTransaction(firestore, async (transaction) => {
                const currentYear = new Date().getFullYear();
                const counterRef = doc(firestore, 'counters', 'subcontractorCertificates');
                const coaSubCounterRef = doc(firestore, 'counters', 'coa_subcontractors');
                
                const [counterDoc, coaSubCounterDoc] = await Promise.all([
                    transaction.get(counterRef),
                    transaction.get(coaSubCounterRef)
                ]);

                const subcontractor = subcontractors.find(s => s.id === formData.subcontractorId)!;
                const project = projects.find(p => p.id === formData.projectId) || transactions.find(t => t.id === formData.projectId);
                
                // البحث عن أو إنشاء حساب فرعي للمقاول
                let subAccount = accounts.find(a => a.name === subcontractor.name && a.parentCode === '2101');
                if (!subAccount) {
                    const nextSubNum = (coaSubCounterDoc.data()?.lastNumber || 0) + 1;
                    const subCode = `2101S${String(nextSubNum).padStart(3, '0')}`;
                    const newAccRef = doc(collection(firestore, 'chartOfAccounts'));
                    subAccount = { id: newAccRef.id, code: subCode, name: subcontractor.name, type: 'liability', level: 3, parentCode: '2101', isPayable: true, statement: 'Balance Sheet', balanceType: 'Credit' } as Account;
                    transaction.set(newAccRef, subAccount);
                    transaction.set(coaSubCounterRef, { lastNumber: nextSubNum }, { merge: true });
                }

                const nextNumber = ((counterDoc.data()?.counts || {})[currentYear] || 0) + 1;
                const finalCertNumber = `SPC-${currentYear}-${String(nextNumber).padStart(4, '0')}`;

                const newCertRef = doc(collection(firestore, 'subcontractor_certificates'));
                const newJeRef = doc(collection(firestore, 'journalEntries'));
                const amount = parseFloat(formData.amount);

                // إنشاء قيد استحقاق (مدين: تكلفة مشروع / دائن: المقاول)
                transaction.set(newJeRef, {
                    entryNumber: `JE-${finalCertNumber}`,
                    date: Timestamp.fromDate(formData.date),
                    narration: `إثبات مستحقات مقاول باطن (${subcontractor.name}) - مشروع: ${project?.projectName || project?.transactionType}`,
                    status: 'draft',
                    totalDebit: amount,
                    totalCredit: amount,
                    lines: [
                        { accountId: subExpenseAccount.id!, accountName: subExpenseAccount.name, debit: amount, credit: 0, auto_profit_center: formData.projectId },
                        { accountId: subAccount.id!, accountName: subAccount.name, debit: 0, credit: amount, auto_profit_center: formData.projectId }
                    ],
                    transactionId: formData.projectId,
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.id
                });

                transaction.set(newCertRef, cleanFirestoreData({
                    certificateNumber: finalCertNumber,
                    ...formData,
                    amount,
                    subcontractorName: subcontractor.name,
                    projectName: project?.projectName || project?.transactionType,
                    status: 'draft',
                    journalEntryId: newJeRef.id,
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.id,
                }));

                transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
            });

            toast({ title: 'نجاح الربط المالي', description: 'تم إصدار الشهادة وتوليد القيد المحاسبي كمسودة.' });
            router.push('/dashboard/construction/subcontractors/certificates');
        } catch (error: any) {
            console.error(error);
            toast({ variant: 'destructive', title: 'خطأ', description: error.message || 'فشل حفظ الشهادة.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="max-w-3xl mx-auto rounded-[2.5rem] border-none shadow-2xl overflow-hidden" dir="rtl">
            <form onSubmit={handleSubmit}>
                <CardHeader className="bg-primary/5 pb-8 border-b">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner"><FileCheck className="h-8 w-8"/></div>
                        <div>
                            <CardTitle className="text-2xl font-black">إصدار شهادة إنجاز أعمال مقاول باطن</CardTitle>
                            <CardDescription>تُستخدم هذه الشهادة لإثبات الاستحقاق المالي للمقاول وتحميله على تكاليف المشروع.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">رقم الشهادة المرجعي</Label>
                            <Input value={certNumber} disabled className="font-mono font-black text-xl text-primary bg-muted/20 h-12" />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">تاريخ الشهادة</Label>
                            <DateInput value={formData.date} onChange={(d) => setFormData(p => ({...p, date: d || new Date()}))} className="h-12" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1 flex items-center gap-2"><HardHat className="h-4 w-4 text-primary"/> المقاول المنفذ *</Label>
                            <InlineSearchList 
                                value={formData.subcontractorId} 
                                onSelect={(v) => setFormData(p => ({...p, subcontractorId: v}))}
                                options={subOptions}
                                placeholder={subsLoading ? "جاري التحميل..." : "اختر المقاول..."}
                                className="h-12 rounded-xl"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1 flex items-center gap-2"><Briefcase className="h-4 w-4 text-primary"/> المشروع المستهدف *</Label>
                            <InlineSearchList 
                                value={formData.projectId} 
                                onSelect={(v) => setFormData(p => ({...p, projectId: v}))}
                                options={projectOptions}
                                placeholder={projectsLoading ? "جاري التحميل..." : "اختر المشروع لربط التكلفة..."}
                                className="h-12 rounded-xl"
                            />
                        </div>
                    </div>

                    <div className="p-8 bg-muted/30 rounded-[2rem] border-2 border-dashed border-primary/10">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                            <div className="grid gap-2 md:col-span-1">
                                <Label className="text-lg font-black text-primary mb-1">المبلغ المعتمد (د.ك) *</Label>
                                <Input 
                                    type="number" step="0.001" 
                                    value={formData.amount} 
                                    onChange={e => setFormData(p => ({...p, amount: e.target.value}))}
                                    className="h-14 text-3xl font-black font-mono text-primary dir-ltr text-center rounded-2xl shadow-inner border-2 border-primary/20"
                                    placeholder="0.000"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground mb-2 block">المبلغ الإجمالي كتابةً:</Label>
                                <div className="p-4 bg-background rounded-2xl border-2 text-sm font-bold text-muted-foreground min-h-[56px] flex items-center justify-center italic">
                                    {amountInWords}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label className="font-bold mr-1">بيان تفصيلي بالأعمال المنجزة</Label>
                        <Textarea 
                            value={formData.description} 
                            onChange={e => setFormData(p => ({...p, description: e.target.value}))}
                            placeholder="مثال: إكمال تمديدات الكهرباء للدور الأرضي، صب خرسانة السقف..."
                            rows={4}
                            className="rounded-2xl border-2"
                        />
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-4 p-8 border-t bg-muted/10">
                    <Button type="button" variant="ghost" onClick={() => router.back()} disabled={isSaving} className="h-12 px-8 rounded-xl font-bold">إلغاء</Button>
                    <Button onClick={handleSubmit} disabled={isSaving} className="h-14 px-16 rounded-2xl font-black text-xl shadow-2xl shadow-primary/30 min-w-[300px] gap-3">
                        {isSaving ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6"/>}
                        اعتماد الشهادة والترحيل المالي
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
