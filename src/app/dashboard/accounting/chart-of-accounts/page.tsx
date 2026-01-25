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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, ArrowRight, MoreHorizontal, Pencil, Trash2, Loader2, DownloadCloud } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { collection, query, addDoc, doc, updateDoc, deleteDoc, writeBatch, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
} from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';


interface Account {
  id?: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  level: number;
}

const accountTypeTranslations: Record<Account['type'], string> = {
    asset: 'أصل',
    liability: 'خصم',
    equity: 'حقوق ملكية',
    income: 'إيراد',
    expense: 'مصروف',
};

const accountTypeColors: Record<Account['type'], string> = {
    asset: 'bg-blue-100 text-blue-800',
    liability: 'bg-red-100 text-red-800',
    equity: 'bg-purple-100 text-purple-800',
    income: 'bg-green-100 text-green-800',
    expense: 'bg-orange-100 text-orange-800',
};

// Define default chart of accounts
const defaultChartOfAccounts: Omit<Account, 'id'>[] = [
    // الأصول
    { code: '1', name: 'الأصول', type: 'asset', level: 0 },
    { code: '11', name: 'الأصول المتداولة', type: 'asset', level: 1 },
    { code: '1101', name: 'النقدية وما في حكمها', type: 'asset', level: 2 },
    { code: '110101', name: 'الصندوق', type: 'asset', level: 3 },
    { code: '110102', name: 'البنوك', type: 'asset', level: 3 },
    { code: '1102', name: 'الذمم المدينة', type: 'asset', level: 2 },
    { code: '110201', name: 'العملاء', type: 'asset', level: 3 },
    { code: '1103', name: 'المخزون', type: 'asset', level: 2 },
    { code: '12', name: 'الأصول غير المتداولة', type: 'asset', level: 1 },
    { code: '1201', name: 'الأصول الثابتة', type: 'asset', level: 2 },
    { code: '120101', name: 'الأراضي والمباني', type: 'asset', level: 3 },
    { code: '120102', name: 'الأثاث والمعدات', type: 'asset', level: 3 },

    // الخصوم
    { code: '2', name: 'الخصوم (الالتزامات)', type: 'liability', level: 0 },
    { code: '21', name: 'الخصوم المتداولة', type: 'liability', level: 1 },
    { code: '2101', name: 'الذمم الدائنة', type: 'liability', level: 2 },
    { code: '210101', name: 'الموردون', type: 'liability', level: 3 },
    { code: '2102', name: 'المصروفات المستحقة', type: 'liability', level: 2 },
    { code: '2103', name: 'الضرائب المستحقة', type: 'liability', level: 2 },
    { code: '210301', name: 'ضريبة القيمة المضافة المستحقة', type: 'liability', level: 3 },
    { code: '22', name: 'الخصوم غير المتداولة', type: 'liability', level: 1 },
    { code: '2201', name: 'القروض طويلة الأجل', type: 'liability', level: 2 },

    // حقوق الملكية
    { code: '3', name: 'حقوق الملكية', type: 'equity', level: 0 },
    { code: '31', name: 'رأس المال', type: 'equity', level: 1 },
    { code: '3101', name: 'رأس المال المدفوع', type: 'equity', level: 2 },
    { code: '32', name: 'الأرباح المحتجزة', type: 'equity', level: 1 },

    // الإيرادات
    { code: '4', name: 'الإيرادات', type: 'income', level: 0 },
    { code: '41', name: 'إيرادات النشاط الرئيسي', type: 'income', level: 1 },
    { code: '4101', name: 'إيرادات استشارات هندسية', type: 'income', level: 2 },
    { code: '42', name: 'إيرادات أخرى', type: 'income', level: 1 },

    // المصروفات
    { code: '5', name: 'المصروفات', type: 'expense', level: 0 },
    { code: '51', name: 'تكلفة الإيرادات', type: 'expense', level: 1 },
    { code: '52', name: 'المصاريف العمومية والإدارية', type: 'expense', level: 1 },
    { code: '5201', name: 'رواتب وأجور', type: 'expense', level: 2 },
    { code: '5202', name: 'مصاريف إيجار', type: 'expense', level: 2 },
    { code: '5203', name: 'مصاريف كهرباء ومياه', type: 'expense', level: 2 },
];


function AccountForm({ isOpen, onClose, onSave, account, parentAccount, accounts }: { isOpen: boolean, onClose: () => void, onSave: (data: Partial<Account>) => void, account: Account | null, parentAccount: Account | null, accounts: Account[] }) {
    const isEditing = !!account;
    const [formData, setFormData] = useState<Partial<Account>>({});

    useEffect(() => {
        if (isEditing && account) {
            setFormData({ code: account.code, name: account.name, type: account.type });
        } else if (isOpen) { // Only calculate on open for new accounts
            let nextCode = '';
            let newType: Account['type'] = parentAccount ? parentAccount.type : 'asset';

            const relevantAccounts = parentAccount
                ? accounts.filter(acc => acc.level === parentAccount.level + 1 && acc.code.startsWith(parentAccount.code))
                : accounts.filter(acc => acc.level === 0);
            
            if (relevantAccounts.length === 0) {
                if (parentAccount) {
                    // First child. Let's try to follow the default data's logic for padding.
                    if (parentAccount.level === 0) { // Parent '1', child becomes '11'
                        nextCode = parentAccount.code + '1';
                    } else { // Parent '11', child becomes '1101'
                        nextCode = parentAccount.code + '01';
                    }
                } else {
                    // First main account
                    nextCode = '1';
                }
            } else {
                const lastCodeNum = Math.max(...relevantAccounts.map(acc => parseInt(acc.code, 10)));
                nextCode = String(lastCodeNum + 1);
            }
            
            setFormData({ type: newType, code: nextCode, name: '' });
        }
    }, [account, parentAccount, isEditing, isOpen, accounts]);


    const getLevelFromCode = (code: string): number => {
        if (code.length <= 1) return 0;
        if (code.length <= 2) return 1;
        if (code.length <= 4) return 2;
        return 3;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const level = getLevelFromCode(formData.code || '');
        onSave({ ...formData, level });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent dir="rtl">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>
                           {isEditing ? 'تعديل حساب' : parentAccount ? 'إضافة حساب فرعي' : 'إضافة حساب رئيسي'}
                        </DialogTitle>
                        <DialogDescription>
                            {isEditing 
                                ? 'أدخل تفاصيل الحساب الجديدة.' 
                                : parentAccount 
                                    ? `إضافة حساب جديد تحت "${parentAccount.name}".`
                                    : 'أدخل تفاصيل الحساب الرئيسي الجديد.'
                            }
                            {' '}سيتم تحديد المستوى تلقائياً بناءً على طول الرمز.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="code">رمز الحساب (تلقائي)</Label>
                            <Input id="code" value={formData.code || ''} readOnly disabled required dir="ltr" className="bg-muted/50" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="name">اسم الحساب</Label>
                            <Input id="name" value={formData.name || ''} onChange={(e) => setFormData(p => ({...p, name: e.target.value}))} required />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="type">نوع الحساب</Label>
                            <Select value={formData.type} onValueChange={(v) => setFormData(p => ({...p, type: v as Account['type']}))} disabled={!!parentAccount || isEditing}>
                                <SelectTrigger><SelectValue placeholder="اختر النوع..." /></SelectTrigger>
                                <SelectContent>
                                    {Object.entries(accountTypeTranslations).map(([key, value]) => (
                                        <SelectItem key={key} value={key}>{value}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
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


export default function ChartOfAccountsPage() {
    const router = useRouter();
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [isSeeding, setIsSeeding] = useState(false);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
    const [parentAccount, setParentAccount] = useState<Account | null>(null);

    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!firestore) return;
        const fetchAccounts = async () => {
            setLoading(true);
            try {
                const q = query(collection(firestore, 'chartOfAccounts'));
                const snapshot = await getDocs(q);
                const fetchedAccounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
                fetchedAccounts.sort((a, b) => a.code.localeCompare(b.code));
                setAccounts(fetchedAccounts);
            } catch (e) {
                console.error("Error fetching chart of accounts: ", e);
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب شجرة الحسابات.' });
            } finally {
                setLoading(false);
            }
        };
        fetchAccounts();
    }, [firestore, toast]);


    const handleAddClick = () => {
        setEditingAccount(null);
        setParentAccount(null);
        setIsFormOpen(true);
    };

    const handleAddSubAccountClick = (parent: Account) => {
        setParentAccount(parent);
        setEditingAccount(null);
        setIsFormOpen(true);
    };
    
    const handleEditClick = (account: Account) => {
        setParentAccount(null);
        setEditingAccount(account);
        setIsFormOpen(true);
    };

    const handleDeleteClick = (account: Account) => {
        setAccountToDelete(account);
        setIsAlertOpen(true);
    };

    const handleSave = async (data: Partial<Account>) => {
        if (!firestore || !data.code || !data.name || !data.type) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء تعبئة جميع الحقول.' });
            return;
        }
        setIsSaving(true);
        try {
            if (editingAccount?.id) {
                await updateDoc(doc(firestore, 'chartOfAccounts', editingAccount.id), data);
                toast({ title: 'نجاح', description: 'تم تحديث الحساب.' });
            } else {
                await addDoc(collection(firestore, 'chartOfAccounts'), data);
                toast({ title: 'نجاح', description: 'تمت إضافة الحساب.' });
            }
            setIsFormOpen(false);
            setEditingAccount(null);
            setParentAccount(null);
            // Re-fetch accounts
            const q = query(collection(firestore, 'chartOfAccounts'));
            const snapshot = await getDocs(q);
            const fetchedAccounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
            fetchedAccounts.sort((a, b) => a.code.localeCompare(b.code));
            setAccounts(fetchedAccounts);

        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ الحساب.' });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDeleteConfirm = async () => {
        if (!firestore || !accountToDelete?.id) return;
        setIsSaving(true);
        try {
            await deleteDoc(doc(firestore, 'chartOfAccounts', accountToDelete.id));
            toast({ title: 'نجاح', description: 'تم حذف الحساب.' });
            setIsAlertOpen(false);
            setAccountToDelete(null);
             // Re-fetch accounts
            const q = query(collection(firestore, 'chartOfAccounts'));
            const snapshot = await getDocs(q);
            const fetchedAccounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
            fetchedAccounts.sort((a, b) => a.code.localeCompare(b.code));
            setAccounts(fetchedAccounts);
        } catch (e) {
             console.error(e);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف الحساب. قد يكون مرتبطًا ببيانات أخرى.' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSeedChartOfAccounts = async () => {
        if (!firestore) return;
        setIsSeeding(true);
        try {
            const batch = writeBatch(firestore);
            const accountsRef = collection(firestore, 'chartOfAccounts');
            defaultChartOfAccounts.forEach(account => {
                const docRef = doc(accountsRef);
                batch.set(docRef, account);
            });
            await batch.commit();
            toast({ title: 'نجاح', description: 'تم تنزيل شجرة الحسابات الأساسية بنجاح.' });
            // Re-fetch accounts
             const q = query(collection(firestore, 'chartOfAccounts'));
            const snapshot = await getDocs(q);
            const fetchedAccounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
            fetchedAccounts.sort((a, b) => a.code.localeCompare(b.code));
            setAccounts(fetchedAccounts);
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تنزيل شجرة الحسابات.' });
        } finally {
            setIsSeeding(false);
        }
    };


    return (
        <div className="space-y-6" dir="rtl">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>شجرة الحسابات</CardTitle>
                            <CardDescription>
                            عرض وإدارة دليل الحسابات الخاص بالشركة.
                            </CardDescription>
                        </div>
                        <Button onClick={handleAddClick}>
                            <PlusCircle className="ml-2 h-4 w-4" />
                            إضافة حساب رئيسي
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-1/4">رقم الحساب</TableHead>
                                    <TableHead className="w-1/2">اسم الحساب</TableHead>
                                    <TableHead>نوع الحساب</TableHead>
                                    <TableHead><span className="sr-only">الإجراءات</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading && Array.from({length: 5}).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={4}><Skeleton className="h-6 w-full"/></TableCell>
                                    </TableRow>
                                ))}
                                {!loading && accounts.length === 0 && (
                                     <TableRow>
                                        <TableCell colSpan={4} className="text-center h-48">
                                            <div className="flex flex-col items-center justify-center gap-4">
                                                <p className="text-muted-foreground">
                                                    لا توجد حسابات. ابدأ بإضافة حساب جديد، أو قم بتنزيل شجرة حسابات أساسية للبدء.
                                                </p>
                                                <Button onClick={handleSeedChartOfAccounts} disabled={isSeeding}>
                                                    {isSeeding ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <DownloadCloud className="ml-2 h-4 w-4" />}
                                                    {isSeeding ? 'جاري التنزيل...' : 'تنزيل شجرة حسابات أساسية'}
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                                {!loading && accounts.map((account) => (
                                    <TableRow key={account.id} className={account.level === 0 ? 'bg-muted/50' : ''}>
                                        <TableCell className="font-mono" style={{ paddingRight: `${account.level * 1.5 + 1}rem` }}>
                                            {account.code}
                                        </TableCell>
                                        <TableCell className="font-medium" style={{ paddingRight: `${account.level * 1.5 + 1}rem` }}>
                                            <div className="flex items-center gap-2 group">
                                                <span>{account.name}</span>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={(e) => { e.stopPropagation(); handleAddSubAccountClick(account); }}
                                                >
                                                    <PlusCircle className="h-4 w-4 text-primary" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={accountTypeColors[account.type]}>
                                                {accountTypeTranslations[account.type]}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4"/></Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent dir="rtl">
                                                    <DropdownMenuItem onClick={() => handleEditClick(account)}>
                                                        <Pencil className="ml-2 h-4 w-4" /> تعديل
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleDeleteClick(account)} className="text-destructive focus:text-destructive">
                                                        <Trash2 className="ml-2 h-4 w-4" /> حذف
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
            </Card>

            <AccountForm 
                isOpen={isFormOpen} 
                onClose={() => setIsFormOpen(false)} 
                onSave={handleSave} 
                account={editingAccount} 
                parentAccount={parentAccount}
                accounts={accounts}
            />
            
            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                        <AlertDialogDescription>
                            هل أنت متأكد من رغبتك في حذف الحساب "{accountToDelete?.name}"؟ لا يمكن التراجع عن هذا الإجراء.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSaving}>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm} disabled={isSaving} className="bg-destructive hover:bg-destructive/90">
                            {isSaving ? <><Loader2 className="ml-2 h-4 w-4 animate-spin"/> جاري الحذف...</> : 'نعم، قم بالحذف'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
