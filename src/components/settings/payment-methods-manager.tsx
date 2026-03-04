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
import { MoreHorizontal, PlusCircle, Pencil, Trash2, Loader2, Save, Calculator } from 'lucide-react';
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
} from "../ui/alert-dialog";
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { useBranding } from '@/context/branding-context';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import { useFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import type { Account, PaymentMethod } from '@/lib/types';
import { useSubscription } from '@/hooks/use-subscription';
import { InlineSearchList } from '../ui/inline-search-list';
import { formatCurrency, cn } from '@/lib/utils';
import { Badge } from '../ui/badge';

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
    const isEditing = !!method;
    const [name, setName] = useState('');
    const [fixedFee, setFixedFee] = useState<number | string>('0');
    const [percentageFee, setPercentageFee] = useState<number | string>('0');
    const [expenseAccountId, setExpenseAccountId] = useState('');

    useEffect(() => {
        if (method) {
            setName(method.name);
            setFixedFee(method.fixedFee || 0);
            setPercentageFee(method.percentageFee || 0);
            setExpenseAccountId(method.expenseAccountId);
        } else {
            setName('');
            setFixedFee('0');
            setPercentageFee('0');
            setExpenseAccountId('');
        }
    }, [method, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const expenseAccount = accounts.find(a => a.id === expenseAccountId);
        if (!name || !expenseAccountId || !expenseAccount) {
            return;
        }
        onSave({
            id: method?.id || new Date().toISOString(),
            name,
            fixedFee: Number(fixedFee) || 0,
            percentageFee: Number(percentageFee) || 0,
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
            <DialogContent dir="rtl" className="max-w-md rounded-3xl">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-black">
                            <Calculator className="h-6 w-6 text-primary"/>
                            {isEditing ? 'تعديل طريقة الدفع' : 'إضافة طريقة دفع جديدة'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-6 py-6">
                        <div className="grid gap-2">
                            <Label htmlFor="name" className="font-bold">اسم الطريقة (مثال: K-Net, Visa) *</Label>
                            <Input id="name" value={name} onChange={e => setName(e.target.value)} required placeholder="K-Net" className="h-11 rounded-xl" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="fixedFee" className="font-bold">عمولة ثابتة (د.ك)</Label>
                                <Input id="fixedFee" type="number" step="any" value={fixedFee} onChange={e => setFixedFee(e.target.value)} placeholder="0.000" className="h-11 font-mono text-lg rounded-xl" />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="percentageFee" className="font-bold">عمولة نسبة (%)</Label>
                                <Input id="percentageFee" type="number" step="any" value={percentageFee} onChange={e => setPercentageFee(e.target.value)} placeholder="0%" className="h-11 font-mono text-lg rounded-xl" />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="expenseAccountId" className="font-bold">حساب مصروف العمولات *</Label>
                             <InlineSearchList 
                                value={expenseAccountId} 
                                onSelect={setExpenseAccountId} 
                                options={accountOptions}
                                placeholder="اختر حساب المصروف (مثال: 5211)..."
                                className="h-11"
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">إلغاء</Button>
                        <Button type="submit" className="rounded-xl font-black gap-2 h-11 px-8">
                            <Save className="h-4 w-4" />
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
            toast({ title: 'نجاح', description: 'تم تحديث طرق الدفع والعمولات.' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ التغييرات.' });
        } finally {
            setIsSaving(false);
        }
    };
    
    const loading = brandingLoading || accountsLoading;

    return (
        <Card className="rounded-3xl border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/10 border-b pb-6">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-xl font-black">إدارة طرق الدفع والعمولات البنكية</CardTitle>
                        <CardDescription>حدد طرق التحصيل والعمولات (ثابتة أو نسبية) التي يخصمها البنك تلقائياً من الإيداعات.</CardDescription>
                    </div>
                    <Button onClick={() => { setEditingMethod(null); setIsFormOpen(true); }} className="h-10 rounded-xl font-bold gap-2">
                        <PlusCircle className="h-4 w-4" /> إضافة طريقة دفع
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                 <div className="border rounded-2xl overflow-hidden shadow-inner">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="px-6 font-bold">اسم الطريقة</TableHead>
                                <TableHead className="text-center font-bold">عمولة ثابتة</TableHead>
                                <TableHead className="text-center font-bold">عمولة مئوية</TableHead>
                                <TableHead className="font-bold">حساب المصروف</TableHead>
                                <TableHead className="w-[80px]"><span className="sr-only">الإجراءات</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? <TableRow><TableCell colSpan={5} className="p-8"><Skeleton className="h-10 w-full"/></TableCell></TableRow>
                            : methods.length === 0 ? <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">لم يتم إضافة طرق دفع بعد.</TableCell></TableRow>
                            : methods.map(method => (
                                <TableRow key={method.id} className="hover:bg-muted/30 transition-colors h-16">
                                    <TableCell className="px-6 font-black text-primary text-lg">{method.name}</TableCell>
                                    <TableCell className="text-center">
                                        {method.fixedFee > 0 ? (
                                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 font-mono font-black text-sm">
                                                {formatCurrency(method.fixedFee)}
                                            </Badge>
                                        ) : <span className="text-muted-foreground opacity-30">-</span>}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {method.percentageFee > 0 ? (
                                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-mono font-black text-sm">
                                                {method.percentageFee}%
                                            </Badge>
                                        ) : <span className="text-muted-foreground opacity-30">-</span>}
                                    </TableCell>
                                    <TableCell className="text-xs font-bold text-muted-foreground">{method.expenseAccountName}</TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full"><MoreHorizontal className="h-4 w-4"/></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" dir="rtl" className="rounded-xl">
                                                <DropdownMenuLabel>إجراءات</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => { setEditingMethod(method); setIsFormOpen(true); }} className="gap-2">
                                                    <Pencil className="h-4 w-4"/> تعديل
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => setMethodToDelete(method)} className="text-destructive gap-2">
                                                    <Trash2 className="ml-2 h-4 w-4"/> حذف
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
            
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
                <AlertDialogContent dir="rtl" className="rounded-3xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-black">تأكيد حذف طريقة الدفع؟</AlertDialogTitle>
                        <AlertDialogDescription>سيتم حذف الطريقة "{methodToDelete?.name}" من الخيارات المتاحة عند التحصيل.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90 rounded-xl font-bold">نعم، حذف</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}
