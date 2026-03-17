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
import type { Account, JournalEntry, Employee } from '@/lib/types';
import { formatCurrency, cn } from '@/lib/utils';
import { defaultChartOfAccounts } from '@/lib/default-coa';
import { InlineSearchList } from '@/components/ui/inline-search-list';


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
                
                setFormData({ type: newType, code: nextCode, name: '', isPayable: true, employeeId: null });
            }
        }
    }, [account, parentAccount, isEditing, isOpen, accounts]);

    // جلب الموظفين عند فتح النموذج لتمكين الربط
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
        const type = parentAccount ? parentAccount.type : getTypeFromCode(code);
        const statement = getStatementType(code);
        const balanceType = getBalanceType(code);
        onSave({ ...formData, level, type, statement, balanceType, parentCode: parentAccount?.code || null });
    };

    const showEmployeeLink = parentAccount?.code === '110102' || account?.parentCode === '110102';

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
                        
                        {showEmployeeLink && (
                            <div className="p-4 bg-primary/5 rounded-xl border-2 border-dashed border-primary/20 space-y-2 animate-in zoom-in-95">
                                <Label className="font-black text-primary flex items-center gap-2">
                                    <User className="h-4 w-4"/> ربط الحساب بموظف (للعهد النقدية)
                                </Label>
                                <InlineSearchList 
                                    value={formData.employeeId || ''}
                                    onSelect={(v) => setFormData(p => ({...p, employeeId: v || null}))}
                                    options={employees.map(e => ({ value: e.id!, label: e.fullName }))}
                                    placeholder={loadingEmployees ? "جاري التحميل..." : "اختر موظفاً لربط العهدة..."}
                                    className="bg-white"
                                />
                                <p className="text-[10px] text-muted-foreground font-bold pr-1">سيتم استخدام هذا الربط لتصفية العهد آلياً عند تقديم تسوية من الموظف.</p>
                            </div>
                        )}

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
    const { firestore } = useFirebase();
    const { toast } = useToast();
    
    // UI and data state
    const [openAccounts, setOpenAccounts] = useState<Set<string>>(new Set(['1', '2', '3', '4', '5']));
    
    const { data: accounts, loading: accountsLoading, error: accountsError } = useSubscription<Account>(firestore, 'chartOfAccounts');
    const { data: journalEntries, loading: entriesLoading, error: entriesError } = useSubscription<JournalEntry>(firestore, 'journalEntries', [where('status', '==', 'posted')]);
    
    const loading = accountsLoading || entriesLoading;

    // Form and Dialog state
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [isSeedAlertOpen, setIsSeedAlertOpen] = useState(false);
    const [confirmSeedText, setConfirmSeedText] = useState('');
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
    const [parentAccount, setParentAccount] = useState<Account | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isSeeding, setIsSeeding] = useState(false);

    const accountBalances = useMemo(() => {
        if (!accounts || !journalEntries) return new Map<string, number>();

        const directBalances = new Map<string, number>();
        journalEntries.forEach(entry => {
            entry.lines.forEach(line => {
                const acc = accounts.find(a => a.id === line.accountId);
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
        [...accounts]
          .sort((a, b) => (b.level || 0) - (a.level || 0)) 
          .forEach(account => {
              let totalBalance = directBalances.get(account.id!) || 0;
              const children = accounts.filter(child => child.parentCode === account.code);
              children.forEach(child => {
                  totalBalance += aggregatedBalances.get(child.id!) || 0;
              });
              aggregatedBalances.set(account.id!, totalBalance);
          });

        return aggregatedBalances;
    }, [accounts, journalEntries]);

    const displayedAccounts = useMemo(() => {
        if (accounts.length === 0) return [];
        
        const childrenMap = new Map<string, Account[]>();
        accounts.forEach(acc => {
            if (acc.parentCode) {
                if (!childrenMap.has(acc.parentCode)) {
                    childrenMap.set(acc.parentCode, []);
                }
                childrenMap.get(acc.parentCode)!.push(acc);
            }
        });
        
        const sortAccounts = (a: Account, b: Account) => (a.code || '').localeCompare(b.code || '', undefined, { numeric: true });
        
        childrenMap.forEach(childList => childList.sort(sortAccounts));
        
        const roots = accounts.filter(acc => acc.level === 0).sort(sortAccounts);

        const result: Account[] = [];
        function addChildren(account: Account) {
            result.push(account);
            if (openAccounts.has(account.code)) {
                const children = childrenMap.get(account.code) || [];
                children.forEach(addChildren);
            }
        }
        
        roots.forEach(addChildren);
        
        return result;
    }, [accounts, openAccounts]);

    const toggleAccount = (code: string) => {
        setOpenAccounts(prev => {
            const newSet = new Set(prev);
            if (newSet.has(code)) newSet.delete(code);
            else newSet.add(code);
            return newSet;
        });
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
            
            const existingAccountsSnap = await getDocs(accountsRef);
            existingAccountsSnap.forEach(doc => {
                batch.delete(doc.ref);
            });

            defaultChartOfAccounts.forEach(account => {
                const docRef = doc(accountsRef);
                batch.set(docRef, account);
            });

            await batch.commit();
            toast({ title: 'نجاح', description: 'تم مسح الشجرة القديمة وتنزيل شجرة الحسابات الأساسية بنجاح.' });
            setConfirmSeedText('');
            setIsSeedAlertOpen(false);
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
                                عرض وإدارة دليل الحسابات الخاص بالشركة وأرصدتها الحالية.
                            </CardDescription>
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
                                            لا توجد حسابات. قم بإضافة حساب رئيسي للبدء.
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
                                                                {isOpen ? <Minus className="h-4 w-4 text-muted-foreground" /> : <Plus className="h-4 w-4 text-muted-foreground" />}
                                                             </button>
                                                        ) : (
                                                            <span className="w-6 h-4 inline-block"></span>
                                                        )}
                                                        <span className="font-medium">{account.name}</span>
                                                        {account.level < 4 && (
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
                                                            <DropdownMenuItem onClick={() => handleEditClick(account)}>
                                                                <Pencil className="ml-2 h-4 w-4" />
                                                                تعديل
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleDeleteClick(account)} className="text-destructive focus:text-destructive">
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
                <AlertDialogContent dir="rtl" className="rounded-3xl">
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
                <AlertDialogContent dir="rtl" className="rounded-3xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد تنزيل شجرة الحسابات؟</AlertDialogTitle>
                        <AlertDialogDescription>
                          <span className="block font-bold text-destructive">تحذير: هذا الإجراء سيقوم بمسح جميع الحسابات الحالية واستبدالها بشجرة حسابات أساسية. لا يمكن التراجع عن هذا الإجراء.</span>
                          <span className="block mt-4">للتأكيد، يرجى كتابة كلمة <span className="font-mono font-bold text-destructive">مسح</span> في المربع أدناه.</span>
                        </AlertDialogDescription>
                         <Input
                            id="confirm-seed-text"
                            value={confirmSeedText}
                            onChange={(e) => setConfirmSeedText(e.target.value)}
                            placeholder="اكتب 'مسح' هنا"
                            className="mt-2"
                        />
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSeeding}>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSeedChartOfAccounts} disabled={isSeeding || confirmSeedText !== 'مسح'} className="bg-destructive hover:bg-destructive/90">
                            {isSeeding ? <><Loader2 className="ml-2 h-4 w-4 animate-spin"/> جاري التنزيل...</> : 'نعم، قم بالمسح والتنزيل'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
