'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
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
import { Loader2, Upload, AlertCircle, Link2, GitMerge } from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import type { Account, JournalEntry } from '@/lib/types';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { startOfMonth, endOfMonth, parse, isValid, format } from 'date-fns';
import { toFirestoreDate } from '@/services/date-converter';
import { formatCurrency, cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import { GroupedReconciliationDialog } from '@/components/accounting/grouped-reconciliation-dialog';

interface BankTransaction {
  id: string;
  date: Date;
  description: string;
  amount: number;
}

interface SystemTransactionView {
  id: string; // This will be the JournalEntry ID
  date: Date;
  description: string;
  amount: number;
  entryNumber: string;
}

export function IntermediaryReconciliationView() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    
    // Filters
    const [bankAccountId, setBankAccountId] = useState('');
    const [dateFrom, setDateFrom] = useState<Date | undefined>(() => startOfMonth(new Date()));
    const [dateTo, setDateTo] = useState<Date | undefined>(() => endOfMonth(new Date()));

    const { data: accounts, loading: accountsLoading } = useSubscription<Account>(firestore, 'chartOfAccounts');
    
    // Data states
    const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
    const [systemJournalEntries, setSystemJournalEntries] = useState<JournalEntry[]>([]);
    
    // Processing states
    const [isFileLoading, setIsFileLoading] = useState(false);
    
    // Selection states
    const [selectedBankTx, setSelectedBankTx] = useState<string | null>(null);
    const [selectedSystemTxs, setSelectedSystemTxs] = useState<string[]>([]);
    const [isGroupMatchOpen, setIsGroupMatchOpen] = useState(false);


    const bankAccountOptions = useMemo(() => 
        accounts
            .filter(a => a.code.startsWith('110103')) // Filter for bank accounts
            .map(a => ({ value: a.id!, label: `${a.name} (${a.code})`}))
    , [accounts]);

    const fetchSystemTransactions = useCallback(async () => {
        if (!bankAccountId || !dateFrom || !dateTo || !firestore) {
            setSystemJournalEntries([]);
            return;
        }

        const startDate = dateFrom;
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);

        const entriesQuery = query(
            collection(firestore, 'journalEntries'),
            where('status', '==', 'posted'),
            where('reconciliationStatus', '!=', 'reconciled'),
            where('date', '>=', startDate),
            where('date', '<=', endDate)
        );

        const entriesSnap = await getDocs(entriesQuery);
        const relevantTransactions = entriesSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as JournalEntry))
            .filter(entry => entry.lines.some(line => line.accountId === bankAccountId));
        setSystemJournalEntries(relevantTransactions);
    }, [bankAccountId, dateFrom, dateTo, firestore]);

    useEffect(() => {
        fetchSystemTransactions();
    }, [fetchSystemTransactions]);
    
    const systemTransactionsForDisplay = useMemo((): SystemTransactionView[] => {
      return systemJournalEntries.map(entry => {
        const line = entry.lines.find(l => l.accountId === bankAccountId)!;
        return {
            id: entry.id!,
            date: toFirestoreDate(entry.date)!,
            description: entry.narration,
            amount: (line.credit || 0) - (line.debit || 0), // Opposite for reconciliation
            entryNumber: entry.entryNumber,
        };
      });
    }, [systemJournalEntries, bankAccountId]);


    const handleFileProcess = async (file: File) => {
        if (!bankAccountId) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء اختيار حساب بنكي أولاً.'});
            return;
        }
        setIsFileLoading(true);
        setBankTransactions([]);
        
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
    
    const handleSystemTxSelect = (txId: string) => {
        setSelectedSystemTxs(prev =>
            prev.includes(txId)
                ? prev.filter(id => id !== txId)
                : [...prev, txId]
        );
    };

    const handleGroupMatchSuccess = () => {
        fetchSystemTransactions(); // Re-fetch to get updated statuses
        setBankTransactions(prev => prev.filter(btx => btx.id !== selectedBankTx));
        setSelectedBankTx(null);
        setSelectedSystemTxs([]);
    };

    const selectedSystemTotal = useMemo(() => {
        if (selectedSystemTxs.length === 0) return 0;
        return selectedSystemTxs.reduce((sum, id) => {
            const tx = systemTransactionsForDisplay.find(t => t.id === id);
            return sum + Math.abs(tx?.amount || 0); 
        }, 0);
    }, [selectedSystemTxs, systemTransactionsForDisplay]);
    
    const selectedBankAmount = useMemo(() => {
        if (!selectedBankTx) return 0;
        return bankTransactions.find(t => t.id === selectedBankTx)?.amount || 0;
    }, [selectedBankTx, bankTransactions]);

    const calculatedFee = useMemo(() => {
        if (selectedSystemTotal > 0 && selectedBankAmount > 0) {
            return selectedSystemTotal - selectedBankAmount;
        }
        return 0;
    }, [selectedSystemTotal, selectedBankAmount]);

    return (
        <>
        <Card dir="rtl">
            <CardHeader>
                <CardTitle>تسوية شركات الوساطة</CardTitle>
                <CardDescription>
                    مطابقة الدفعات المجمعة من بوابات الدفع (مثل ماي فاتورة) مع حركات العملاء في النظام.
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
                
                <Card>
                    <CardHeader>
                        <CardTitle>1. رفع كشف حساب الوسيط</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Input type="file" onChange={(e) => e.target.files && handleFileProcess(e.target.files[0])} accept=".xlsx, .xls, .csv" disabled={!bankAccountId || isFileLoading} />
                        {isFileLoading && <p className="text-sm mt-2 flex items-center gap-2"><Loader2 className="animate-spin" /> جاري معالجة الملف...</p>}
                    </CardContent>
                </Card>
                
                <Separator />
                
                <div className="flex flex-col items-center justify-center gap-4 p-4 border rounded-lg bg-muted/50">
                    <div className="flex flex-wrap items-center justify-center gap-4">
                        <div className="text-center">
                            <p className="text-sm text-muted-foreground">إجمالي الحركات المحددة</p>
                            <p className="text-xl font-bold text-green-600">{formatCurrency(selectedSystemTotal)}</p>
                        </div>
                        <div className="text-2xl font-bold text-muted-foreground">-</div>
                        <div className="text-center">
                            <p className="text-sm text-muted-foreground">مبلغ الإيداع المحدد</p>
                            <p className="text-xl font-bold">{formatCurrency(selectedBankAmount)}</p>
                        </div>
                         <div className="text-2xl font-bold text-muted-foreground">=</div>
                        <div className="text-center">
                            <p className="text-sm text-muted-foreground">الرسوم/الفرق</p>
                            <p className="font-bold text-xl text-red-600">
                                {formatCurrency(calculatedFee)}
                            </p>
                        </div>
                    </div>
                    <Button variant="default" onClick={() => setIsGroupMatchOpen(true)} disabled={!selectedBankTx || selectedSystemTxs.length < 2}>
                        <GitMerge className="ml-2"/> تسوية الدفعة المجمعة
                    </Button>
                </div>

                <h3 className="text-lg font-semibold text-center">2. حدد الحركات للمطابقة</h3>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader><CardTitle>إيداعات الوسيط</CardTitle></CardHeader>
                        <CardContent className="h-72 overflow-y-auto">
                            <Table>
                                {bankTransactions.map(tx => (
                                    <TableRow key={tx.id}>
                                        <TableCell><Checkbox checked={selectedBankTx === tx.id} onCheckedChange={() => setSelectedBankTx(prev => prev === tx.id ? null : tx.id)}/></TableCell>
                                        <TableCell>{format(tx.date, 'dd/MM')}<br/><span className="text-xs text-muted-foreground">{tx.description}</span></TableCell>
                                        <TableCell className="text-left font-mono">{formatCurrency(tx.amount)}</TableCell>
                                    </TableRow>
                                ))}
                            </Table>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader><CardTitle>دفعات العملاء (غير مسواة)</CardTitle></CardHeader>
                        <CardContent className="h-72 overflow-y-auto">
                             <Table>
                                {systemTransactionsForDisplay.map(tx => (
                                    <TableRow key={tx.id}>
                                        <TableCell><Checkbox checked={selectedSystemTxs.includes(tx.id)} onCheckedChange={() => handleSystemTxSelect(tx.id)}/></TableCell>
                                        <TableCell>{format(tx.date, 'dd/MM')}<br/><span className="text-xs text-muted-foreground">{tx.description}</span></TableCell>
                                        <TableCell className="text-left font-mono text-green-600">{formatCurrency(Math.abs(tx.amount))}</TableCell>
                                    </TableRow>
                                ))}
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </CardContent>
        </Card>
        {isGroupMatchOpen && selectedBankTx && (
             <GroupedReconciliationDialog
                isOpen={isGroupMatchOpen}
                onClose={() => setIsGroupMatchOpen(false)}
                onSuccess={handleGroupMatchSuccess}
                bankTx={bankTransactions.find(btx => btx.id === selectedBankTx)!}
                systemJEs={systemJournalEntries.filter(je => selectedSystemTxs.includes(je.id!))}
                bankAccountId={bankAccountId}
                accounts={accounts}
             />
        )}
        </>
    );
}
