
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { collection, query, getDocs, runTransaction, doc, getDoc, serverTimestamp, orderBy, where, Timestamp } from 'firebase/firestore';
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
    
    // Also fetch transactions to support certificates for non-executive projects if needed
    const [transactions, setTransactions] = useState<any[]>([]);
    useEffect(() => {
        if (!firestore) return;
        getDocs(query(collectionGroup(firestore, 'transactions'), where('status', '==', 'in-progress'))).then(snap => {
            setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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

        const subExpenseAccount = accounts.find(a => a.code === '5102'); // تكاليف المقاولين من الباطن
        const apAccount = accounts.find(a => a.code === '2101'); // الموردون والمقاولون

        if (!subExpenseAccount || !apAccount) {
            toast({ variant: 'destructive', title: 'خطأ محاسبي', description: 'حسابات التكاليف أو المقاولين غير معرفة في الشجرة.' });
            return;
        }

        setIsSaving(true);
        try {
            await runTransaction(firestore, async (transaction) => {
                const currentYear = new Date().getFullYear();
                const counterRef = doc(firestore, 'counters', 'subcontractorCertificates');
                const counterDoc = await transaction.get(counterRef);
                const nextNumber = ((counterDoc.data()?.counts || {})[currentYear] || 0) + 1;
                const finalCertNumber = `SPC-${currentYear}-${String(nextNumber).padStart(4, '0')}`;

                const subcontractor = subcontractors.find(s => s.id === formData.subcontractorId)!;
                const project = projects.find(p => p.id === formData.projectId) || transactions.find(t => t.id === formData.projectId);
                
                const newCertRef = doc(collection(firestore, 'subcontractor_certificates'));
                const newJeRef = doc(collection(firestore, 'journalEntries'));

                const amount = parseFloat(formData.amount);

                // Accounting Logic
                const jeData = {
                    entryNumber: `JE-${finalCertNumber}`,
                    date: Timestamp.fromDate(formData.date),
                    narration: `إثبات إنجاز أعمال مقاول باطن (${subcontractor.name}) - ${formData.description}`,
                    status: 'draft',
                    totalDebit: amount,
                    totalCredit: amount,
                    lines: [
                        { 
                            accountId: subExpenseAccount.id!, 
                            accountName: subExpenseAccount.name, 
                            debit: amount, credit: 0,
                            auto_profit_center: formData.projectId,
                        },
                        { 
                            accountId: apAccount.id!, 
                            accountName: apAccount.name, 
                            debit: 0, credit: amount,
                            auto_profit_center: formData.projectId,
                        }
                    ],
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.id,
                    transactionId: formData.projectId,
                };

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

                transaction.set(newJeRef, jeData);
                transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
            });

            toast({ title: 'نجاح', description: 'تم إنشاء شهادة الإنجاز والقيد المحاسبي كمسودة.' });
            router.push('/dashboard/construction/subcontractors');
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ الشهادة.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="max-w-3xl mx-auto" dir="rtl">
            <form onSubmit={handleSubmit}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><FileCheck className="text-primary"/> إصدار شهادة إنجاز أعمال مقاول باطن</CardTitle>
                    <CardDescription>تُستخدم هذه الشهادة لإثبات نسبة إنجاز المقاول وتحميل قيمتها كمصروف على المشروع.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="grid gap-2">
                            <Label>رقم الشهادة (تلقائي)</Label>
                            <Input value={certNumber} disabled className="font-mono font-bold text-primary" />
                        </div>
                        <div className="grid gap-2">
                            <Label>تاريخ الشهادة</Label>
                            <DateInput value={formData.date} onChange={(d) => setFormData(p => ({...p, date: d || new Date()}))} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="grid gap-2">
                            <Label>المقاول (من الباطن) *</Label>
                            <InlineSearchList 
                                value={formData.subcontractorId} 
                                onSelect={(v) => setFormData(p => ({...p, subcontractorId: v}))}
                                options={subOptions}
                                placeholder={subsLoading ? "جاري التحميل..." : "اختر المقاول..."}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>المشروع / مركز التكلفة *</Label>
                            <InlineSearchList 
                                value={formData.projectId} 
                                onSelect={(v) => setFormData(p => ({...p, projectId: v}))}
                                options={projectOptions}
                                placeholder={projectsLoading ? "جاري التحميل..." : "اختر المشروع..."}
                            />
                        </div>
                    </div>

                    <div className="p-4 bg-muted/30 rounded-2xl border-2 border-dashed space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            <div className="grid gap-2 md:col-span-1">
                                <Label className="text-lg font-bold">المبلغ المستحق (د.ك) *</Label>
                                <Input 
                                    type="number" step="0.001" 
                                    value={formData.amount} 
                                    onChange={e => setFormData(p => ({...p, amount: e.target.value}))}
                                    className="h-12 text-2xl font-black font-mono text-primary dir-ltr text-center"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <Label className="text-xs text-muted-foreground mb-1 block">المبلغ كتابةً:</Label>
                                <div className="p-3 bg-background rounded-lg border text-sm font-bold text-muted-foreground min-h-[48px]">
                                    {amountInWords}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label>بيان الأعمال المنجزة</Label>
                        <Textarea 
                            value={formData.description} 
                            onChange={e => setFormData(p => ({...p, description: e.target.value}))}
                            placeholder="مثال: توريد ومصنعية تمديد كابلات الدور الأول، صب أعمدة السرداب..."
                            rows={3}
                        />
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2 border-t pt-6">
                    <Button type="button" variant="ghost" onClick={() => router.back()}>إلغاء</Button>
                    <Button type="submit" disabled={isSaving}>
                        {isSaving ? <Loader2 className="animate-spin ml-2 h-4 w-4"/> : <Save className="ml-2 h-4 w-4"/>}
                        حفظ وإثبات المديونية
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
