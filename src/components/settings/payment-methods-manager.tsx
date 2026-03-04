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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useBranding } from '@/context/branding-context';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import { useFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import type { Account, PaymentMethod } from '@/lib/types';
import { useSubscription } from '@/hooks/use-subscription';
import { InlineSearchList } from '../ui/inline-search-list';
import { formatCurrency, cn } from '@/lib/utils';

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
        if (!name || value === '' || !expenseAccountId || !expenseAccount) {
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
            <DialogContent dir="rtl" className="max-w-md">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Calculator className="h-5 w-5 text-primary"/>
                            {isEditing ? 'تعديل طريقة الدفع' : 'إضافة طريقة دفع جديدة'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-6 py-6">
                        <div className="grid gap-2">
                            <Label htmlFor="name" className="font-bold">اسم طريقة الدفع (مثال: K-Net, Visa)</Label>
                            <Input id="name" value={name} onChange={e => setName(e.target.value)} required placeholder="K-Net" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="type" className="font-bold">نوع العمولة البنكية</Label>
                                <Select value={type} onValueChange={(v) => setType(v as any)}>
                                    <SelectTrigger className="rounded-xl h-11"><SelectValue/></SelectTrigger>
                                    <SelectContent dir="rtl">
                                        <SelectItem value="percentage">نسبة مئوية (%)</SelectItem>
                                        <SelectItem value="fixed">مبلغ ثابت (Fixed)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="value" className="font-bold">القيمة</Label>
                                <Input id="value" type="number" step="any" value={value} onChange={e => setValue(e.target.value)} required placeholder="0.000" className="h-11 font-mono text-lg" />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="expenseAccountId" className="font-bold">حساب مصروف العمولة</Label>
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
                        <Button type="submit" className="rounded-xl font-bold gap-2">
                            <Save className="h-4 w-4" />
                            حفظ البيانات
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
                        <CardDescription>حدد طرق التحصيل والعمولات التي يخصمها البنك تلقائياً من الإيداعات.</CardDescription>
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
                                <TableHead className="font-bold">نوع العمولة</TableHead>
                                <TableHead className="text-center font-bold">قيمة العمولة</TableHead>
                                <TableHead className="font-bold">حساب مصروف العمولات</TableHead>
                                <TableHead className="w-[80px]"><span className="sr-only">الإجراءات</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? <TableRow><TableCell colSpan={5} className="p-8"><Skeleton className="h-10 w-full"/></TableCell></TableRow>
                            : methods.length === 0 ? <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">لم يتم إضافة طرق دفع بعد.</TableCell></TableRow>
                            : methods.map(method => (
                                <TableRow key={method.id} className="hover:bg-muted/30 transition-colors">
                                    <TableCell className="px-6 font-black text-primary">{method.name}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn("font-bold px-3", method.type === 'percentage' ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700")}>
                                            {method.type === 'percentage' ? 'نسبة مئوية' : 'مبلغ ثابت'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center font-mono font-black text-lg">
                                        {method.type === 'percentage' ? `${method.value}%` : formatCurrency(method.value)}
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
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90 rounded-xl font-bold">نعم، حذف</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}
