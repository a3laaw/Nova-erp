
'use client';

import React, { useState, useMemo, useCallback } from 'react';
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
    Sparkles,
    CheckCircle2,
    AlertTriangle,
    X
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, doc, updateDoc, deleteDoc, writeBatch, getDocs, query, where, orderBy, serverTimestamp } from 'firebase/firestore';
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
import type { Account, JournalEntry } from '@/lib/types';
import { formatCurrency, cn, cleanFirestoreData, getTenantPath } from '@/lib/utils';
import { defaultChartOfAccounts } from '@/lib/default-coa';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useAuth } from '@/context/auth-context';

export default function ChartOfAccountsPage() {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    
    // 🛡️ توجيه المسار للمنشأة المحددة أو المطور
    const tenantId = currentUser?.currentCompanyId || (currentUser?.role === 'Developer' ? 'master' : null);
    
    const [openAccounts, setOpenAccounts] = useState<Set<string>>(new Set(['1', '2', '3', '4', '5']));
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
    const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);
    const [importConfirmText, setImportConfirmText] = useState('');
    
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isSeeding, setIsSeeding] = useState(false);

    const { data: accounts, loading: accountsLoading } = useSubscription<Account>(
        firestore, 
        tenantId ? 'chartOfAccounts' : null,
        [orderBy('code')]
    );

    const { data: journalEntries, loading: entriesLoading } = useSubscription<JournalEntry>(
        firestore, 
        tenantId ? 'journalEntries' : null, 
        [where('status', '==', 'posted')]
    );
    
    const loading = accountsLoading || entriesLoading;

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
                if (!childrenMap.has(acc.parentCode)) childrenMap.set(acc.parentCode, []);
                childrenMap.get(acc.parentCode)!.push(acc);
            }
        });
        const roots = accounts.filter(acc => acc.level === 0);
        const result: Account[] = [];
        function addChildren(account: Account) {
            result.push(account);
            if (openAccounts.has(account.code)) { 
                (childrenMap.get(account.code) || []).forEach(addChildren); 
            }
        }
        roots.forEach(addChildren);
        return result;
    }, [accounts, openAccounts]);

    const toggleAccount = (code: string) => {
        setOpenAccounts(prev => {
            const next = new Set(prev);
            if (next.has(code)) next.delete(code);
            else next.add(code);
            return next;
        });
    };

    const handleImportDefaults = async () => {
        if (!firestore || !tenantId || importConfirmText !== 'تأكيد') return;
        setIsSeeding(true);
        try {
            const batch = writeBatch(firestore);
            const coaPath = getTenantPath('chartOfAccounts', tenantId);
            
            const existingSnap = await getDocs(query(collection(firestore, coaPath!)));
            existingSnap.forEach(d => batch.delete(d.ref));

            for (const account of defaultChartOfAccounts) {
                const newAccRef = doc(collection(firestore, coaPath!));
                batch.set(newAccRef, cleanFirestoreData({
                    ...account,
                    companyId: tenantId,
                    createdAt: serverTimestamp()
                }));
            }

            await batch.commit();
            toast({ title: 'نجاح الاستيراد', description: 'تم تأسيس شجرة الحسابات الموحدة لمنشأتك بنجاح.' });
            setIsImportConfirmOpen(false);
            setImportConfirmText('');
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'فشل الاستيراد', description: e.message });
        } finally {
            setIsSeeding(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (!accountToDelete || !firestore || !tenantId) return;
        setIsSaving(true);
        try {
            const path = getTenantPath(`chartOfAccounts/${accountToDelete.id}`, tenantId);
            await deleteDoc(doc(firestore, path!));
            toast({ title: 'تم الحذف' });
        } finally {
            setIsSaving(false);
            setIsDeleteAlertOpen(false);
            setAccountToDelete(null);
        }
    };

    return (
        <div className="space-y-10" dir="rtl">
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
                            <Button 
                                onClick={() => setIsImportConfirmOpen(true)} 
                                variant="outline" 
                                className="h-12 px-6 rounded-2xl font-black gap-2 bg-white/20 text-white border-white/40 hover:bg-white/30 backdrop-blur-md shadow-xl" 
                                disabled={isSeeding}
                            >
                                {isSeeding ? <Loader2 className="animate-spin h-4 w-4"/> : <DownloadCloud className="h-4 w-4" />} استيراد الدليل
                            </Button>
                            <Button onClick={() => { setEditingAccount(null); setIsFormOpen(true); }} className="h-12 px-8 rounded-2xl font-black gap-2 bg-white text-[#FF7A00] shadow-xl hover:bg-slate-50 border-none transition-transform hover:scale-105">
                                <PlusCircle className="h-5 w-5" /> إضافة حساب
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
                            ) : displayedAccounts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-64 text-center">
                                        <div className="flex flex-col items-center gap-4 opacity-30 grayscale">
                                            <ListTree className="h-20 w-20 text-muted-foreground" />
                                            <p className="text-xl font-black italic">شجرة الحسابات فارغة حالياً.</p>
                                            <Button onClick={() => setIsImportConfirmOpen(true)} variant="link" className="text-primary font-black underline">استيراد الدليل الافتراضي الآن</Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : displayedAccounts.map(account => {
                                const balance = accountBalances.get(account.id!) || 0;
                                const hasChildren = accounts.some(a => a.parentCode === account.code);
                                const isOpen = openAccounts.has(account.code);

                                return (
                                    <TableRow key={account.id} className={cn(account.level === 0 ? 'bg-primary/[0.03]' : 'hover:bg-[#F3E8FF]/20 group transition-colors')}>
                                        <TableCell style={{ paddingRight: `${(account.level || 0) * 1.5 + 2.5}rem` }} className="py-4">
                                            <div className="flex items-center gap-3">
                                                {hasChildren && (
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-lg bg-white shadow-sm" onClick={() => toggleAccount(account.code)}>
                                                        {isOpen ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                                                    </Button>
                                                )}
                                                {!hasChildren && <div className="w-6" />}
                                                <div className="flex flex-col">
                                                    <span className="font-black text-base text-slate-800">{account.name}</span>
                                                    <span className="font-mono text-[10px] text-muted-foreground opacity-60">{account.code}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell><Badge variant="outline" className="font-black text-[10px] px-3 bg-white">{account.type}</Badge></TableCell>
                                        <TableCell className="text-left font-mono font-black text-xl text-[#2E5BCC]">{formatCurrency(balance)}</TableCell>
                                        <TableCell className="text-center">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl border group-hover:border-primary/20"><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" dir="rtl" className="rounded-2xl p-2 shadow-2xl border-none">
                                                    <DropdownMenuLabel className="font-black px-3 py-2 text-xs text-slate-400">إدارة الحساب</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => { setEditingAccount(account); setIsFormOpen(true); }} className="gap-2 rounded-xl py-3 font-bold"><Pencil className="h-4 w-4 text-primary"/> تعديل</DropdownMenuItem>
                                                    <DropdownMenuSeparator className="bg-slate-100" />
                                                    <DropdownMenuItem onClick={() => { setAccountToDelete(account); setIsDeleteAlertOpen(true); }} className="text-red-600 gap-2 rounded-xl py-3 font-black focus:bg-red-50"><Trash2 className="h-4 w-4"/> حذف نهائي</DropdownMenuItem>
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

            <AlertDialog open={isImportConfirmOpen} onOpenChange={(v) => { setIsImportConfirmOpen(v); setImportConfirmText(''); }}>
                <AlertDialogContent dir="rtl" className="rounded-[2.5rem] p-10 border-none shadow-2xl">
                    <AlertDialogHeader>
                        <div className="p-4 bg-primary/10 rounded-3xl w-fit mb-4 shadow-inner">
                            <DownloadCloud className="h-10 w-10 text-primary animate-bounce" />
                        </div>
                        <AlertDialogTitle className="text-2xl font-black text-[#1e1b4b]">تأسيس الدليل المحاسبي الموحد</AlertDialogTitle>
                        <AlertDialogDescription className="text-lg font-medium leading-relaxed mt-2 text-slate-600">
                            سيقوم هذا الإجراء بمسح كافة الحسابات الحالية واستبدالها بالدليل المحاسبي المعتمد لضمان توافق النظام مع التقارير المالية.
                            <br /><br />
                            <span className="text-red-600 font-black">اكتب كلمة "تأكيد" أدناه للمتابعة:</span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
                        <Input 
                            value={importConfirmText} 
                            onChange={(e) => setImportConfirmText(e.target.value)} 
                            placeholder="تأكيد" 
                            className="h-14 rounded-2xl text-center font-black text-2xl border-2 shadow-inner" 
                        />
                    </div>
                    <AlertDialogFooter className="gap-3">
                        <AlertDialogCancel className="rounded-xl font-bold h-12 px-8 border-2">إلغاء</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleImportDefaults} 
                            disabled={importConfirmText !== 'تأكيد' || isSeeding} 
                            className="bg-primary hover:bg-black rounded-xl font-black h-12 px-12 shadow-xl shadow-primary/30"
                        >
                            {isSeeding ? <Loader2 className="animate-spin h-5 w-5"/> : 'ابدأ التأسيس الآن'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
                <AlertDialogContent dir="rtl" className="rounded-[2.5rem] p-10">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-black text-red-700">تأكيد حذف الحساب؟</AlertDialogTitle>
                        <AlertDialogDescription className="font-bold">سيتم مسح الحساب نهائياً من الشجرة. تأكد من عدم وجود قيود مرتبطة به.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-3 mt-6">
                        <AlertDialogCancel className="rounded-xl font-bold h-12 px-8 border-2">تراجع</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteAccount} className="bg-red-600 hover:bg-red-700 rounded-xl font-black h-12 px-12">نعم، حذف نهائي</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
