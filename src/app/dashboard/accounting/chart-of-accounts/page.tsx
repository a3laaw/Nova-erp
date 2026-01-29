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
import { DownloadCloud, MoreHorizontal, PlusCircle, Pencil, Trash2, Loader2, Plus, Minus, RefreshCw, FolderOpen, Folder } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { collection, query, writeBatch, getDocs, where, orderBy, doc, addDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import type { Account, JournalEntry } from '@/lib/types';
import { formatCurrency, cn } from '@/lib/utils';
import { hardcodedChartOfAccounts } from '@/lib/chart-of-accounts-data';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';


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
    return 'asset'; // Default
};


const getStatementType = (code: string): Account['statement'] => {
    if (code.startsWith('1') || code.startsWith('2') || code.startsWith('3')) return 'Balance Sheet';
    return 'Income Statement';
};

const getBalanceType = (code: string): Account['balanceType'] => {
    if (code.startsWith('1') || code.startsWith('5')) return 'Debit';
    return 'Credit';
};


function AccountForm({ isOpen, onClose, onSave, account, parentAccount, accounts }: { isOpen: boolean, onClose: () => void, onSave: (data: Partial<Account>) => void, account: Account | null, parentAccount: Account | null, accounts: Account[] }) {
    const isEditing = !!account;
    const [formData, setFormData] = useState<Partial<Account>>({});

    useEffect(() => {
        if (isOpen) {
            if (isEditing && account) {
                setFormData({ code: account.code, name: account.name, type: account.type, isPayable: account.isPayable });
            } else {
                let nextCode = '';
                let newType: Account['type'] = parentAccount ? parentAccount.type : 'asset';
                const level = parentAccount !== null ? (parentAccount.level || 0) + 1 : 0;

                const relevantAccounts = parentAccount
                    ? accounts.filter(acc => acc.parentCode === parentAccount.code)
                    : accounts.filter(acc => acc.level === 0);
                
                if (relevantAccounts.length === 0) {
                     if (parentAccount) {
                         nextCode = parentAccount.code + (level < 3 ? '1' : '01');
                     } else {
                         const maxRootCode = Math.max(0, ...accounts.filter(a => a.level === 0).map(a => parseInt(a.code, 10)));
                         nextCode = String(maxRootCode + 1);
                     }
                } else {
                    const lastCodeNum = Math.max(...relevantAccounts.map(acc => parseInt(acc.code, 10)));
                    nextCode = String(lastCodeNum + 1);
                }
                
                setFormData({ type: newType, code: nextCode, name: '', isPayable: true });
            }
        }
    }, [account, parentAccount, isEditing, isOpen, accounts]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const code = formData.code || '';
        const level = parentAccount !== null ? (parentAccount.level || 0) + 1 : 0;
        const type = parentAccount ? parentAccount.type : getTypeFromCode(code);
        const statement = getStatementType(code);
        const balanceType = getBalanceType(code);
        onSave({ ...formData, level, type, statement, balanceType, parentCode: parentAccount?.code || null });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent dir="rtl">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>
                           {isEditing ? 'تعديل حساب' : parentAccount ? 'إضافة حساب فرعي' : 'إضافة حساب رئيسي'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="code">رمز الحساب</Label>
                            <Input id="code" value={formData.code || ''} onChange={(e) => setFormData(p => ({ ...p, code: e.target.value }))} required dir="ltr" />
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
                           <Label htmlFor="isPayable">حساب قابل للدفع والتحصيل</Label>
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
    
    // UI and data state
    const [openAccounts, setOpenAccounts] = useState<Set<string>>(new Set(['1', '2', '3', '4', '5']));
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [accountBalances, setAccountBalances] = useState<Map<string, number>>(new Map());

    // Seeding state
    const [isSeeding, setIsSeeding] = useState(false);
    const [isSeedAlertOpen, setIsSeedAlertOpen] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);


    // Form and Dialog state
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
    const [parentAccount, setParentAccount] = useState<Account | null>(null);
    const [isSaving, setIsSaving] = useState(false);


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
                    if (!acc) return; 
                    
                    const currentBalance = directBalances.get(line.accountId) || 0;
                    let balanceChange = 0;
                    
                    if (acc.balanceType === 'Debit') {
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
                  const children = fetchedAccounts.filter(child => child.parentCode === account.code);
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

        const getChildren = (code: string): Account[] => (childrenMap.get(code) || []).sort((a, b) => (a.code || '').localeCompare(b.code || ''));
        const roots = accounts.filter(a => a.level === 0).sort((a,b) => (a.code || '').localeCompare(b.code || ''));
        
        const finalDisplayedList: Account[] = [];
        function buildDisplayList(accountCode: string) {
            const account = accountMap.get(accountCode);
            if (!account) return;
            finalDisplayedList.push(account);
            if (openAccounts.has(accountCode)) {
                getChildren(accountCode).forEach(child => buildDisplayList(child.code));
            }
        }

        roots.forEach(root => buildDisplayList(root.code));
        return finalDisplayedList;
    }, [accounts, openAccounts]);

    const toggleAccount = (code: string) => {
        setOpenAccounts(prev => {
            const newSet = new Set(prev);
            if (newSet.has(code)) newSet.delete(code);
            else newSet.add(code);
            return newSet;
        });
    };

    const handleSeedChartOfAccounts = async () => {
        setIsSeedAlertOpen(false);
        if (!firestore) return;
        setIsSeeding(true);
        try {
            const batch = writeBatch(firestore);
            const accountsRef = collection(firestore, 'chartOfAccounts');
            
            const existingAccountsSnap = await getDocs(accountsRef);
            existingAccountsSnap.forEach(doc => {
                batch.delete(doc.ref);
            });

            hardcodedChartOfAccounts.forEach(account => {
                const docRef = doc(accountsRef);
                batch.set(docRef, account);
            });

            await batch.commit();
            toast({ title: 'نجاح', description: 'تم مسح الشجرة القديمة وتثبيت شجرة الحسابات الأساسية بنجاح.' });
            await fetchAllData();
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في تثبيت شجرة الحسابات.' });
        } finally {
            setIsSeeding(false);
        }
    };
    
    const handleSyncClients = async () => {
        if (!firestore) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'لا يمكن الاتصال بقاعدة البيانات.' });
            return;
        }
        setIsSyncing(true);
        toast({ title: 'جاري المزامنة...', description: 'يتم البحث عن عملاء العقود لإضافتهم إلى شجرة الحسابات.' });

        try {
            const batch = writeBatch(firestore);
            let newClientsSynced = 0;

            // 1. Get all contracted clients
            const clientsQuery = query(collection(firestore, 'clients'), where('status', 'in', ['contracted', 'reContracted']));
            const clientsSnap = await getDocs(clientsQuery);
            const contractedClients = clientsSnap.docs.map(doc => doc.data() as { nameAr: string });

            if (contractedClients.length === 0) {
                toast({ title: 'لا يوجد عملاء للمزامنة', description: 'لم يتم العثور على عملاء لديهم عقود حاليًا.' });
                setIsSyncing(false);
                return;
            }

            // 2. Get existing accounts and parent account info
            const accountsQuery = query(collection(firestore, 'chartOfAccounts'));
            const accountsSnap = await getDocs(accountsQuery);
            const existingAccounts = accountsSnap.docs.map(doc => doc.data() as Account);
            const existingAccountNames = new Set(existingAccounts.map(acc => acc.name));

            const parentAccount = existingAccounts.find(acc => acc.code === '1102'); // "العملاء"
            if (!parentAccount) {
                throw new Error("لم يتم العثور على حساب 'العملاء' الرئيسي (رمز 1102). الرجاء تثبيت شجرة الحسابات الأساسية أولاً.");
            }

            // 3. Get the client counter
            const coaClientCounterRef = doc(firestore, 'counters', 'coa_clients');
            const coaClientCounterDoc = await getDoc(coaClientCounterRef);
            let lastClientCodeNumber = coaClientCounterDoc.exists() ? coaClientCounterDoc.data()!.lastNumber || 0 : 0;

            // 4. Iterate and create new accounts if they don't exist
            for (const client of contractedClients) {
                if (!existingAccountNames.has(client.nameAr)) {
                    lastClientCodeNumber++;
                    newClientsSynced++;

                    const newAccountData: Omit<Account, 'id'> = {
                        name: client.nameAr,
                        code: `${parentAccount.code}${String(lastClientCodeNumber).padStart(3, '0')}`,
                        type: 'asset',
                        level: parentAccount.level + 1,
                        parentCode: parentAccount.code,
                        isPayable: true,
                        statement: 'Balance Sheet',
                        balanceType: 'Debit',
                    };
                    
                    const newAccountRef = doc(collection(firestore, 'chartOfAccounts'));
                    batch.set(newAccountRef, newAccountData);
                }
            }

            if (newClientsSynced > 0) {
                // 5. Update the counter if new clients were added
                batch.set(coaClientCounterRef, { lastNumber: lastClientCodeNumber }, { merge: true });
                
                // 6. Commit the batch
                await batch.commit();
                toast({ title: 'نجاح المزامنة', description: `تمت إضافة ${newClientsSynced} عميل جديد إلى شجرة الحسابات.` });
                await fetchAllData(); // Refresh the list
            } else {
                toast({ title: 'لا توجد تغييرات', description: 'جميع عملاء العقود موجودون بالفعل في شجرة الحسابات.' });
            }

        } catch (error) {
            console.error("Error syncing contract clients:", error);
            const errorMessage = error instanceof Error ? error.message : 'فشل في مزامنة العملاء.';
            toast({ variant: 'destructive', title: 'خطأ', description: errorMessage });
        } finally {
            setIsSyncing(false);
        }
    };


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


    return (
        <div className="space-y-6" dir="rtl">
             <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>شجرة الحسابات</CardTitle>
                            <CardDescription>
                                عرض دليل الحسابات الخاص بالشركة. يمكنك تنزيل الشجرة الأساسية للبدء.
                            </CardDescription>
                        </div>
                         <div className="flex gap-2">
                             <Button onClick={handleSyncClients} variant="secondary" disabled={isSyncing}>
                                {isSyncing ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <RefreshCw className="ml-2 h-4 w-4" />}
                                {isSyncing ? 'جاري المزامنة...' : 'مزامنة عملاء العقود'}
                            </Button>
                             <Button onClick={() => setIsSeedAlertOpen(true)} variant="outline" disabled={isSeeding}>
                                {isSeeding ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <DownloadCloud className="ml-2 h-4 w-4" />}
                                {isSeeding ? 'جاري التثبيت...' : 'تثبيت شجرة الحسابات الأساسية'}
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
                                    <TableHead>الرمز</TableHead>
                                    <TableHead>النوع</TableHead>
                                    <TableHead>طبيعة الرصيد</TableHead>
                                    <TableHead>القائمة</TableHead>
                                    <TableHead className="text-left">الرصيد</TableHead>
                                    <TableHead className="text-center"><span className="sr-only">الإجراءات</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    Array.from({length: 5}).map((_, i) => (
                                        <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-6 w-full"/></TableCell></TableRow>
                                    ))
                                ) : displayedAccounts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center h-48 text-muted-foreground">
                                            لا توجد حسابات. قم بتثبيت شجرة الحسابات الأساسية للبدء.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    displayedAccounts.map(account => {
                                        const balance = accountBalances.get(account.id!) || 0;
                                        const hasChildren = accounts.some(a => a.parentCode === account.code);
                                        const isOpen = openAccounts.has(account.code);

                                        return (
                                            <TableRow 
                                                key={account.id} 
                                                className={cn(
                                                    account.level === 0 ? 'bg-muted/50' : '',
                                                    hasChildren && 'cursor-pointer'
                                                )}
                                                onClick={() => hasChildren && toggleAccount(account.code)}
                                            >
                                                <TableCell style={{ paddingRight: `${(account.level || 0) * 1.5 + 1}rem` }}>
                                                    <div className="flex items-center gap-2 group">
                                                        {hasChildren ? (
                                                             <button onClick={(e) => { e.stopPropagation(); toggleAccount(account.code); }} className="p-1 -mr-1">
                                                                {isOpen ? <Minus className="h-4 w-4 text-primary" /> : <Plus className="h-4 w-4 text-muted-foreground" />}
                                                             </button>
                                                        ) : (
                                                            <span className="w-6 h-4 inline-block"></span>
                                                        )}
                                                        <span className="font-medium">{account.name}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-mono">{account.code}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={cn(accountTypeColors[account.type], "whitespace-nowrap")}>
                                                        {accountTypeTranslations[account.type]}
                                                    </Badge>
                                                </TableCell>
                                                 <TableCell>
                                                    <Badge variant="secondary">{account.balanceType === 'Debit' ? 'مدين' : 'دائن'}</Badge>
                                                 </TableCell>
                                                <TableCell className="text-xs">{account.statement === 'Balance Sheet' ? 'مركز مالي' : 'قائمة دخل'}</TableCell>
                                                <TableCell className={cn("text-left font-mono", balance < 0 && "text-destructive")}>
                                                    {formatCurrency(balance)}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                                                                <MoreHorizontal className="h-4 w-4"/>
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent dir="rtl" onClick={(e) => e.stopPropagation()}>
                                                            <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                                            {account.level < 4 && (
                                                                <DropdownMenuItem onClick={() => handleAddSubAccountClick(account)}>
                                                                    <PlusCircle className="ml-2 h-4 w-4 text-primary" />
                                                                    إضافة حساب فرعي
                                                                </DropdownMenuItem>
                                                            )}
                                                            <DropdownMenuItem onClick={() => handleEditClick(account)}>
                                                                <Pencil className="ml-2 h-4 w-4" />
                                                                تعديل
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeleteClick(account)}>
                                                                <Trash2 className="ml-2 h-4 w-4" />
                                                                حذف
                                                            </DropdownMenuItem>
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
            
            <AlertDialog open={isSeedAlertOpen} onOpenChange={setIsSeedAlertOpen}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد تثبيت شجرة الحسابات؟</AlertDialogTitle>
                        <AlertDialogDescription>
                           **تحذير خطير:** سيقوم هذا الإجراء **بمسح جميع الحسابات الحالية** في قاعدة البيانات واستبدالها بشجرة حسابات أساسية. هذا الإجراء لا يمكن التراجع عنه. هل تريد المتابعة؟
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSeeding}>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSeedChartOfAccounts} disabled={isSeeding} className="bg-destructive hover:bg-destructive/90">
                            {isSeeding ? <><Loader2 className="ml-2 h-4 w-4 animate-spin"/> جاري التثبيت...</> : 'نعم، قم بالمسح والتثبيت'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {isFormOpen && (
                <AccountForm 
                    isOpen={isFormOpen} 
                    onClose={() => setIsFormOpen(false)} 
                    onSave={handleSave} 
                    account={editingAccount} 
                    parentAccount={parentAccount}
                    accounts={accounts}
                />
            )}
            
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
