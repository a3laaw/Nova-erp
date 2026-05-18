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
import { 
    MoreHorizontal, 
    PlusCircle, 
    Pencil, 
    Trash2, 
    Loader2, 
    DownloadCloud, 
    Plus, 
    Minus, 
    ListTree,
    Sparkles
} from 'lucide-react';
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
  DropdownMenuLabel,
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
        onSave({ ...formData, level: parentAccount !== null ? (parentAccount.level || 0) + 1 : 0, parentCode: parentAccount?.code || null });
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent dir="rtl" className="rounded-[2rem] p-10 border-none shadow-2xl">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black">{isEditing ? 'تعديل الحساب' : parentAccount ? 'إضافة حساب فرعي' : 'إضافة حساب رئيسي'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-6 py-8">
                        <div className="grid gap-2"><Label className="font-bold mr-1">رمز الحساب</Label><Input value={formData.code || ''} onChange={(e) => setFormData(p => ({ ...p, code: e.target.value }))} required dir="ltr" className="h-11 rounded-xl font-mono border-2" /></div>
                        <div className="grid gap-2"><Label className="font-bold mr-1">اسم الحساب</Label><Input value={formData.name || ''} onChange={(e) => setFormData(p => ({...p, name: e.target.value}))} required className="h-11 rounded-xl border-2 font-bold" /></div>
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">نوع الحساب</Label>
                            <Select value={formData.type} onValueChange={(v) => setFormData(p => ({...p, type: v as Account['type']}))} disabled={!!parentAccount || isEditing}>
                                <SelectTrigger className="h-11 rounded-xl border-2"><SelectValue placeholder="اختر النوع..." /></SelectTrigger>
                                <SelectContent dir="rtl">{Object.entries(accountTypeTranslations).map(([key, value]) => (<SelectItem key={key} value={key}>{value}</SelectItem>))}</SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter className="gap-3">
                        <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
                        <Button type="submit" className="h-11 px-10 rounded-xl font-black shadow-xl shadow-primary/20">حفظ الحساب</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export default function ChartOfAccountsPage() {
    const { firestore } = useFirebase();
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

    const handleDelete = async () => {
        if (!itemToDelete || !firestore) return;
        try {
            await deleteDoc(doc(firestore, 'chartOfAccounts', itemToDelete.id!));
            toast({ title: 'نجاح الحذف' });
        } finally { setIsAlertOpen(false); setAccountToDelete(null); }
    };

    return (
        <div className="space-y-10" dir="rtl">
             {/* 🛡️ الهيدر الرئيسي السيادي المحدث بالهوية البرتقالية 🛡️ */}
            <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-gradient-to-r from-[#FF7A00] to-[#FFB000] text-white relative">
                <div className="absolute top-0 right-0 w-80 h-full bg-white/10 -skew-x-12 transform translate-x-32 pointer-events-none" />
                <CardHeader className="pb-10 pt-10 px-10 relative z-10">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                        <div className="flex items-center gap-6">
                            <div className="text-right">
                                <CardTitle className="text-3xl font-black text-white tracking-tighter">شجرة الحسابات العامة</CardTitle>
                                <div className="flex items-center gap-2 mt-1">
                                    <Sparkles className="h-4 w-4 text-amber-200 animate-pulse" />
                                    <CardDescription className="text-white/90 font-bold text-sm">إدارة الدليل المحاسبي ومراكز التكلفة والربحية للمنشأة.</CardDescription>
                                </div>
                            </div>
                            <div className="p-5 bg-white/20 rounded-[2rem] backdrop-blur-xl border border-white/40 shadow-2xl">
                                <ListTree className="h-10 w-10 text-white" />
                            </div>
                        </div>
                         <div className="flex gap-2">
                            <Button onClick={() => setIsSeedAlertOpen(true)} variant="outline" className="h-12 px-6 rounded-2xl font-black gap-2 bg-white/20 text-white border-white/40 hover:bg-white/30 backdrop-blur-md" disabled={isSeeding}>
                                {isSeeding ? <Loader2 className="animate-spin h-4 w-4"/> : <DownloadCloud className="h-4 w-4" />} استيراد الدليل
                            </Button>
                            <Button onClick={() => { setEditingAccount(null); setParentAccount(null); setIsFormOpen(true); }} className="h-12 px-8 rounded-2xl font-black gap-2 bg-white text-[#FF7A00] shadow-xl hover:bg-slate-50 border-none">
                                <PlusCircle className="h-5 w-5" /> إضافة
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card className="border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white/95">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-[#F8F9FE]">
                            <TableRow className="border-none">
                                <TableHead className="px-10 py-5 font-black text-[#7209B7]">اسم الحساب والترميز</TableHead>
                                <TableHead className="font-black text-[#7209B7]">النوع</TableHead>
                                <TableHead className="font-black text-[#7209B7] text-left">الرصيد الحالي</TableHead>
                                <TableHead className="w-[100px] text-center font-black text-[#7209B7]">إجراء</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({length: 3}).map((_, i) => <TableRow key={i}><TableCell colSpan={4} className="p-8"><Skeleton className="h-10 w-full rounded-2xl"/></TableCell></TableRow>)
                            ) : displayedAccounts.map(account => {
                                const balance = accountBalances.get(account.id!) || 0;
                                const hasChildren = accounts.some(a => a.parentCode === account.code);
                                const isOpen = openAccounts.has(account.code);
                                return (
                                    <TableRow key={account.id} className={cn(account.level === 0 ? 'bg-primary/[0.03]' : 'hover:bg-[#F3E8FF]/20 group transition-colors')}>
                                        <TableCell style={{ paddingRight: `${(account.level || 0) * 1.5 + 2.5}rem` }} className="py-4">
                                            <div className="flex items-center gap-3">
                                                {hasChildren && <Button variant="ghost" size="icon" className="h-6 w-6 text-primary" onClick={() => setOpenAccounts(prev => { const n = new Set(prev); if(n.has(account.code)) n.delete(account.code); else n.add(account.code); return n; })}>{isOpen ? <Minus className="h-3 w-3"/> : <Plus className="h-3 w-3"/>}</Button>}
                                                <div className="flex flex-col">
                                                    <span className="font-black text-base text-slate-800">{account.name}</span>
                                                    <span className="font-mono text-[10px] text-muted-foreground opacity-60">{account.code}</span>
                                                </div>
                                                {account.level < 4 && <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-all h-7 w-7 text-primary bg-primary/5 rounded-lg" onClick={() => { setParentAccount(account); setEditingAccount(null); setIsFormOpen(true); }}><PlusCircle className="h-4 w-4"/></Button>}
                                            </div>
                                        </TableCell>
                                        <TableCell><Badge variant="outline" className={cn("font-black text-[10px] px-3", accountTypeColors[account.type])}>{accountTypeTranslations[account.type]}</Badge></TableCell>
                                        <TableCell className={cn("text-left font-mono font-black text-xl", balance < 0 ? "text-red-600" : "text-[#2E5BCC]")}>{formatCurrency(balance)}</TableCell>
                                        <TableCell className="text-center">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl border group-hover:border-primary/20"><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" dir="rtl" className="rounded-2xl p-2 shadow-2xl border-none">
                                                    <DropdownMenuLabel className="font-black px-3 py-2">خيارات الحساب</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => { setEditingAccount(account); setParentAccount(accounts.find(a => a.code === account.parentCode) || null); setIsFormOpen(true); }} className="gap-2 rounded-xl py-3 font-bold"><Pencil className="h-4 w-4 text-primary"/> تعديل</DropdownMenuItem>
                                                    <DropdownMenuSeparator className="bg-slate-100" />
                                                    <DropdownMenuItem onClick={() => { setAccountToDelete(account); setIsAlertOpen(true); }} className="text-red-600 gap-2 rounded-xl py-3 font-black focus:bg-red-50"><Trash2 className="h-4 w-4"/> حذف نهائي</DropdownMenuItem>
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
                <AlertDialogContent dir="rtl" className="rounded-[2rem] p-10 border-none shadow-2xl">
                    <AlertDialogHeader>
                        <div className="p-3 bg-red-100 rounded-2xl text-red-600 w-fit mb-4 shadow-inner"><Trash2 className="h-10 w-10"/></div>
                        <AlertDialogTitle className="text-2xl font-black text-red-700">حذف الحساب المالي نهائياً؟</AlertDialogTitle>
                        <AlertDialogDescription className="text-lg font-medium leading-relaxed mt-2">سيتم مسح الحساب <strong className="text-foreground">"{accountToDelete?.name}"</strong> وكافة سجلاته الفرعية. تأكد من عدم وجود قيود مالية نشطة على هذا الحساب قبل الحذف.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-8 gap-3">
                        <AlertDialogCancel className="rounded-xl font-bold h-12 px-8 border-2">إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 rounded-xl font-black h-12 px-12 shadow-xl shadow-red-200">نعم، حذف نهائي</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={isSeedAlertOpen} onOpenChange={setIsSeedAlertOpen}>
                <AlertDialogContent dir="rtl" className="rounded-[2.5rem] p-10 border-none shadow-2xl">
                    <AlertDialogHeader>
                        <div className="p-5 bg-blue-100 rounded-[1.8rem] text-blue-600 w-fit mb-6 shadow-inner"><DownloadCloud className="h-12 w-12"/></div>
                        <AlertDialogTitle className="text-2xl font-black text-blue-900">تأكيد استيراد الدليل المحاسبي؟</AlertDialogTitle>
                        <AlertDialogDescription className="text-lg font-bold text-slate-500 leading-relaxed mt-4">سيقوم هذا الإجراء بمسح الشجرة الحالية واستبدالها بالدليل الافتراضي المعتمد.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <Input value={confirmSeedText} onChange={e => setConfirmSeedText(e.target.value)} className="h-14 text-center font-black text-2xl border-2 rounded-2xl bg-slate-50" placeholder="كلمة التأكيد: تأكيد المسح" />
                    <AlertDialogFooter className="mt-8 gap-3">
                        <AlertDialogCancel className="rounded-xl font-bold h-12 px-8">إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSeedChartOfAccounts} disabled={confirmSeedText !== 'تأكيد المسح' || isSeeding} className="bg-blue-600 hover:bg-blue-700 rounded-xl font-black h-12 px-16 shadow-xl shadow-blue-200">
                            {isSeeding ? <Loader2 className="animate-spin h-5 w-5"/> : 'بدء التأسيس'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}