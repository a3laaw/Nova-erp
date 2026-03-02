
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirebase, useSubscription } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { collection, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, orderBy, Timestamp, writeBatch, getDoc } from 'firebase/firestore';
import type { RecurringObligation, Account } from '@/lib/types';
import { formatCurrency, cleanFirestoreData, cn } from '@/lib/utils';
import { Loader2, PlusCircle, History, RotateCcw, CalendarClock, Trash2, Save, AlertCircle, Banknote } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useToast } from '@/hooks/use-toast';
import { format, addWeeks, addMonths, isPast } from 'date-fns';
import { toFirestoreDate } from '@/services/date-converter';

export default function RecurringObligationsPage() {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [editingItem, setEditingItem] = useState<RecurringObligation | null>(null);

    const { data: obligations, loading: obsLoading } = useSubscription<RecurringObligation>(firestore, 'recurring_obligations', [orderBy('dueDate', 'asc')]);
    const { data: accounts } = useSubscription<Account>(firestore, 'chartOfAccounts', [orderBy('code')]);

    const [formData, setFormData] = useState<Partial<RecurringObligation>>({
        title: '',
        type: 'rent',
        amount: 0,
        frequency: 'monthly',
        dueDate: new Date(),
        debitAccountId: '',
        creditAccountId: '',
        status: 'active'
    });

    const accountOptions = useMemo(() => accounts.map(a => ({ value: a.id!, label: `${a.name} (${a.code})` })), [accounts]);

    const handleSave = async () => {
        if (!firestore || !currentUser) return;
        setIsProcessing(true);
        try {
            const debAcc = accounts.find(a => a.id === formData.debitAccountId);
            const creAcc = accounts.find(a => a.id === formData.creditAccountId);
            
            const payload = {
                ...formData,
                debitAccountName: debAcc?.name,
                creditAccountName: creAcc?.name,
                updatedAt: serverTimestamp(),
                createdBy: currentUser.id
            };

            if (editingItem) {
                await updateDoc(doc(firestore, 'recurring_obligations', editingItem.id!), cleanFirestoreData(payload));
                toast({ title: 'تم التحديث' });
            } else {
                await addDoc(collection(firestore, 'recurring_obligations'), cleanFirestoreData({ ...payload, createdAt: serverTimestamp() }));
                toast({ title: 'تمت الإضافة' });
            }
            setIsDialogOpen(false);
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ في الحفظ' });
        } finally {
            setIsProcessing(false);
        }
    };

    // ✨ محرك توليد القيود الدورية
    const handleGenerateEntries = async () => {
        if (!firestore || !currentUser) return;
        const pending = obligations.filter(o => o.status === 'active' && isPast(toFirestoreDate(o.dueDate)!));
        if (pending.length === 0) {
            toast({ title: 'لا توجد التزامات مستحقة', description: 'كافة القيود الدورية محدثة حتى اللحظة.' });
            return;
        }

        setIsProcessing(true);
        try {
            const batch = writeBatch(firestore);
            const currentYear = new Date().getFullYear();
            const counterRef = doc(firestore, 'counters', 'journalEntries');
            const counterSnap = await getDoc(counterRef);
            let nextJeNum = (counterSnap.data()?.counts?.[currentYear] || 0) + 1;

            for (const ob of pending) {
                const newJeRef = doc(collection(firestore, 'journalEntries'));
                const jeNum = `JV-AUTO-${currentYear}-${String(nextJeNum).padStart(4, '0')}`;
                
                batch.set(newJeRef, {
                    entryNumber: jeNum,
                    date: ob.dueDate,
                    narration: `[قيد دوري آلي] ${ob.title}`,
                    status: 'posted',
                    totalDebit: ob.amount,
                    totalCredit: ob.amount,
                    lines: [
                        { accountId: ob.debitAccountId, accountName: ob.debitAccountName, debit: ob.amount, credit: 0 },
                        { accountId: ob.creditAccountId, accountName: ob.creditAccountName, debit: 0, credit: ob.amount }
                    ],
                    createdAt: serverTimestamp(),
                    createdBy: 'system-auto-chain'
                });

                // تحديث موعد الاستحقاق القادم
                const nextDate = ob.frequency === 'weekly' ? addWeeks(toFirestoreDate(ob.dueDate)!, 1) : addMonths(toFirestoreDate(ob.dueDate)!, 1);
                batch.update(doc(firestore, 'recurring_obligations', ob.id!), {
                    dueDate: Timestamp.fromDate(nextDate),
                    lastGeneratedDate: ob.dueDate
                });

                nextJeNum++;
            }

            batch.update(counterRef, { [`counts.${currentYear}`]: nextJeNum - 1 }, { merge: true });
            await batch.commit();
            toast({ title: 'تم توليد القيود', description: `تم إنشاء ${pending.length} قيد محاسبي آلي بنجاح.` });
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ في الأتمتة' });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-sm bg-gradient-to-l from-white to-sky-50 dark:from-card dark:to-card">
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="space-y-1">
                            <CardTitle className="text-2xl font-black flex items-center gap-3">
                                <CalendarClock className="text-primary h-7 w-7" />
                                أتمتة الالتزامات الدورية (أقساط، إيجارات، عمالة)
                            </CardTitle>
                            <CardDescription>برمجة القيود المحاسبية المتكررة لضمان دقة المصاريف الشهرية والأسبوعية.</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handleGenerateEntries} disabled={isProcessing} variant="outline" className="h-11 px-6 rounded-xl font-bold gap-2 border-primary text-primary hover:bg-primary/5">
                                {isProcessing ? <Loader2 className="animate-spin h-4 w-4"/> : <RotateCcw className="h-4 w-4" />}
                                تشغيل محرك الأتمتة الآن
                            </Button>
                            <Button onClick={() => { setEditingItem(null); setIsDialogOpen(true); }} className="h-11 px-6 rounded-xl font-black gap-2 shadow-lg shadow-primary/20">
                                <PlusCircle className="h-5 w-5" /> إضافة التزام دوري
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card className="rounded-[2rem] border-none shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="px-6 font-bold">الالتزام</TableHead>
                            <TableHead>النوع</TableHead>
                            <TableHead>التكرار</TableHead>
                            <TableHead>الاستحقاق القادم</TableHead>
                            <TableHead className="text-left">المبلغ</TableHead>
                            <TableHead>الحالة</TableHead>
                            <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {obsLoading ? (
                            <TableRow><TableCell colSpan={7} className="text-center p-8"><Loader2 className="animate-spin mx-auto text-primary" /></TableCell></TableRow>
                        ) : obligations.length === 0 ? (
                            <TableRow><TableCell colSpan={7} className="h-48 text-center text-muted-foreground italic">لا توجد التزامات مبرمجة حالياً.</TableCell></TableRow>
                        ) : (
                            obligations.map(ob => (
                                <TableRow key={ob.id} className="hover:bg-muted/30">
                                    <TableCell className="px-6 font-bold">{ob.title}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="bg-white">{ob.type === 'rent' ? 'إيجار' : ob.type === 'installment' ? 'قسط' : ob.type === 'daily_labor' ? 'عمالة يومية' : 'مديونية مورد'}</Badge>
                                    </TableCell>
                                    <TableCell className="text-xs font-bold text-muted-foreground">{ob.frequency === 'weekly' ? 'أسبوعي' : 'شهري'}</TableCell>
                                    <TableCell className={cn("font-mono font-bold", isPast(toFirestoreDate(ob.dueDate)!) ? "text-red-600" : "text-primary")}>
                                        {toFirestoreDate(ob.dueDate) ? format(toFirestoreDate(ob.dueDate)!, 'dd/MM/yyyy') : '-'}
                                    </TableCell>
                                    <TableCell className="text-left font-mono font-black text-lg">{formatCurrency(ob.amount)}</TableCell>
                                    <TableCell>
                                        <Badge variant={ob.status === 'active' ? 'default' : 'secondary'}>{ob.status === 'active' ? 'نشط' : 'متوقف'}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="icon" onClick={() => { setEditingItem(ob); setFormData(ob); setIsDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent dir="rtl" className="max-w-2xl rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black">{editingItem ? 'تعديل التزام' : 'إضافة التزام دوري جديد'}</DialogTitle>
                        <DialogDescription>برمج القيود الآلية وحدد حسابات القيد المزدوج.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-6 py-4">
                        <div className="col-span-2 grid gap-2">
                            <Label>عنوان الالتزام (مثال: إيجار مقر الشركة الرئيسي) *</Label>
                            <Input value={formData.title} onChange={e => setFormData(p => ({...p, title: e.target.value}))} placeholder="اكتب وصفاً مختصراً..." />
                        </div>
                        <div className="grid gap-2">
                            <Label>نوع الالتزام</Label>
                            <Select value={formData.type} onValueChange={v => setFormData(p => ({...p, type: v as any}))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="rent">إيجار</SelectItem>
                                    <SelectItem value="installment">أقساط بنكية/تمويل</SelectItem>
                                    <SelectItem value="vendor_debt">مديونية مورد (مجدولة)</SelectItem>
                                    <SelectItem value="daily_labor">أجور عمال يومية (تجميع أسبوعي)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>دورية التكرار</Label>
                            <Select value={formData.frequency} onValueChange={v => setFormData(p => ({...p, frequency: v as any}))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="weekly">أسبوعي</SelectItem>
                                    <SelectItem value="monthly">شهري</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>المبلغ (د.ك) *</Label>
                            <Input type="number" step="0.001" value={formData.amount} onChange={e => setFormData(p => ({...p, amount: parseFloat(e.target.value)}))} dir="ltr" />
                        </div>
                        <div className="grid gap-2">
                            <Label>تاريخ أول استحقاق *</Label>
                            <DateInput value={formData.dueDate} onChange={d => setFormData(p => ({...p, dueDate: d}))} />
                        </div>
                        <Separator className="col-span-2" />
                        <div className="grid gap-2">
                            <Label className="text-red-700 font-bold">الحساب المدين (المصروف) *</Label>
                            <InlineSearchList value={formData.debitAccountId || ''} onSelect={v => setFormData(p => ({...p, debitAccountId: v}))} options={accountOptions} placeholder="اختر حساب المصروف..." />
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-green-700 font-bold">الحساب الدائن (البنك/الصندوق) *</Label>
                            <InlineSearchList value={formData.creditAccountId || ''} onSelect={v => setFormData(p => ({...p, creditAccountId: v}))} options={accountOptions} placeholder="اختر حساب الخصم..." />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={closeDialog}>إلغاء</Button>
                        <Button onClick={handleSave} disabled={isProcessing || !formData.title}>
                            {isProcessing ? <Loader2 className="animate-spin ml-2 h-4 w-4"/> : <Save className="ml-2 h-4 w-4"/>}
                            تأكيد وبرمجة الالتزام
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
