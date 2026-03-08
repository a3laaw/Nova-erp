'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '../ui/button';
import { MoreHorizontal, PlusCircle, Pencil, Trash2, Loader2, Save, Calculator, CreditCard, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { useBranding } from '@/context/branding-context';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import type { Account, PaymentMethod } from '@/lib/types';
import { useSubscription } from '@/hooks/use-subscription';
import { InlineSearchList } from '../ui/inline-search-list';
import { formatCurrency, cn } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';

function PaymentMethodForm({
    isOpen,
    onClose,
    onSave,
    method,
    accounts,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: PaymentMethod) => void;
    method: PaymentMethod | null;
    accounts: Account[];
}) {
    const { toast } = useToast();
    const isEditing = !!method;
    const [name, setName] = useState('');
    const [commissionType, setCommissionType] = useState<PaymentMethod['commissionType']>('percentage');
    const [fixedFee, setFixedFee] = useState<number | string>('0');
    const [percentageFee, setPercentageFee] = useState<number | string>('0');
    const [expenseAccountId, setExpenseAccountId] = useState('');

    useEffect(() => {
        if (method) {
            setName(method.name);
            setCommissionType(method.commissionType || 'percentage');
            setFixedFee(method.fixedFee || 0);
            setPercentageFee(method.percentageFee || 0);
            setExpenseAccountId(method.expenseAccountId);
        } else {
            setName('');
            setCommissionType('percentage');
            setFixedFee('0');
            setPercentageFee('0');
            setExpenseAccountId('');
        }
    }, [method, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!name.trim()) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'اسم الطريقة مطلوب.' });
            return;
        }
        
        if (!expenseAccountId) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'يجب اختيار حساب للمصروف (العمولات البنكية).' });
            return;
        }

        const expenseAccount = accounts.find(a => a.id === expenseAccountId);
        if (!expenseAccount) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'الحساب المختار غير موجود.' });
            return;
        }
        
        const finalFixedFee = (commissionType === 'fixed' || commissionType === 'both') ? (parseFloat(String(fixedFee)) || 0) : 0;
        const finalPercentageFee = (commissionType === 'percentage' || commissionType === 'both') ? (parseFloat(String(percentageFee)) || 0) : 0;

        onSave({
            id: method?.id || new Date().toISOString(),
            name,
            commissionType,
            fixedFee: finalFixedFee,
            percentageFee: finalPercentageFee,
            expenseAccountId,
            expenseAccountName: expenseAccount.name,
        });
    };
    
    const accountOptions = useMemo(() => accounts
        .filter(a => a.type === 'expense')
        .map(a => ({ value: a.id!, label: `${a.name} (${a.code})` }))
    , [accounts]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent dir="rtl" className="max-w-md rounded-[2.5rem] p-8 border-none shadow-2xl">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3 text-2xl font-black">
                            <Calculator className="h-8 w-8 text-primary"/>
                            {isEditing ? 'تعديل طريقة الدفع' : 'إضافة طريقة دفع'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-6 py-8">
                        <div className="grid gap-2">
                            <Label htmlFor="name" className="font-black text-gray-700 pr-1">اسم الطريقة (K-Net, Visa...) *</Label>
                            <Input id="name" value={name} onChange={e => setName(e.target.value)} required placeholder="K-Net" className="h-12 rounded-2xl border-2 shadow-inner font-bold text-lg" />
                        </div>

                        <div className="grid gap-2">
                            <Label className="font-black text-gray-700 pr-1">نوع العمولة المستقطعة *</Label>
                            <Select value={commissionType} onValueChange={(v: any) => setCommissionType(v)}>
                                <SelectTrigger className="h-12 rounded-2xl border-2">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="percentage">نسبة مئوية (%)</SelectItem>
                                    <SelectItem value="fixed">مبلغ ثابت (د.ك)</SelectItem>
                                    <SelectItem value="both">كلاهما (مبلغ + نسبة)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {(commissionType === 'fixed' || commissionType === 'both') && (
                                <div className="grid gap-2 animate-in fade-in">
                                    <Label htmlFor="fixedFee" className="font-black text-[10px] text-primary uppercase">المبلغ الثابت (د.ك)</Label>
                                    <Input id="fixedFee" type="number" step="any" value={fixedFee} onChange={e => setFixedFee(e.target.value)} placeholder="0.000" className="h-11 font-mono font-black text-center text-lg rounded-xl border-primary/20 bg-primary/5" />
                                </div>
                            )}

                            {(commissionType === 'percentage' || commissionType === 'both') && (
                                <div className="grid gap-2 animate-in fade-in">
                                    <Label htmlFor="percentageFee" className="font-black text-[10px] text-primary uppercase">النسبة (%)</Label>
                                    <Input id="percentageFee" type="number" step="any" value={percentageFee} onChange={e => setPercentageFee(e.target.value)} placeholder="0%" className="h-11 font-mono font-black text-center text-lg rounded-xl border-primary/20 bg-primary/5" />
                                </div>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="expenseAccountId" className="font-black text-gray-700 pr-1">حساب مصروف العمولات *</Label>
                             <InlineSearchList 
                                value={expenseAccountId} 
                                onSelect={setExpenseAccountId} 
                                options={accountOptions}
                                placeholder="ابحث عن حساب المصروف..."
                                className="h-12 rounded-2xl"
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-3 border-t pt-6">
                        <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl font-bold h-12 px-8">إلغاء</Button>
                        <Button type="submit" className="rounded-xl font-black gap-2 h-12 px-10 shadow-xl shadow-primary/20">
                            <Save className="h-5 w-5" />
                            حفظ الطريقة
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export function PaymentMethodsManager() {
    const { branding, loading: brandingLoading } = useBranding();
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const router = useRouter();

    const [methods, setMethods] = useState<PaymentMethod[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);

    const [methodToDelete, setMethodToDelete] = useState<PaymentMethod | null>(null);

    const { data: accounts, loading: accountsLoading } = useSubscription<Account>(firestore, 'chartOfAccounts');
    
    useEffect(() => {
        if (branding?.payment_methods) {
            setMethods(branding.payment_methods);
        }
    }, [branding]);

    const handleSave = async (methodData: PaymentMethod) => {
        const newMethods = [...methods];
        const index = newMethods.findIndex(m => m.id === methodData.id);
        if (index > -1) {
            newMethods[index] = methodData;
        } else {
            newMethods.push(methodData);
        }
        await updateFirestore(newMethods);
        setIsFormOpen(false);
    };

    const handleDeleteConfirm = async () => {
        if (!methodToDelete) return;
        const newMethods = methods.filter(m => m.id !== methodToDelete.id);
        await updateFirestore(newMethods);
        setMethodToDelete(null);
    };

    const updateFirestore = async (updatedMethods: PaymentMethod[]) => {
        if (!firestore) return;
        setIsSaving(true);
        try {
            await setDoc(doc(firestore, 'company_settings', 'main'), { payment_methods: updatedMethods }, { merge: true });
            toast({ title: 'نجاح التحديث', description: 'تم حفظ وتفعيل معايير العمولات البنكية الجديدة.' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ في الحفظ' });
        } finally {
            setIsSaving(false);
        }
    };
    
    const loading = brandingLoading || accountsLoading;

    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-sm bg-gradient-to-l from-white to-teal-50 dark:from-card dark:to-card">
                <CardHeader className="pb-8 px-8 border-b">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-teal-600/10 rounded-2xl text-teal-600 shadow-inner">
                                <CreditCard className="h-8 w-8" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl font-black text-teal-900">إدارة طرق الدفع والعمولات</CardTitle>
                                <CardDescription className="text-base font-medium">أتمتة حساب عمولات البنك وبوابات الدفع (K-Net, Visa) عند التحصيل.</CardDescription>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={() => router.back()} variant="ghost" className="rounded-xl font-bold gap-2 text-teal-700 hover:bg-teal-50">
                                <ArrowRight className="h-4 w-4" /> العودة
                            </Button>
                            <Button onClick={() => { setEditingMethod(null); setIsFormOpen(true); }} className="h-11 px-8 rounded-2xl font-black text-lg gap-2 shadow-xl shadow-teal-100 bg-teal-600 hover:bg-teal-700">
                                <PlusCircle className="h-5 w-5" /> إضافة طريقة جديدة
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card className="rounded-[3rem] border-none shadow-xl overflow-hidden bg-white">
                <CardContent className="pt-10">
                    <div className="border-2 rounded-[2rem] overflow-hidden shadow-inner bg-card">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow className="h-14">
                                    <TableHead className="px-10 font-black text-gray-800">طريقة الدفع</TableHead>
                                    <TableHead className="text-center font-black text-gray-800">العمولة المستقطعة (آلياً)</TableHead>
                                    <TableHead className="font-black text-gray-800">حساب المصروف المرتبط</TableHead>
                                    <TableHead className="w-[100px] text-center"><span className="sr-only">الإجراءات</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    Array.from({length: 3}).map((_, i) => (
                                        <TableRow key={i}><TableCell colSpan={4} className="p-8"><Skeleton className="h-12 w-full rounded-xl"/></TableCell></TableRow>
                                    ))
                                ) : methods.length === 0 ? (
                                    <TableRow><TableCell colSpan={4} className="h-64 text-center text-muted-foreground italic font-bold">لم يتم تعريف طرق دفع مخصصة بعد.</TableCell></TableRow>
                                ) : (
                                    methods.map(method => (
                                        <TableRow key={method.id} className="hover:bg-teal-50/30 transition-colors h-20 border-b last:border-0 group">
                                            <TableCell className="px-10 font-black text-teal-700 text-xl">{method.name}</TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex flex-col items-center justify-center gap-2">
                                                    {method.percentageFee > 0 && (
                                                        <Badge className="bg-blue-600 text-white font-mono font-black px-4 py-1 rounded-xl">
                                                            {method.percentageFee}% نسبة
                                                        </Badge>
                                                    )}
                                                    {method.fixedFee > 0 && (
                                                        <Badge className="bg-purple-600 text-white font-mono font-black px-4 py-1 rounded-xl">
                                                            {formatCurrency(method.fixedFee)} ثابت
                                                        </Badge>
                                                    )}
                                                    {method.fixedFee === 0 && method.percentageFee === 0 && <Badge variant="secondary" className="opacity-40 font-bold">بدون عمولة</Badge>}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-black text-sm text-gray-700">{method.expenseAccountName}</span>
                                                    <span className="text-[10px] text-muted-foreground font-mono">ID: {method.expenseAccountId.substring(0, 8)}...</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl border bg-white shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"><MoreHorizontal className="h-5 w-5"/></Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" dir="rtl" className="rounded-2xl shadow-2xl border-none p-2">
                                                        <DropdownMenuLabel className="font-black px-3 py-2">خيارات الطريقة</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => { setEditingMethod(method); setIsFormOpen(true); }} className="gap-2 rounded-xl py-3 font-bold">
                                                            <Pencil className="h-4 w-4 text-primary"/> تعديل الإعدادات
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => setMethodToDelete(method)} className="text-destructive gap-2 rounded-xl py-3 font-bold focus:bg-red-50">
                                                            <Trash2 className="h-4 w-4"/> حذف الطريقة نهائياً
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
            
            {isFormOpen && (
                <PaymentMethodForm 
                    isOpen={isFormOpen}
                    onClose={() => setIsFormOpen(false)}
                    onSave={handleSave}
                    method={editingMethod}
                    accounts={accounts}
                />
            )}
            
             <AlertDialog open={!!methodToDelete} onOpenChange={() => setMethodToDelete(null)}>
                <AlertDialogContent dir="rtl" className="rounded-[2.5rem] shadow-2xl border-none">
                    <AlertDialogHeader>
                        <div className="p-3 bg-red-100 rounded-2xl text-red-600 w-fit mb-4 shadow-inner"><AlertTriangle className="h-8 w-8"/></div>
                        <AlertDialogTitle className="text-2xl font-black text-red-700">تأكيد حذف طريقة الدفع؟</AlertDialogTitle>
                        <AlertDialogDescription className="text-base font-medium leading-relaxed">
                            أنت على وشك إزالة الطريقة <strong>"{methodToDelete?.name}"</strong> من خيارات التحصيل. لن يؤثر هذا على السجلات القديمة ولكنه سيمنع استخدامها مستقبلاً.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-6 gap-3">
                        <AlertDialogCancel className="rounded-xl font-bold h-12 px-8">إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90 rounded-xl font-black h-12 px-10 shadow-lg">نعم، قم بالحذف</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
