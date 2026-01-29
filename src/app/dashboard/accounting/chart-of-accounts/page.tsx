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
import { PlusCircle, MoreHorizontal, Pencil, Trash2, Loader2, DownloadCloud, Folder, FolderOpen, Upload, File as FileIcon, Save } from 'lucide-react';
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
import type { Account, JournalEntry } from '@/lib/types';
import { formatCurrency, cn } from '@/lib/utils';


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

// --- Excel Upload & Processing ---

const mapArabicTypeToEnglish = (type: string): Account['type'] => {
    const lowerType = type?.toLowerCase() || '';
    if (lowerType.includes('أصول')) return 'asset';
    if (lowerType.includes('التزامات') || lowerType.includes('خصوم')) return 'liability';
    if (lowerType.includes('حقوق ملكية')) return 'equity';
    if (lowerType.includes('إيرادات')) return 'income';
    if (lowerType.includes('مصروف') || lowerType.includes('تكاليف')) return 'expense';
    return 'asset'; // Fallback
};

const getStatementType = (code: string): Account['statement'] => {
    if (code.startsWith('1') || code.startsWith('2') || code.startsWith('3')) return 'Balance Sheet';
    return 'Income Statement';
};

const getBalanceType = (code: string): Account['balanceType'] => {
    if (code.startsWith('1') || code.startsWith('5')) return 'Debit';
    return 'Credit';
};


export default function ChartOfAccountsPage() {
    const router = useRouter();
    const { firestore } = useFirebase();
    const { toast } = useToast();
    
    // UI and data state
    const [openAccounts, setOpenAccounts] = useState<Set<string>>(new Set());
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [accountBalances, setAccountBalances] = useState<Map<string, number>>(new Map());

    // Excel processing state
    const [file, setFile] = useState<File | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [parsedData, setParsedData] = useState<Omit<Account, 'id'>[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isSaveConfirmOpen, setIsSaveConfirmOpen] = useState(false);

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

    const handleDownloadTemplate = async () => {
        const XLSX = await import('xlsx');
        const sampleData = [{
            'الرمز': '1', 'اسم الحساب': 'الأصول', 'النوع': 'أصول', 'يمكن الدفع والتحصيل': 'لا', 'الوصف': 'جميع ممتلكات الشركة ذات القيمة الاقتصادية.'
        }, {
            'الرمز': '11', 'اسم الحساب': 'أصول متداولة', 'النوع': 'أصول', 'يمكن الدفع والتحصيل': 'لا', 'الوصف': 'الأصول التي يمكن تحويلها إلى نقد خلال عام.'
        }, {
             'الرمز': '110101', 'اسم الحساب': 'النقدية في الخزينة', 'النوع': 'أصول', 'يمكن الدفع والتحصيل': 'نعم', 'الوصف': 'النقدية الفعلية في خزينة الشركة.'
        }];
        const ws = XLSX.utils.json_to_sheet(sampleData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'ChartOfAccounts');
        XLSX.writeFile(wb, 'COA_Template.xlsx');
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            handleParseFile(selectedFile);
        }
    };

    const handleParseFile = (fileToParse: File) => {
        setIsParsing(true);
        setParsedData([]);
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const XLSX = await import('xlsx');
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: any[] = XLSX.utils.sheet_to_json(worksheet);

                const newAccounts = json.map((row: any) => {
                    const code = String(row['الرمز'] || '');
                    let parentCode: string | null = null;
                    if (code.length > 1) {
                        if (code.length <= 2) parentCode = code.slice(0, 1);
                        else if (code.length <= 4) parentCode = code.slice(0, 2);
                        else if (code.length <= 6) parentCode = code.slice(0, 4);
                    }
                    let level = 0;
                    if (code.length === 2) level = 1;
                    else if (code.length > 2 && code.length <= 4) level = 2;
                    else if (code.length > 4) level = 3;
                    
                    const account: Omit<Account, 'id'> = {
                        code: code,
                        name: row['اسم الحساب'] || 'اسم غير صالح',
                        type: mapArabicTypeToEnglish(row['النوع']),
                        isPayable: (row['يمكن الدفع والتحصيل'] || '').toString().trim().toLowerCase() === 'نعم',
                        description: row['الوصف'] || '',
                        parentCode: parentCode,
                        level: level,
                        statement: getStatementType(code),
                        balanceType: getBalanceType(code),
                    };
                    return account;
                }).filter(acc => acc.code && acc.name !== 'اسم غير صالح');

                setParsedData(newAccounts);
                toast({ title: 'نجاح', description: `تمت قراءة ${newAccounts.length} حساب بنجاح. راجع البيانات قبل الحفظ.` });
            } catch (error) {
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل قراءة الملف. تأكد من أن الأعمدة صحيحة.' });
            } finally {
                setIsParsing(false);
            }
        };
        reader.readAsBinaryString(fileToParse);
    };

    const handleSaveToFirestore = async () => {
        setIsSaveConfirmOpen(false);
        if (!firestore || parsedData.length === 0) return;
        setIsSaving(true);
        try {
            const batch = writeBatch(firestore);
            const accountsRef = collection(firestore, 'chartOfAccounts');
            const existingAccountsSnap = await getDocs(accountsRef);
            existingAccountsSnap.forEach(doc => batch.delete(doc.ref));

            parsedData.forEach(accountData => {
                const docRef = doc(accountsRef);
                batch.set(docRef, accountData);
            });

            await batch.commit();
            toast({ title: 'نجاح', description: `تم مسح الشجرة القديمة وحفظ ${parsedData.length} حسابًا جديدًا.` });
            await fetchAllData();
            setParsedData([]);
            setFile(null);
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ شجرة الحسابات الجديدة.' });
        } finally {
            setIsSaving(false);
        }
    };


    return (
        <div className="space-y-6" dir="rtl">
             <Card>
                <CardHeader>
                    <CardTitle>تحميل شجرة الحسابات من ملف Excel</CardTitle>
                    <CardDescription>
                        استخدم هذه الأداة لمسح شجرة الحسابات الحالية واستبدالها بالكامل ببيانات من ملف Excel.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="flex gap-4 items-center">
                        <Button onClick={handleDownloadTemplate} variant="outline" className="flex-shrink-0">
                            <DownloadCloud className="ml-2 h-4 w-4" />
                            تحميل النموذج
                        </Button>
                        <div className="relative flex-grow">
                             <Input id="file-upload" type="file" onChange={handleFileChange} accept=".xlsx, .xls" disabled={isParsing || isSaving} className="hidden" />
                             <Label htmlFor="file-upload" className={cn("border-2 border-dashed rounded-lg p-4 text-center block cursor-pointer hover:bg-muted/50", file && "border-primary")}>
                                <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                                <p className="mt-2 text-sm font-medium">{file ? `الملف المحدد: ${file.name}` : 'انقر هنا لاختيار ملف'}</p>
                                <p className="text-xs text-muted-foreground">يجب أن يكون الملف بصيغة .xlsx أو .xls</p>
                             </Label>
                        </div>
                     </div>
                     {parsedData.length > 0 && (
                        <div className='space-y-4'>
                            <h3 className="font-semibold">معاينة البيانات (أول 5 صفوف)</h3>
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader><TableRow><TableHead>الرمز</TableHead><TableHead>اسم الحساب</TableHead><TableHead>النوع</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {parsedData.slice(0, 5).map((row, i) => (
                                            <TableRow key={i}><TableCell>{row.code}</TableCell><TableCell>{row.name}</TableCell><TableCell>{row.type}</TableCell></TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className='flex justify-end'>
                                <Button onClick={() => setIsSaveConfirmOpen(true)} disabled={isSaving}>
                                    <Save className="ml-2 h-4 w-4" />
                                    حفظ الشجرة الجديدة ({parsedData.length} حساب)
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>عرض شجرة الحسابات الحالية</CardTitle>
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
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    Array.from({length: 5}).map((_, i) => (
                                        <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-6 w-full"/></TableCell></TableRow>
                                    ))
                                ) : displayedAccounts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center h-48 text-muted-foreground">
                                            لا توجد حسابات. قم برفع ملف Excel لإنشاء الشجرة.
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
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
            
            <AlertDialog open={isSaveConfirmOpen} onOpenChange={setIsSaveConfirmOpen}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد استبدال شجرة الحسابات؟</AlertDialogTitle>
                        <AlertDialogDescription>
                           **تحذير خطير:** سيقوم هذا الإجراء **بمسح جميع الحسابات الحالية** في قاعدة البيانات واستبدالها بالبيانات من ملف Excel. هذا الإجراء لا يمكن التراجع عنه. هل تريد المتابعة؟
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSaving}>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSaveToFirestore} disabled={isSaving} className="bg-destructive hover:bg-destructive/90">
                            {isSaving ? <><Loader2 className="ml-2 h-4 w-4 animate-spin"/> جاري الحفظ...</> : 'نعم، قم بالمسح والحفظ'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
