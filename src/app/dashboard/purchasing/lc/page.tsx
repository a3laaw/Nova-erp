
'use client';

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Landmark, PlusCircle, History, BadgeInfo, Building2, Wallet, Loader2, Save } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import type { LetterOfCredit, Vendor } from '@/lib/types';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DateInput } from '@/components/ui/date-input';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useToast } from '@/hooks/use-toast';

export default function LcManagementPage() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const { data: lcs, loading } = useSubscription<LetterOfCredit>(firestore, 'letter_of_credits', [orderBy('createdAt', 'desc')]);
    const { data: vendors } = useSubscription<Vendor>(firestore, 'vendors', [orderBy('name')]);

    const [formData, setFormData] = useState({
        lcNumber: '',
        issuingBank: '',
        vendorId: '',
        amount: '',
        currency: 'KWD',
        expiryDate: undefined as Date | undefined,
        notes: ''
    });

    const vendorOptions = useMemo(() => vendors.map(v => ({ value: v.id!, label: v.name })), [vendors]);

    const handleSave = async () => {
        if (!firestore || !formData.lcNumber || !formData.vendorId || !formData.amount) return;
        setIsSaving(true);
        try {
            const vendor = vendors.find(v => v.id === formData.vendorId);
            await addDoc(collection(firestore, 'letter_of_credits'), cleanFirestoreData({
                ...formData,
                amount: parseFloat(formData.amount),
                vendorName: vendor?.name || 'غير معروف',
                status: 'open',
                createdAt: serverTimestamp()
            }));
            toast({ title: 'نجاح', description: 'تم تسجيل الاعتماد المستندي بنجاح.' });
            setIsDialogOpen(false);
            setFormData({ lcNumber: '', issuingBank: '', vendorId: '', amount: '', currency: 'KWD', expiryDate: undefined, notes: '' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ الاعتماد.' });
        } finally {
            setIsSaving(false);
        }
    };

    const totals = useMemo(() => {
        const totalAmount = lcs.filter(lc => lc.status === 'open').reduce((sum, lc) => sum + lc.amount, 0);
        return { totalAmount, count: lcs.filter(lc => lc.status === 'open').length };
    }, [lcs]);

    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-3xl border-none shadow-sm bg-gradient-to-l from-white to-blue-50">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div className="space-y-1">
                            <CardTitle className="text-2xl font-black flex items-center gap-3 text-blue-900">
                                <Landmark className="text-blue-700 h-7 w-7" />
                                الاعتمادات المستندية (Letters of Credit)
                            </CardTitle>
                            <CardDescription>تتبع خطابات الاعتماد البنكية المفتوحة للمشتريات الخارجية والموردين الدوليين.</CardDescription>
                        </div>
                        <Button onClick={() => setIsDialogOpen(true)} className="h-11 px-6 rounded-xl font-bold gap-2 bg-blue-700 hover:bg-blue-800 shadow-lg shadow-blue-100">
                            <PlusCircle className="h-5 w-5" /> فتح اعتماد جديد
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="rounded-2xl p-6 bg-white shadow-sm border-none">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground mb-2 block">إجمالي الاعتمادات المفتوحة</Label>
                    <p className="text-3xl font-black font-mono text-blue-700">{formatCurrency(totals.totalAmount)}</p>
                </Card>
                <Card className="rounded-2xl p-6 bg-white shadow-sm border-none">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground mb-2 block">عدد العمليات النشطة</Label>
                    <p className="text-3xl font-black font-mono">{totals.count}</p>
                </Card>
                <Card className="rounded-2xl p-6 bg-white shadow-sm border-none">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground mb-2 block">الحسابات البنكية المستعملة</Label>
                    <p className="text-3xl font-black font-mono">{new Set(lcs.map(l => l.issuingBank)).size}</p>
                </Card>
            </div>

            <Card className="rounded-[2rem] border-none shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead>رقم الاعتماد</TableHead>
                            <TableHead>البنك المصدر</TableHead>
                            <TableHead>المورد المستفيد</TableHead>
                            <TableHead>تاريخ الصلاحية</TableHead>
                            <TableHead className="text-left">القيمة</TableHead>
                            <TableHead>الحالة</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={6} className="text-center p-8"><Loader2 className="animate-spin mx-auto text-primary" /></TableCell></TableRow>
                        ) : lcs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-48 text-center text-muted-foreground italic">
                                    <div className="flex flex-col items-center gap-3 opacity-30">
                                        <History className="h-12 w-12" />
                                        <p className="text-lg font-bold">لا توجد اعتمادات مستندية نشطة حالياً.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            lcs.map(lc => (
                                <TableRow key={lc.id}>
                                    <TableCell className="font-mono font-bold text-blue-700">{lc.lcNumber}</TableCell>
                                    <TableCell>{lc.issuingBank}</TableCell>
                                    <TableCell className="font-bold">{lc.vendorName}</TableCell>
                                    <TableCell>{toFirestoreDate(lc.expiryDate) ? format(toFirestoreDate(lc.expiryDate)!, 'dd/MM/yyyy') : '-'}</TableCell>
                                    <TableCell className="text-left font-mono font-black">{formatCurrency(lc.amount)}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={lc.status === 'open' ? 'bg-green-50 text-green-700' : ''}>
                                            {lc.status === 'open' ? 'نشط' : lc.status}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent dir="rtl" className="max-w-lg rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black">فتح اعتماد مستندي جديد</DialogTitle>
                        <DialogDescription>أدخل بيانات الضمان البنكي للمشتريات الخارجية.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>رقم الاعتماد *</Label>
                                <Input value={formData.lcNumber} onChange={e => setFormData(p => ({...p, lcNumber: e.target.value}))} placeholder="L/C Number" dir="ltr" />
                            </div>
                            <div className="grid gap-2">
                                <Label>البنك المصدر *</Label>
                                <Input value={formData.issuingBank} onChange={e => setFormData(p => ({...p, issuingBank: e.target.value}))} placeholder="اسم البنك..." />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label>المورد المستفيد *</Label>
                            <InlineSearchList value={formData.vendorId} onSelect={v => setFormData(p => ({...p, vendorId: v}))} options={vendorOptions} placeholder="اختر مورد..." />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>المبلغ *</Label>
                                <Input type="number" value={formData.amount} onChange={e => setFormData(p => ({...p, amount: e.target.value}))} placeholder="0.000" dir="ltr" />
                            </div>
                            <div className="grid gap-2">
                                <Label>تاريخ الانتهاء *</Label>
                                <DateInput value={formData.expiryDate} onChange={d => setFormData(p => ({...p, expiryDate: d}))} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
                        <Button onClick={handleSave} disabled={isSaving || !formData.lcNumber}>
                            {isSaving ? <Loader2 className="animate-spin ml-2 h-4 w-4"/> : <Save className="ml-2 h-4 w-4"/>}
                            تأكيد وفتح الاعتماد
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
