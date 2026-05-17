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
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, PlusCircle, Pencil, Trash2, Loader2, DownloadCloud, Plus, Minus, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc, writeBatch, getDocs, query, where, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
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
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import type { Account, JournalEntry, Employee } from '@/lib/types';
import { formatCurrency, cn, cleanFirestoreData } from '@/lib/utils';
import { defaultChartOfAccounts } from '@/lib/default-coa';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useAuth } from '@/context/auth-context';

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

const getTypeFromCode = (code: string): Account['type'] => {
    if (code.startsWith('1')) return 'asset';
    if (code.startsWith('2')) return 'liability';
    if (code.startsWith('3')) return 'equity';
    if (code.startsWith('4')) return 'income';
    if (code.startsWith('5')) return 'expense';
    return 'asset'; 
};

function AccountForm({ isOpen, onClose, onSave, account, parentAccount, accounts }: { isOpen: boolean, onClose: () => void, onSave: (data: Partial<Account>) => void, account: Account | null, parentAccount: Account | null, accounts: Account[] }) {
    const { firestore } = useFirebase();
    const isEditing = !!account;
    const [formData, setFormData] = useState<Partial<Account>>({});
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loadingEmployees, setLoadingEmployees] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (isEditing && account) {
                setFormData({ code: account.code, name: account.name, type: account.type, isPayable: account.isPayable, employeeId: account.employeeId || null });
            } else {
                let nextCode = '';
                const level = parentAccount !== null ? (parentAccount.level || 0) + 1 : 0;
                const relevantAccounts = parentAccount
                    ? accounts.filter(acc => acc.parentCode === parentAccount.code)
                    : accounts.filter(acc => acc.level === 0);
                
                if (relevantAccounts.length === 0) {
                     if (parentAccount) { nextCode = parentAccount.code + (level < 3 ? '1' : '01'); } 
                     else {
                         const maxRootCode = Math.max(0, ...accounts.filter(a => a.level === 0).map(a => parseInt(a.code, 10)));
                         nextCode = String(maxRootCode + 1);
                     }
                } else {
                    const lastCodeNum = Math.max(...relevantAccounts.map(acc => parseInt(acc.code, 10)));
                    nextCode = String(lastCodeNum + 1);
                }
                setFormData({ type: parentAccount ? parentAccount.type : 'asset', code: nextCode, name: '', isPayable: true, employeeId: null });
            }
        }
    }, [account, parentAccount, isEditing, isOpen, accounts]);

    useEffect(() => {
        if (isOpen && firestore) {
            setLoadingEmployees(true);
            getDocs(query(collection(firestore, 'employees'), where('status', '==', 'active'))).then(snap => {
                setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() } as Employee)));
            }).finally(() => setLoadingEmployees(false));
        }
    }, [isOpen, firestore]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const code = formData.code || '';
        const level = parentAccount !== null ? (parentAccount.level || 0) + 1 : 0;
        onSave({ ...formData, level, type: parentAccount ? parentAccount.type : getTypeFromCode(code), statement: (code.startsWith('1') || code.startsWith('2') || code.startsWith('3')) ? 'Balance Sheet' : 'Income Statement', balanceType: (code.startsWith('1') || code.startsWith('5')) ? 'Debit' : 'Credit', parentCode: parentAccount?.code || null });
    };

    const showEmployeeLink = parentAccount?.code === '110102' || account?.parentCode === '110102' || parentAccount?.code?.startsWith('110102');

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent dir="rtl">
                <form onSubmit={handleSubmit}>
                    <DialogHeader><DialogTitle>{isEditing ? 'تعديل الحساب' : parentAccount ? 'إضافة حساب فرعي' : 'إضافة حساب رئيسي'}</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2"><Label htmlFor="code">رمز الحساب</Label><Input id="code" value={formData.code || ''} onChange={(e) => setFormData(p => ({ ...p, code: e.target.value }))} required dir="ltr" /></div>
                        <div className="grid gap-2"><Label htmlFor="name">اسم الحساب</Label><Input id="name" value={formData.name || ''} onChange={(e) => setFormData(p => ({...p, name: e.target.value}))} required /></div>
                        {showEmployeeLink && (
                            <div className="p-4 bg-primary/5 rounded-xl border-2 border-dashed border-primary/20 space-y-2">
                                <Label className="font-black text-primary flex items-center gap-2"><User className="h-4 w-4"/> ربط الحساب بموظف (للعهد النقدية)</Label>
                                <InlineSearchList value={formData.employeeId || ''} onSelect={(v) => setFormData(p => ({...p, employeeId: v || null}))} options={employees.map(e => ({ value: e.id!, label: e.fullName }))} placeholder={loadingEmployees ? "جاري التحميل..." : "اختر موظفاً..."} className="bg-white" />
                            </div>
                        )}
                        <div className="grid gap-2">
                            <Label htmlFor="type">نوع الحساب</Label>
                            <Select value={formData.type} onValueChange={(v) => setFormData(p => ({...p, type: v as Account['type']}))} disabled={!!parentAccount || isEditing}>
                                <SelectTrigger><SelectValue placeholder="اختر النوع..." /></SelectTrigger>
                                <SelectContent>{Object.entries(accountTypeTranslations).map(([key, value]) => (<SelectItem key={key} value={key}>{value}</SelectItem>))}</SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter><Button type="button" variant="outline" onClick={onClose}>إلغاء</Button><Button type="submit">حفظ الحساب</Button></DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export default function ChartOfAccountsPage() {
    const { firestore } = useFirebase();
    const { user } = useAuth();
    const { toast } = useToast();
    
    const [openAccounts, setOpenAccounts] = useState<Set<string>>(new Set(['1', '2', '3', '4', '5']));
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [isSeedAlertOpen, setIsSeedAlertOpen] = useState(false);
    const [confirmSeedText, setConfirmSeedText] = useState('');
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
    const [parentAccount, setParentAccount] = useState<Account | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isSeeding, setIsSeeding] = useState(false);

    const { data: accounts, loading: accountsLoading } = useSubscription<Account>(firestore, 'chartOfAccounts');
    const { data: journalEntries, loading: entriesLoading } = useSubscription<JournalEntry>(firestore, 'journalEntries', [where('status', '==', 'posted')]);
    
    const loading = accountsLoading || entriesLoading;

    const closeDialog = useCallback(() => {
        setIsFormOpen(false);
        setEditingAccount(null);
        setParentAccount(null);
    }, []);

    const accountBalances = useMemo(() => {
        if (!accounts || !journalEntries) return new Map<string, number>();
        const directBalances = new Map<string, number>();
        journalEntries.forEach(entry => {
            entry.lines.forEach(line => {
                const acc = accounts.find(a => a.id === line.accountId);
                if (!acc) return; 
                const currentBalance = directBalances.get(line.accountId) || 0;
                let balanceChange = (acc.type === 'asset' || acc.type === 'expense')
                    ? (line.debit || 0) - (line.credit || 0)
                    : (line.credit || 0) - (line.debit || 0);
                directBalances.set(line.accountId, currentBalance + balanceChange);
            });
        });
        const aggregatedBalances = new Map<string, number>();
        [...accounts].sort((a, b) => (b.level || 0) - (a.level || 0)).forEach(account => {
              let totalBalance = directBalances.get(account.id!) || 0;
              const children = accounts.filter(child => child.parentCode === account.code);
              children.forEach(child => { totalBalance += aggregatedBalances.get(child.id!) || 0; });
              aggregatedBalances.set(account.id!, totalBalance);
          });
        return aggregatedBalances;
    }, [accounts, journalEntries]);

    const displayedAccounts = useMemo(() => {
        if (accounts.length === 0) return [];
        const childrenMap = new Map<string, Account[]>();
        accounts.forEach(acc => {
            if (acc.parentCode) {
                if (!childrenMap.has(acc.parentCode)) { childrenMap.set(acc.parentCode, []); }
                childrenMap.get(acc.parentCode)!.push(acc);
            }
        });
        const sortAccounts = (a: Account, b: Account) => (a.code || '').localeCompare(b.code || '', undefined, { numeric: true });
        childrenMap.forEach(childList => childList.sort(sortAccounts));
        const roots = accounts.filter(acc => acc.level === 0).sort(sortAccounts);
        const result: Account[] = [];
        function addChildren(account: Account) {
            result.push(account);
            if (openAccounts.has(account.code)) { (childrenMap.get(account.code) || []).forEach(addChildren); }
        }
        roots.forEach(addChildren);
        return result;
    }, [accounts, openAccounts]);

    const handleSave = async (data: Partial<Account>) => {
        if (!firestore || !data.code) return;
        setIsSaving(true);
        try {
            if (editingAccount?.id) {
                await updateDoc(doc(firestore, 'chartOfAccounts', editingAccount.id), cleanFirestoreData(data));
                toast({ title: 'تم التحديث' });
            } else {
                await addDoc(collection(firestore, 'chartOfAccounts'), cleanFirestoreData(data));
                toast({ title: 'تمت الإضافة' });
            }
            closeDialog();
        } catch (e) { toast({ variant: 'destructive', title: 'خطأ في الحفظ' }); } finally { setIsSaving(false); }
    };
    
    const handleDeleteConfirm = async () => {
        if (!firestore || !accountToDelete?.id) return;
        setIsSaving(true);
        try {
            await deleteDoc(doc(firestore, 'chartOfAccounts', accountToDelete.id));
            toast({ title: 'تم الحذف' });
            setIsAlertOpen(false);
        } finally { setIsSaving(false); }
    };

    const handleSeedChartOfAccounts = async () => {
        if (!firestore) return;
        setIsSeeding(true);
        try {
            const batch = writeBatch(firestore);
            const existingSnap = await getDocs(query(collection(firestore, 'chartOfAccounts')));
            existingSnap.forEach(doc => batch.delete(doc.ref));

            defaultChartOfAccounts.forEach(account => {
                batch.set(doc(collection(firestore, 'chartOfAccounts')), account);
            });

            await batch.commit();
            toast({ title: 'تم الاستيراد بنجاح' });
            setIsSeedAlertOpen(false);
        } finally { setIsSeeding(false); }
    };

    return (
        <div className="space-y-6" dir="rtl">
             <Card className="rounded-[2.5rem] border-none shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-primary/5 pb-8 border-b">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <CardTitle className="text-2xl font-black">شجرة الحسابات</CardTitle>
                            <CardDescription>إدارة الدليل المحاسبي ومراكز التكلفة للمنشأة.</CardDescription>
                        </div>
                         <div className="flex gap-2">
                            <Button onClick={() => setIsSeedAlertOpen(true)} variant="outline" className="rounded-xl font-bold" disabled={isSeeding}>
                                {isSeeding ? <Loader2 className="animate-spin h-4 w-4"/> : <DownloadCloud className="ml-2 h-4" />} استيراد الشجرة الافتراضية
                            </Button>
                            <Button onClick={() => { setEditingAccount(null); setParentAccount(null); setIsFormOpen(true); }} className="rounded-xl font-black gap-2 shadow-lg shadow-primary/20"><PlusCircle className="h-5 w-5" /> إضافة حساب رئيسي</Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/50 h-14">
                            <TableRow className="border-none">
                                <TableHead className="px-8 font-black text-[#1e1b4b]">اسم الحساب والترميز</TableHead>
                                <TableHead className="font-black text-[#1e1b4b]">النوع</TableHead>
                                <TableHead className="font-black text-[#1e1b4b]">الرصيد الحالي</TableHead>
                                <TableHead className="w-[100px] text-center font-black text-[#1e1b4b]">إجراء</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({length: 3}).map((_, i) => <TableRow key={i}><TableCell colSpan={4} className="p-6"><Skeleton className="h-10 w-full rounded-xl"/></TableCell></TableRow>)
                            ) : displayedAccounts.map(account => {
                                const balance = accountBalances.get(account.id!) || 0;
                                const hasChildren = accounts.some(a => a.parentCode === account.code);
                                const isOpen = openAccounts.has(account.code);
                                return (
                                    <TableRow key={account.id} className={cn(account.level === 0 ? 'bg-muted/20 font-black' : 'hover:bg-primary/5')}>
                                        <TableCell style={{ paddingRight: `${(account.level || 0) * 1.5 + 2}rem` }} className="py-4">
                                            <div className="flex items-center gap-3 group">
                                                {hasChildren && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpenAccounts(prev => { const n = new Set(prev); if(n.has(account.code)) n.delete(account.code); else n.add(account.code); return n; })}>{isOpen ? <Minus className="h-3 w-3"/> : <Plus className="h-3 w-3"/>}</Button>}
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-gray-800">{account.name}</span>
                                                    <span className="font-mono text-[9px] opacity-40">{account.code}</span>
                                                </div>
                                                {account.level < 4 && <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-all h-6 w-6 text-primary" onClick={() => { setParentAccount(account); setEditingAccount(null); setIsFormOpen(true); }}><PlusCircle className="h-4 w-4"/></Button>}
                                            </div>
                                        </TableCell>
                                        <TableCell><Badge variant="outline" className={cn("font-black text-[9px]", accountTypeColors[account.type])}>{accountTypeTranslations[account.type]}</Badge></TableCell>
                                        <TableCell className={cn("font-mono font-black text-lg", balance < 0 ? "text-red-600" : "text-primary")}>{formatCurrency(balance)}</TableCell>
                                        <TableCell className="text-center">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl border group-hover:border-primary/20"><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" dir="rtl" className="rounded-xl shadow-xl border-none p-2">
                                                    <DropdownMenuItem onClick={() => { setEditingAccount(account); setParentAccount(accounts.find(a => a.code === account.parentCode) || null); setIsFormOpen(true); }} className="gap-2 rounded-lg font-bold"><Pencil className="h-4 w-4 text-primary"/> تعديل</DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => { setAccountToDelete(account); setIsAlertOpen(true); }} className="text-red-600 gap-2 rounded-lg font-bold"><Trash2 className="h-4 w-4"/> حذف</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            
            <AccountForm isOpen={isFormOpen} onClose={closeDialog} onSave={handleSave} account={editingAccount} parentAccount={parentAccount} accounts={accounts} />
            
            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                <AlertDialogContent dir="rtl" className="rounded-3xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>حذف الحساب المالي؟</AlertDialogTitle>
                        <AlertDialogDescription>سيتم مسح الحساب "{accountToDelete?.name}" وكافة حساباته الفرعية. لا يمكن الحذف إذا وجد قيد مالي مرتبط.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="rounded-xl font-bold">إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90 rounded-xl font-black px-8">
                            {isSaving ? <Loader2 className="animate-spin h-4 w-4"/> : 'نعم، حذف'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={isSeedAlertOpen} onOpenChange={setIsSeedAlertOpen}>
                <AlertDialogContent dir="rtl" className="rounded-3xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد تهيئة الشجرة؟</AlertDialogTitle>
                        <AlertDialogDescription>سيتم مسح الدليل الحالي واستبداله بالشجرة الافتراضية المعتمدة. <br/><br/> <span className="font-black text-red-600">اكتب "مسح البيانات" للتأكيد:</span></AlertDialogDescription>
                    </AlertDialogHeader>
                    <Input value={confirmSeedText} onChange={e => setConfirmSeedText(e.target.value)} className="h-12 text-center font-black border-2" placeholder="كلمة التأكيد..." />
                    <AlertDialogFooter className="mt-4 gap-2">
                        <AlertDialogCancel className="rounded-xl font-bold">إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSeedChartOfAccounts} disabled={confirmSeedText !== 'مسح البيانات' || isSeeding} className="bg-destructive rounded-xl font-black px-10">
                            {isSeeding ? <Loader2 className="animate-spin h-4 w-4"/> : 'بدء التهيئة'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
