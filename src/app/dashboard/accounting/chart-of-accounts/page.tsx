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
        const roots = accounts.filter(acc => acc.level === 0).sort((a,b) => a.code.localeCompare(b.code, undefined, {numeric: true}));
        const result: Account[] = [];
        function addChildren(account: Account) {
            result.push(account);
            if (openAccounts.has(account.code)) { (childrenMap.get(account.code) || []).forEach(addChildren); }
        }
        roots.forEach(addChildren);
        return result;
    }, [accounts, openAccounts]);

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
                                return (
                                    <TableRow key={account.id} className={cn(account.level === 0 ? 'bg-primary/[0.03]' : 'hover:bg-[#F3E8FF]/20 group transition-colors')}>
                                        <TableCell style={{ paddingRight: `${(account.level || 0) * 1.5 + 2.5}rem` }} className="py-4">
                                            <div className="flex flex-col">
                                                <span className="font-black text-base text-slate-800">{account.name}</span>
                                                <span className="font-mono text-[10px] text-muted-foreground opacity-60">{account.code}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell><Badge variant="outline" className="font-black text-[10px] px-3">{account.type}</Badge></TableCell>
                                        <TableCell className="text-left font-mono font-black text-xl text-[#2E5BCC]">{formatCurrency(balance)}</TableCell>
                                        <TableCell className="text-center">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl border group-hover:border-primary/20"><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" dir="rtl" className="rounded-2xl p-2 shadow-2xl border-none">
                                                    <DropdownMenuItem className="gap-2 rounded-xl py-3 font-bold"><Pencil className="h-4 w-4 text-primary"/> تعديل</DropdownMenuItem>
                                                    <DropdownMenuSeparator className="bg-slate-100" />
                                                    <DropdownMenuItem className="text-red-600 gap-2 rounded-xl py-3 font-black focus:bg-red-50"><Trash2 className="h-4 w-4"/> حذف نهائي</DropdownMenuItem>
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
        </div>
    );
}
