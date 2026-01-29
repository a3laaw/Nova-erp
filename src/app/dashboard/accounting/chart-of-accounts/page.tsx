'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  TableFooter,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, ArrowRight, MoreHorizontal, Pencil, Trash2, Loader2, DownloadCloud, Folder, FolderOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { collection, query, addDoc, doc, updateDoc, deleteDoc, writeBatch, getDocs, where } from 'firebase/firestore';
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
import type { Account, JournalEntry } from '@/lib/types';
import { formatCurrency, cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';


const accountTypeTranslations: Record<Account['type'], string> = {
    asset: 'أصل',
    liability: 'خصم',
    equity: 'حقوق ملكية',
    income: 'إيراد',
    expense: 'مصروف',
};

const accountTypeColors: Record<Account['type'], string> = {
    asset: 'bg-blue-100 text-blue-800 border-blue-200',
    liability: 'bg-red-100 text-red-800 border-red-200',
    equity: 'bg-purple-100 text-purple-800 border-purple-200',
    income: 'bg-green-100 text-green-800 border-green-200',
    expense: 'bg-orange-100 text-orange-800 border-orange-200',
};

const defaultChartOfAccounts: Omit<Account, 'id'>[] = [
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
    { code: '2', name: 'الخصوم (الالتزامات)', type: 'liability', level: 0 },
    { code: '21', name: 'الخصوم المتداولة', type: 'liability', level: 1 },
    { code: '2101', name: 'الذمم الدائنة', type: 'liability', level: 2 },
    { code: '210101', name: 'الموردون', type: 'liability', level: 3 },
    { code: '2102', name: 'المصروفات المستحقة', type: 'liability', level: 2 },
    { code: '2103', name: 'الضرائب المستحقة', type: 'liability', level: 2 },
    { code: '210301', name: 'ضريبة القيمة المضافة المستحقة', type: 'liability', level: 3 },
    { code: '22', name: 'الخصوم غير المتداولة', type: 'liability', level: 1 },
    { code: '2201', name: 'القروض طويلة الأجل', type: 'liability', level: 2 },
    { code: '3', name: 'حقوق الملكية', type: 'equity', level: 0 },
    { code: '31', name: 'رأس المال', type: 'equity', level: 1 },
    { code: '3101', name: 'رأس المال المدفوع', type: 'equity', level: 2 },
    { code: '32', name: 'الأرباح المحتجزة', type: 'equity', level: 1 },
    { code: '4', name: 'الإيرادات', type: 'income', level: 0 },
    { code: '41', name: 'إيرادات النشاط الرئيسي', type: 'income', level: 1 },
    { code: '4101', name: 'إيرادات استشارات هندسية', type: 'income', level: 2 },
    { code: '42', name: 'إيرادات أخرى', type: 'income', level: 1 },
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
        } else if (isOpen) {
            let nextCode = '';
            let newType: Account['type'] = parentAccount ? parentAccount.type : 'asset';

            const relevantAccounts = parentAccount
                ? accounts.filter(acc => acc.level === parentAccount.level + 1 && acc.code.startsWith(parentAccount.code))
                : accounts.filter(acc => acc.level === 0);
            
            if (relevantAccounts.length === 0) {
                if (parentAccount) {
                    if (parentAccount.level === 0) { nextCode = parentAccount.code + '1'; } 
                    else { nextCode = parentAccount.code + '01'; }
                } else { nextCode = '1'; }
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
                            {isEditing ? 'أدخل تفاصيل الحساب الجديدة.' : parentAccount ? `إضافة حساب جديد تحت "${parentAccount.name}".` : 'أدخل تفاصيل الحساب الرئيسي الجديد.'}
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
    const [openCollapsibles, setOpenCollapsibles] = useState<Set<string>>(new Set());

    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [accountBalances, setAccountBalances] = useState<Map<string, number>>(new Map());

    const fetchAllData = useCallback(async () => {
        if (!firestore) return;
        setLoading(true);
        try {
            const accountsQuery = query(collection(firestore, 'chartOfAccounts'));
            const entriesQuery = query(collection(firestore, 'journalEntries'), where('status', '==', 'posted'));

            const [accountsSnapshot, entriesSnapshot] = await Promise.all([
                getDocs(accountsQuery),
                getDocs(entriesQuery),
            ]);

            const fetchedAccounts = accountsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
            fetchedAccounts.sort((a, b) => a.code.localeCompare(b.code));
            setAccounts(fetchedAccounts);

            const balances = new Map<string, number>();
            const journalEntries = entriesSnapshot.docs.map(doc => doc.data() as JournalEntry);
            
            journalEntries.forEach(entry => {
                entry.lines.forEach(line => {
                    const acc = fetchedAccounts.find(a => a.id === line.accountId);
                    if (!acc) return;
                    
                    const currentBalance = balances.get(line.accountId) || 0;
                    let balanceChange = 0;
                    
                    if (acc.type === 'asset' || acc.type === 'expense') {
                        balanceChange = (line.debit || 0) - (line.credit || 0);
                    } else { // Liability, Equity, Income
                        balanceChange = (line.credit || 0) - (line.debit || 0);
                    }
                    balances.set(line.accountId, currentBalance + balanceChange);
                });
            });

            // Calculate parent balances
            fetchedAccounts.forEach(parentAcc => {
                if (parentAcc.level < 3) { // Only calculate for parent levels
                    let parentBalance = balances.get(parentAcc.id!) || 0;
                    fetchedAccounts.forEach(childAcc => {
                        if (childAcc.code.startsWith(parentAcc.code) && childAcc.code !== parentAcc.code) {
                            parentBalance += balances.get(childAcc.id!) || 0;
                        }
                    });
                     balances.set(parentAcc.id!, parentBalance);
                }
            });


            setAccountBalances(balances);

        } catch (e) {
            console.error("Error fetching data: ", e);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب البيانات.' });
        } finally {
            setLoading(false);
        }
    }, [firestore, toast]);
    
    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

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
        if (!firestore || !data.code || !data.name || !data.type) return;
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
            await fetchAllData();
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
            await fetchAllData();
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
            await fetchAllData();
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تنزيل شجرة الحسابات.' });
        } finally {
            setIsSeeding(false);
        }
    };

    const toggleCollapsible = (code: string) => {
        setOpenCollapsibles(prev => {
            const newSet = new Set(prev);
            if (newSet.has(code)) {
                newSet.delete(code);
            } else {
                newSet.add(code);
            }
            return newSet;
        });
    };

    const renderAccountRow = (account: Account, allAccounts: Account[]) => {
        const balance = accountBalances.get(account.id!) || 0;
        const children = allAccounts.filter(a => a.code.startsWith(account.code) && a.level === account.level + 1);
        const hasChildren = children.length > 0;
        const isOpen = openCollapsibles.has(account.code);

        return (
            <React.Fragment key={account.id}>
                <TableRow className={account.level === 0 ? 'bg-muted/50' : ''}>
                    <TableCell style={{ paddingRight: `${account.level * 1.5 + 1}rem` }}>
                        <div className="flex items-center gap-2 group">
                             {hasChildren ? (
                                <CollapsibleTrigger asChild>
                                    <button onClick={() => toggleCollapsible(account.code)}>
                                        {isOpen ? <FolderOpen className="h-4 w-4 text-primary" /> : <Folder className="h-4 w-4 text-muted-foreground" />}
                                    </button>
                                </CollapsibleTrigger>
                            ) : (
                                <span className="w-4 h-4 inline-block"></span>
                            )}
                            <span className="font-medium">{account.name}</span>
                            <Button
                                type="button" variant="ghost" size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => { e.stopPropagation(); handleAddSubAccountClick(account); }}>
                                <PlusCircle className="h-4 w-4 text-primary" />
                            </Button>
                        </div>
                    </TableCell>
                    <TableCell className="font-mono">{account.code}</TableCell>
                    <TableCell>
                        <Badge variant="outline" className={cn(accountTypeColors[account.type], "whitespace-nowrap")}>
                            {accountTypeTranslations[account.type]}
                        </Badge>
                    </TableCell>
                    <TableCell className={cn("text-left font-mono", balance < 0 && "text-destructive")}>
                        {formatCurrency(balance)}
                    </TableCell>
                    <TableCell className="text-center">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger>
                            <DropdownMenuContent dir="rtl">
                                <DropdownMenuItem onClick={() => handleEditClick(account)}><Pencil className="ml-2 h-4 w-4" /> تعديل</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDeleteClick(account)} className="text-destructive focus:text-destructive"><Trash2 className="ml-2 h-4 w-4" /> حذف</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                </TableRow>
                {hasChildren && (
                    <CollapsibleContent asChild>
                        <tr>
                            <td colSpan={5} className="p-0">
                                {isOpen && children.map(child => renderAccountRow(child, allAccounts))}
                            </td>
                        </tr>
                    </CollapsibleContent>
                )}
            </React.Fragment>
        );
    };

    const rootAccounts = accounts.filter(a => a.level === 0);

    return (
        <div className="space-y-6" dir="rtl">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>شجرة الحسابات</CardTitle>
                            <CardDescription>عرض وإدارة دليل الحسابات الخاص بالشركة وأرصدتها الحالية.</CardDescription>
                        </div>
                        <Button onClick={handleAddClick}><PlusCircle className="ml-2 h-4 w-4" /> إضافة حساب رئيسي</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-2/5">اسم الحساب</TableHead>
                                    <TableHead>رمز الحساب</TableHead>
                                    <TableHead>النوع</TableHead>
                                    <TableHead className="text-left">الرصيد</TableHead>
                                    <TableHead className="text-center"><span className="sr-only">الإجراءات</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    Array.from({length: 5}).map((_, i) => (
                                        <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-6 w-full"/></TableCell></TableRow>
                                    ))
                                ) : accounts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center h-48">
                                            <div className="flex flex-col items-center justify-center gap-4">
                                                <p className="text-muted-foreground">لا توجد حسابات. ابدأ بإضافة حساب جديد، أو قم بتنزيل شجرة حسابات أساسية للبدء.</p>
                                                <Button onClick={handleSeedChartOfAccounts} disabled={isSeeding}>
                                                    {isSeeding ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <DownloadCloud className="ml-2 h-4 w-4" />}
                                                    {isSeeding ? 'جاري التنزيل...' : 'تنزيل شجرة حسابات أساسية'}
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    rootAccounts.map(account => (
                                        <Collapsible key={account.id} asChild>
                                           {renderAccountRow(account, accounts)}
                                        </Collapsible>
                                    ))
                                )}
                            </TableBody>
                            {!loading && accounts.length > 0 && (
                                <TableFooter>
                                    <TableRow>
                                        <TableCell colSpan={3} className="font-bold text-lg">الإجمالي</TableCell>
                                        <TableCell colSpan={2} className="text-left font-bold text-lg font-mono">
                                            {formatCurrency(0)}
                                        </TableCell>
                                    </TableRow>
                                </TableFooter>
                            )}
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
                            هل أنت متأكد من رغبتك في حذف الحساب "{accountToDelete?.name}"؟ سيتم حذف جميع الحسابات الفرعية التابعة له. لا يمكن التراجع عن هذا الإجراء.
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
