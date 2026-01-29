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
import { PlusCircle, MoreHorizontal, Pencil, Trash2, Loader2, DownloadCloud, Folder, FolderOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { collection, query, addDoc, doc, updateDoc, deleteDoc, writeBatch, getDocs, where, orderBy } from 'firebase/firestore';
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
import { defaultChartOfAccounts } from '@/lib/default-coa';


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
    const isEditing = !!account;
    const [formData, setFormData] = useState<Partial<Account>>({});

    useEffect(() => {
        if (isEditing && account) {
            setFormData({ code: account.code, name: account.name, type: account.type, isPayable: account.isPayable });
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
            
            setFormData({ type: newType, code: nextCode, name: '', isPayable: true });
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
        onSave({ ...formData, level, parentCode: parentAccount?.code || null });
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
                         <div className="flex items-center space-x-2">
                           <input type="checkbox" id="isPayable" checked={!!formData.isPayable} onChange={(e) => setFormData(p => ({...p, isPayable: e.target.checked}))} className="h-4 w-4" />
                           <Label htmlFor="isPayable">حساب قابل للتحصيل والدفع</Label>
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
    const [isSeedAlertOpen, setIsSeedAlertOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
    const [parentAccount, setParentAccount] = useState<Account | null>(null);
    const [openAccounts, setOpenAccounts] = useState<Set<string>>(new Set());

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
            setAccounts(fetchedAccounts);

            const journalEntries = entriesSnapshot.docs.map(doc => doc.data() as JournalEntry);
            
            const directBalances = new Map<string, number>();
            journalEntries.forEach(entry => {
                entry.lines.forEach(line => {
                    const acc = fetchedAccounts.find(a => a.id === line.accountId);
                    if (!acc || !acc.isPayable) return; 
                    
                    const currentBalance = directBalances.get(line.accountId) || 0;
                    let balanceChange = 0;
                    
                    if (acc.type === 'asset' || acc.type === 'expense') {
                        balanceChange = (line.debit || 0) - (line.credit || 0);
                    } else {
                        balanceChange = (line.credit || 0) - (line.debit || 0);
                    }
                    directBalances.set(line.accountId, currentBalance + balanceChange);
                });
            });

            const aggregatedBalances = new Map<string, number>();
            fetchedAccounts
              .sort((a, b) => (b.level || 0) - (a.level || 0)) 
              .forEach(account => {
                  let totalBalance = directBalances.get(account.id!) || 0;
                  
                  const children = fetchedAccounts.filter(child => 
                      child.parentCode === account.code
                  );
                  
                  children.forEach(child => {
                      totalBalance += aggregatedBalances.get(child.id!) || 0;
                  });
                  
                  aggregatedBalances.set(account.id!, totalBalance);
              });

            setAccountBalances(aggregatedBalances);

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

    const displayedAccounts = useMemo(() => {
        if (accounts.length === 0) return [];
        
        const accountMap = new Map(accounts.map(acc => [acc.code, acc]));
        const childrenMap = new Map<string, Account[]>();
        
        accounts.forEach(acc => {
            if (acc.parentCode) {
                if (!childrenMap.has(acc.parentCode)) {
                    childrenMap.set(acc.parentCode, []);
                }
                childrenMap.get(acc.parentCode)!.push(acc);
            }
        });

        const getChildren = (code: string): Account[] => {
            return (childrenMap.get(code) || []).sort((a, b) => a.code.localeCompare(b.code));
        };
        
        const roots = accounts.filter(a => a.level === 0).sort((a,b) => a.code.localeCompare(b.code));
        
        const finalDisplayedList: Account[] = [];
        
        function buildDisplayList(accountCode: string) {
            const account = accountMap.get(accountCode);
            if (!account) return;

            finalDisplayedList.push(account);

            if (openAccounts.has(accountCode)) {
                const children = getChildren(accountCode);
                children.forEach(child => buildDisplayList(child.code));
            }
        }

        roots.forEach(root => buildDisplayList(root.code));
        return finalDisplayedList;
    }, [accounts, openAccounts]);


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
        const parent = accounts.find(a => a.code === account.parentCode) || null;
        setParentAccount(parent);
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
        setIsSeedAlertOpen(false);
        setIsSeeding(true);
        try {
            const batch = writeBatch(firestore);
            const accountsRef = collection(firestore, 'chartOfAccounts');
            
            // 1. Delete all existing accounts
            const existingAccountsSnap = await getDocs(accountsRef);
            existingAccountsSnap.forEach(doc => {
                batch.delete(doc.ref);
            });

            // 2. Add the new default accounts
            defaultChartOfAccounts.forEach(account => {
                const docRef = doc(accountsRef); // Create a new doc reference for each
                batch.set(docRef, account);
            });

            await batch.commit();
            toast({ title: 'نجاح', description: 'تم مسح الشجرة القديمة وتنزيل شجرة الحسابات الأساسية بنجاح.' });
            await fetchAllData();
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تنزيل شجرة الحسابات.' });
        } finally {
            setIsSeeding(false);
        }
    };

    const toggleAccount = (code: string) => {
        setOpenAccounts(prev => {
            const newSet = new Set(prev);
            if (newSet.has(code)) {
                newSet.delete(code);
            } else {
                newSet.add(code);
            }
            return newSet;
        });
    };

    return (
        <div className="space-y-6" dir="rtl">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>شجرة الحسابات</CardTitle>
                            <CardDescription>عرض وإدارة دليل الحسابات الخاص بالشركة وأرصدتها الحالية.</CardDescription>
                        </div>
                        <div className="flex gap-2">
                             <Button onClick={() => setIsSeedAlertOpen(true)} variant="outline" disabled={isSeeding}>
                                {isSeeding ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <DownloadCloud className="ml-2 h-4 w-4" />}
                                {isSeeding ? 'جاري التنزيل...' : 'تنزيل شجرة حسابات أساسية'}
                            </Button>
                            <Button onClick={handleAddClick}><PlusCircle className="ml-2 h-4 w-4" /> إضافة حساب رئيسي</Button>
                        </div>
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
                                ) : displayedAccounts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center h-48">
                                            <div className="flex flex-col items-center justify-center gap-4">
                                                <p className="text-muted-foreground">لا توجد حسابات. ابدأ بإضافة حساب رئيسي، أو قم بتنزيل شجرة الحسابات الأساسية من الزر في الأعلى.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    displayedAccounts.map(account => {
                                        const balance = accountBalances.get(account.id!) || 0;
                                        const hasChildren = accounts.some(a => a.parentCode === account.code);
                                        const isOpen = openAccounts.has(account.code);

                                        return (
                                            <TableRow key={account.id} className={account.level === 0 ? 'bg-muted/50' : ''}>
                                                <TableCell style={{ paddingRight: `${(account.level || 0) * 1.5 + 1}rem` }}>
                                                    <div className="flex items-center gap-2 group">
                                                        {hasChildren ? (
                                                            <button onClick={() => toggleAccount(account.code)} className="p-1 -mr-1">
                                                               {isOpen ? <FolderOpen className="h-4 w-4 text-primary" /> : <Folder className="h-4 w-4 text-muted-foreground" />}
                                                            </button>
                                                        ) : (
                                                            <span className="w-6 h-4 inline-block"></span>
                                                        )}
                                                        <span className="font-medium">{account.name}</span>
                                                        {account.level < 3 && (
                                                            <Button
                                                                type="button" variant="ghost" size="icon"
                                                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                onClick={(e) => { e.stopPropagation(); handleAddSubAccountClick(account); }}>
                                                                <PlusCircle className="h-4 w-4 text-primary" />
                                                            </Button>
                                                        )}
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
                                                        <DropdownMenuContent dir="rtl" onClick={(e) => e.stopPropagation()}>
                                                            <DropdownMenuItem onClick={() => handleEditClick(account)}><Pencil className="ml-2 h-4 w-4" /> تعديل</DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleDeleteClick(account)} className="text-destructive focus:text-destructive"><Trash2 className="ml-2 h-4 w-4" /> حذف</DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
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
            
            <AlertDialog open={isSeedAlertOpen} onOpenChange={setIsSeedAlertOpen}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد تنزيل شجرة الحسابات؟</AlertDialogTitle>
                        <AlertDialogDescription>
                            سيقوم هذا الإجراء **بمسح جميع الحسابات الحالية** وإضافة شجرة حسابات أساسية تحتوي على أكثر من 80 حسابًا. يوصى بهذا الإجراء إذا كانت شجرة حساباتك فارغة أو إذا كنت تريد البدء من جديد. هل تريد المتابعة؟
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSeeding}>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSeedChartOfAccounts} disabled={isSeeding} className="bg-destructive hover:bg-destructive/90">
                            {isSeeding ? <><Loader2 className="ml-2 h-4 w-4 animate-spin"/> جاري التنزيل...</> : 'نعم، قم بالمسح والتنزيل'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
