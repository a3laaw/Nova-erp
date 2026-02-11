'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DateInput } from '@/components/ui/date-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Upload, AlertCircle, Check, Link2, Sparkles, Wand2 } from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import type { Account, JournalEntry } from '@/lib/types';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { startOfMonth, endOfMonth, parse, isValid, format } from 'date-fns';
import { toFirestoreDate } from '@/services/date-converter';
import { formatCurrency } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { reconcileBankStatementFlow, type ReconciliationOutput } from '@/ai/flows/reconcile-bank-statement';
import { Separator } from '@/components/ui/separator';
import { collection, getDocs, query, where } from 'firebase/firestore';


interface BankTransaction {
  id: string;
  date: Date;
  description: string;
  amount: number;
}

interface SystemTransaction {
  id: string;
  date: Date;
  description: string;
  amount: number;
  entryNumber: string;
}

export default function BankReconciliationPage() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    
    // Filters
    const [bankAccountId, setBankAccountId] = useState('');
    const [dateFrom, setDateFrom] = useState<Date | undefined>(() => startOfMonth(new Date()));
    const [dateTo, setDateTo] = useState<Date | undefined>(() => endOfMonth(new Date()));

    const { data: accounts, loading: accountsLoading } = useSubscription<Account>(firestore, 'chartOfAccounts');
    
    // Data states
    const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
    const [systemTransactions, setSystemTransactions] = useState<SystemTransaction[]>([]);
    
    // Processing states
    const [isFileLoading, setIsFileLoading] = useState(false);
    const [isReconciling, setIsReconciling] = useState(false);

    // Result and selection states
    const [reconciliationResult, setReconciliationResult] = useState<ReconciliationOutput | null>(null);
    const [selectedBankTx, setSelectedBankTx] = useState<string | null>(null);
    const [selectedSystemTx, setSelectedSystemTx] = useState<string | null>(null);

    const bankAccountOptions = useMemo(() => 
        accounts
            .filter(a => a.code.startsWith('110103')) // Filter for bank accounts
            .map(a => ({ value: a.id!, label: `${a.name} (${a.code})`}))
    , [accounts]);

    const fetchSystemTransactions = useCallback(async () => {
        if (!bankAccountId || !dateFrom || !dateTo || !firestore) {
            setSystemTransactions([]);
            return;
        }

        const startDate = dateFrom;
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);

        const entriesQuery = query(
            collection(firestore, 'journalEntries'),
            where('status', '==', 'posted'),
            // where('reconciliationStatus', '!=', 'reconciled'), // We will handle this client side for now
            where('date', '>=', startDate),
            where('date', '<=', endDate)
        );

        const entriesSnap = await getDocs(entriesQuery);
        const relevantTransactions = entriesSnap.docs.flatMap(doc => {
            const entry = doc.data() as JournalEntry;
            return entry.lines
                .filter(line => line.accountId === bankAccountId)
                .map(line => ({
                    id: `${doc.id}|${line.debit > 0 ? 'd' : 'c'}`,
                    date: toFirestoreDate(entry.date)!,
                    description: entry.narration,
                    amount: (line.debit || 0) - (line.credit || 0),
                    entryNumber: entry.entryNumber,
                }));
        });
        setSystemTransactions(relevantTransactions);
    }, [bankAccountId, dateFrom, dateTo, firestore]);

    useEffect(() => {
        fetchSystemTransactions();
    }, [fetchSystemTransactions]);


    const handleFileProcess = async (file: File) => {
        if (!bankAccountId) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء اختيار حساب بنكي أولاً.'});
            return;
        }
        setIsFileLoading(true);
        setBankTransactions([]);
        setReconciliationResult(null);
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                let headerRowIndex = -1, dateIndex = -1, descIndex = -1, debitIndex = -1, creditIndex = -1;
                
                for(let i=0; i<Math.min(json.length, 10); i++) {
                    const row = json[i].map((cell: any) => String(cell).toLowerCase());
                    dateIndex = row.findIndex((cell: string) => cell.includes('date') || cell.includes('تاريخ'));
                    descIndex = row.findIndex((cell: string) => cell.includes('description') || cell.includes('وصف') || cell.includes('بيان'));
                    debitIndex = row.findIndex((cell: string) => cell.includes('debit') || cell.includes('مدين'));
                    creditIndex = row.findIndex((cell: string) => cell.includes('credit') || cell.includes('دائن'));

                    if (dateIndex > -1 && descIndex > -1 && (debitIndex > -1 || creditIndex > -1)) {
                        headerRowIndex = i;
                        break;
                    }
                }
                
                if (headerRowIndex === -1) throw new Error("لم يتم العثور على الأعمدة المطلوبة (Date, Description, Debit/Credit) في الملف.");

                const transactions: BankTransaction[] = json.slice(headerRowIndex + 1).map((row, index) => {
                    const dateVal = row[dateIndex];
                    let date;
                    if (typeof dateVal === 'number') {
                        date = XLSX.SSF.parse_date_code(dateVal);
                        date = new Date(date.y, date.m - 1, date.d, date.H, date.M, date.S);
                    } else if (typeof dateVal === 'string') {
                        date = parse(dateVal, 'dd/MM/yyyy', new Date());
                        if(!isValid(date)) date = new Date(dateVal);
                    }
                    if (!date || !isValid(date)) return null;

                    const debit = parseFloat(String(row[debitIndex] || '0').replace(/,/g, ''));
                    const credit = parseFloat(String(row[creditIndex] || '0').replace(/,/g, ''));
                    const amount = credit - debit;

                    return { id: `bank-${index}`, date, description: row[descIndex] || '', amount };
                }).filter((item): item is BankTransaction => item !== null && item.amount !== 0);
                
                setBankTransactions(transactions);
            } catch (error) {
                const message = error instanceof Error ? error.message : 'فشل في قراءة الملف.';
                toast({ variant: 'destructive', title: 'خطأ', description: message });
            } finally {
                setIsFileLoading(false);
            }
        };
        reader.readAsBinaryString(file!);
    };
    
    const handleAiReconciliation = async () => {
        if (bankTransactions.length === 0 || systemTransactions.length === 0) {
            toast({ title: 'بيانات غير كافية', description: 'يجب رفع ملف البنك ووجود حركات في النظام أولاً.'});
            return;
        }
        setIsReconciling(true);
        setReconciliationResult(null);
        try {
            const result = await reconcileBankStatementFlow({
                bankTransactions: bankTransactions.map(tx => ({...tx, date: tx.date.toISOString()})),
                systemTransactions: systemTransactions.map(tx => ({...tx, date: tx.date.toISOString(), amount: -tx.amount, description: tx.description || tx.entryNumber})),
            });
            setReconciliationResult(result);
             toast({ title: 'نجاح', description: `تمت مطابقة ${result.matchedPairs.length} حركة بنجاح.` });
        } catch(e) {
             const message = e instanceof Error ? e.message : 'فشل في عملية المطابقة الذكية.';
             toast({ variant: 'destructive', title: 'خطأ', description: message });
        } finally {
            setIsReconciling(false);
        }
    };
    
    const { unmatchedBank, unmatchedSystem, matchedPairs } = useMemo(() => {
        if (!reconciliationResult) {
            return { unmatchedBank: bankTransactions, unmatchedSystem: systemTransactions, matchedPairs: [] };
        }
        const matchedBankIds = new Set(reconciliationResult.matchedPairs.map(p => p.bankTransactionId));
        const matchedSystemIds = new Set(reconciliationResult.matchedPairs.map(p => p.systemTransactionId));
        
        return {
            unmatchedBank: bankTransactions.filter(tx => !matchedBankIds.has(tx.id)),
            unmatchedSystem: systemTransactions.filter(tx => !matchedSystemIds.has(tx.id)),
            matchedPairs: reconciliationResult.matchedPairs.map(pair => ({
                bankTx: bankTransactions.find(btx => btx.id === pair.bankTransactionId)!,
                systemTx: systemTransactions.find(stx => stx.id === pair.systemTransactionId)!,
                confidence: pair.confidence,
            })).filter(p => p.bankTx && p.systemTx),
        };
    }, [bankTransactions, systemTransactions, reconciliationResult]);

    return (
        <Card dir="rtl">
            <CardHeader>
                <CardTitle>التسوية البنكية</CardTitle>
                <CardDescription>
                    قم بمطابقة الحركات في كشف حساب البنك مع القيود المسجلة في النظام.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex flex-col md:flex-row gap-4 p-4 border rounded-lg bg-muted/50">
                    <div className="grid gap-2 flex-1">
                        <Label>الحساب البنكي</Label>
                        <Select value={bankAccountId} onValueChange={setBankAccountId} disabled={accountsLoading}>
                            <SelectTrigger><SelectValue placeholder="اختر حسابًا..." /></SelectTrigger>
                            <SelectContent>{bankAccountOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                     <div className="grid gap-2 flex-1">
                        <Label>من تاريخ</Label>
                        <DateInput value={dateFrom} onChange={setDateFrom} />
                    </div>
                    <div className="grid gap-2 flex-1">
                        <Label>إلى تاريخ</Label>
                        <DateInput value={dateTo} onChange={setDateTo} />
                    </div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                    <Card>
                        <CardHeader>
                            <CardTitle>1. رفع كشف حساب البنك</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Input type="file" onChange={(e) => e.target.files && handleFileProcess(e.target.files[0])} accept=".xlsx, .xls, .csv" disabled={!bankAccountId || isFileLoading} />
                            {isFileLoading && <p className="text-sm mt-2 flex items-center gap-2"><Loader2 className="animate-spin" /> جاري معالجة الملف...</p>}
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader>
                            <CardTitle>2. المطابقة الذكية</CardTitle>
                        </CardHeader>
                        <CardContent>
                           <Button onClick={handleAiReconciliation} disabled={isReconciling || bankTransactions.length === 0 || systemTransactions.length === 0} className="w-full">
                               {isReconciling ? <Loader2 className="animate-spin ml-2" /> : <Sparkles className="ml-2"/>}
                               مطابقة تلقائية بالذكاء الاصطناعي
                           </Button>
                           {reconciliationResult?.explanation && (
                               <p className="text-xs text-muted-foreground mt-2">{reconciliationResult.explanation}</p>
                           )}
                        </CardContent>
                    </Card>
                </div>
                
                <Separator />
                <h3 className="text-lg font-semibold text-center">نتائج التسوية</h3>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader><CardTitle>حركات البنك (غير مسواة)</CardTitle></CardHeader>
                        <CardContent className="h-72 overflow-y-auto">
                            <Table>
                                {unmatchedBank.map(tx => (
                                    <TableRow key={tx.id}>
                                        <TableCell><Checkbox checked={selectedBankTx === tx.id} onCheckedChange={() => setSelectedBankTx(tx.id)}/></TableCell>
                                        <TableCell>{format(tx.date, 'dd/MM')}<br/><span className="text-xs text-muted-foreground">{tx.description}</span></TableCell>
                                        <TableCell className="text-left font-mono">{formatCurrency(tx.amount)}</TableCell>
                                    </TableRow>
                                ))}
                            </Table>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader><CardTitle>حركات النظام (غير مسواة)</CardTitle></CardHeader>
                        <CardContent className="h-72 overflow-y-auto">
                             <Table>
                                {unmatchedSystem.map(tx => (
                                    <TableRow key={tx.id}>
                                        <TableCell><Checkbox checked={selectedSystemTx === tx.id} onCheckedChange={() => setSelectedSystemTx(tx.id)}/></TableCell>
                                        <TableCell>{format(tx.date, 'dd/MM')}<br/><span className="text-xs text-muted-foreground">{tx.description}</span></TableCell>
                                        <TableCell className="text-left font-mono">{formatCurrency(tx.amount)}</TableCell>
                                    </TableRow>
                                ))}
                            </Table>
                        </CardContent>
                    </Card>
                </div>
                 <div className="text-center">
                    <Button disabled={!selectedBankTx || !selectedSystemTx}><Link2 className="ml-2"/> مطابقة يدوية</Button>
                 </div>
                
                 <Card>
                    <CardHeader><CardTitle>الحركات التي تمت مطابقتها</CardTitle></CardHeader>
                    <CardContent className="h-72 overflow-y-auto">
                         <Table>
                            {matchedPairs.map(p => (
                                <TableRow key={p.bankTx.id}>
                                    <TableCell>{format(p.bankTx.date, 'dd/MM')}<br/><span className="text-xs text-muted-foreground">{p.bankTx.description}</span></TableCell>
                                    <TableCell className="text-left font-mono">{formatCurrency(p.bankTx.amount)}</TableCell>
                                    <TableCell className="text-center"><Link2 className="text-green-500"/></TableCell>
                                    <TableCell>{p.systemTx.entryNumber}<br/><span className="text-xs text-muted-foreground">{p.systemTx.description}</span></TableCell>
                                    <TableCell className="text-left font-mono">{formatCurrency(p.systemTx.amount)}</TableCell>
                                </TableRow>
                            ))}
                        </Table>
                    </CardContent>
                </Card>
            </CardContent>
        </Card>
    );
}
