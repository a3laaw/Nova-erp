'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
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
import { MoreHorizontal, PlusCircle, Pencil, Trash2, Loader2, Save } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { useBranding } from '@/context/branding-context';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import { useFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import type { Account, PaymentMethod } from '@/lib/types';
import { useSubscription } from '@/hooks/use-subscription';
import { InlineSearchList } from '../ui/inline-search-list';

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
    const [type, setType] = useState<'fixed' | 'percentage'>('percentage');
    const [value, setValue] = useState<number | string>('');
    const [expenseAccountId, setExpenseAccountId] = useState('');

    useEffect(() => {
        if (method) {
            setName(method.name);
            setType(method.type);
            setValue(method.value);
            setExpenseAccountId(method.expenseAccountId);
        } else {
            setName('');
            setType('percentage');
            setValue('');
            setExpenseAccountId('');
        }
    }, [method, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const expenseAccount = accounts.find(a => a.id === expenseAccountId);
        if (!name || !value || !expenseAccountId || !expenseAccount) {
            alert('Please fill all fields');
            return;
        }
        onSave({
            id: method?.id || new Date().toISOString(),
            name,
            type,
            value: Number(value),
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
            <DialogContent dir="rtl">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{isEditing ? 'تعديل طريقة الدفع' : 'إضافة طريقة دفع'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">اسم طريقة الدفع</Label>
                            <Input id="name" value={name} onChange={e => setName(e.target.value)} required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="type">نوع العمولة</Label>
                                <Select value={type} onValueChange={(v) => setType(v as any)}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="percentage">نسبة مئوية</SelectItem>
                                        <SelectItem value="fixed">مبلغ ثابت</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="value">القيمة</Label>
                                <Input id="value" type="number" step="any" value={value} onChange={e => setValue(e.target.value)} required />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="expenseAccountId">حساب مصروف العمولة</Label>
                             <InlineSearchList 
                                value={expenseAccountId} 
                                onSelect={setExpenseAccountId} 
                                options={accountOptions}
                                placeholder="اختر حساب المصروف..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
                        <Button type="submit">حفظ</Button>
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
            toast({ title: 'نجاح', description: 'تم تحديث طرق الدفع.' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ التغييرات.' });
        } finally {
            setIsSaving(false);
        }
    };
    
    const loading = brandingLoading || accountsLoading;

    return (
        <Card>
            <CardHeader>
                <CardTitle>إدارة طرق الدفع والعمولات</CardTitle>
                <CardDescription>أضف أو عدّل طرق الدفع المستخدمة في النظام والعمولات البنكية المرتبطة بها.</CardDescription>
            </CardHeader>
            <CardContent>
                 <div className="flex justify-end mb-4">
                    <Button onClick={() => { setEditingMethod(null); setIsFormOpen(true); }} size="sm"><PlusCircle className="ml-2 h-4 w-4" /> إضافة طريقة دفع</Button>
                </div>
                 <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>اسم الطريقة</TableHead>
                                <TableHead>نوع العمولة</TableHead>
                                <TableHead>القيمة</TableHead>
                                <TableHead>حساب المصروف</TableHead>
                                <TableHead><span className="sr-only">الإجراءات</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? <TableRow><TableCell colSpan={5}><Skeleton className="h-8 w-full"/></TableCell></TableRow>
                            : methods.length === 0 ? <TableRow><TableCell colSpan={5} className="h-24 text-center">لم يتم إضافة طرق دفع بعد.</TableCell></TableRow>
                            : methods.map(method => (
                                <TableRow key={method.id}>
                                    <TableCell className="font-medium">{method.name}</TableCell>
                                    <TableCell>{method.type === 'percentage' ? 'نسبة مئوية' : 'مبلغ ثابت'}</TableCell>
                                    <TableCell>{method.type === 'percentage' ? `${method.value}%` : formatCurrency(method.value)}</TableCell>
                                    <TableCell>{method.expenseAccountName}</TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger>
                                            <DropdownMenuContent dir="rtl">
                                                <DropdownMenuItem onClick={() => { setEditingMethod(method); setIsFormOpen(true); }}><Pencil className="ml-2 h-4 w-4"/> تعديل</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => setMethodToDelete(method)} className="text-destructive"><Trash2 className="ml-2 h-4 w-4"/> حذف</DropdownMenuItem>
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
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                        <AlertDialogDescription>سيتم حذف طريقة الدفع "{methodToDelete?.name}" بشكل دائم.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">نعم، حذف</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}

    