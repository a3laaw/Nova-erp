
'use client';

import { useState, useMemo, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DateInput } from '@/components/ui/date-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Upload, AlertCircle, Check, Link2 } from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import type { Account, JournalEntry } from '@/lib/types';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { startOfMonth, endOfMonth, parse, isValid } from 'date-fns';

interface BankTransaction {
  id: string;
  date: Date;
  description: string;
  amount: number;
}

interface SystemTransaction extends JournalEntry {
    lineId: string;
    lineAmount: number;
    isDebit: boolean;
}

export default function BankReconciliationPage() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    
    const [bankAccountId, setBankAccountId] = useState('');
    const [dateFrom, setDateFrom] = useState<Date | undefined>(() => startOfMonth(new Date()));
    const [dateTo, setDateTo] = useState<Date | undefined>(() => endOfMonth(new Date()));

    const { data: accounts, loading: accountsLoading } = useSubscription<Account>(firestore, 'chartOfAccounts');
    
    const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
    const [systemTransactions, setSystemTransactions] = useState<SystemTransaction[]>([]);
    
    const [matchedSystemIds, setMatchedSystemIds] = useState<Set<string>>(new Set());
    const [matchedBankIds, setMatchedBankIds] = useState<Set<string>>(new Set());

    const [isProcessing, setIsProcessing] = useState(false);

    const bankAccountOptions = useMemo(() => 
        accounts
            .filter(a => a.code.startsWith('110103')) // Filter for bank accounts
            .map(a => ({ value: a.id!, label: `${a.name} (${a.code})`}))
    , [accounts]);

    const handleFileProcess = async (file: File) => {
        if (!bankAccountId) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء اختيار حساب بنكي أولاً.'});
            return;
        }
        setIsProcessing(true);
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                // Find headers (assuming they are in the first few rows)
                let headerRowIndex = -1;
                let dateIndex = -1, descIndex = -1, debitIndex = -1, creditIndex = -1;
                
                for(let i=0; i<Math.min(json.length, 10); i++) {
                    const row = json[i].map((cell: any) => String(cell).toLowerCase());
                    dateIndex = row.findIndex((cell: string) => cell.includes('date') || cell.includes('تاريخ'));
                    descIndex = row.findIndex((cell: string) => cell.includes('description') || cell.includes('بيان'));
                    debitIndex = row.findIndex((cell: string) => cell.includes('debit') || cell.includes('مدين'));
                    creditIndex = row.findIndex((cell: string) => cell.includes('credit') || cell.includes('دائن'));

                    if (dateIndex > -1 && descIndex > -1 && (debitIndex > -1 || creditIndex > -1)) {
                        headerRowIndex = i;
                        break;
                    }
                }
                
                if (headerRowIndex === -1) {
                    throw new Error("لم يتم العثور على الأعمدة المطلوبة (Date, Description, Debit/Credit) في الملف.");
                }

                const transactions: BankTransaction[] = json.slice(headerRowIndex + 1).map((row, index) => {
                    const dateVal = row[dateIndex];
                    let date;
                    if (typeof dateVal === 'number') { // Excel date number
                        date = XLSX.SSF.parse_date_code(dateVal);
                        date = new Date(date.y, date.m - 1, date.d, date.H, date.M, date.S);
                    } else if (typeof dateVal === 'string') {
                        date = parse(dateVal, 'dd/MM/yyyy', new Date());
                        if(!isValid(date)) date = new Date(dateVal);
                    }
                    if (!date || !isValid(date)) return null;

                    const debit = parseFloat(row[debitIndex] || '0');
                    const credit = parseFloat(row[creditIndex] || '0');
                    const amount = credit - debit;

                    return {
                        id: `bank-${index}`,
                        date,
                        description: row[descIndex] || '',
                        amount
                    };
                }).filter((item): item is BankTransaction => item !== null);
                
                setBankTransactions(transactions);

            } catch (error) {
                const message = error instanceof Error ? error.message : 'فشل في قراءة الملف.';
                toast({ variant: 'destructive', title: 'خطأ', description: message });
            } finally {
                setIsProcessing(false);
            }
        };
        reader.readAsBinaryString(file!);
    };

    return (
        <Card dir="rtl">
            <CardHeader>
                <CardTitle>التسوية البنكية</CardTitle>
                <CardDescription>
                    قم بمطابقة الحركات في كشف حساب البنك مع القيود المسجلة في النظام.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Filters */}
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
                
                 {/* File Upload */}
                <Card>
                    <CardHeader>
                        <CardTitle>1. رفع كشف حساب البنك</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Input type="file" onChange={(e) => e.target.files && handleFileProcess(e.target.files[0])} accept=".xlsx, .xls, .csv" disabled={!bankAccountId || isProcessing} />
                        {isProcessing && <p className="text-sm mt-2 flex items-center gap-2"><Loader2 className="animate-spin" /> جاري معالجة الملف...</p>}
                    </CardContent>
                </Card>

                 {/* Reconciliation Area */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader><CardTitle>حركات كشف البنك (غير مسواة)</CardTitle></CardHeader>
                        <CardContent><Skeleton className="h-48" /></CardContent>
                    </Card>
                     <Card>
                        <CardHeader><CardTitle>حركات النظام (غير مسواة)</CardTitle></CardHeader>
                        <CardContent><Skeleton className="h-48" /></CardContent>
                    </Card>
                </div>
                
                 <Card>
                    <CardHeader><CardTitle>الحركات التي تمت مطابقتها</CardTitle></CardHeader>
                    <CardContent><Skeleton className="h-48" /></CardContent>
                </Card>
            </CardContent>
        </Card>
    );
}
