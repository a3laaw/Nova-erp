'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
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
import { FileText, Search, HandCoins, ArrowDownLeft, Wallet } from 'lucide-react';
import { useLanguage } from '@/context/language-context';
import { useFirebase } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useAnalyticalData } from '@/hooks/use-analytical-data';
import { formatCurrency, cn } from '@/lib/utils';

export default function ClientStatementsPage() {
  const { language } = useLanguage();
  const { clients, journalEntries, accounts, loading } = useAnalyticalData();
  const [searchQuery, setSearchQuery] = useState('');

  const clientBalances = useMemo(() => {
    if (loading || !clients || !journalEntries || !accounts) return new Map<string, number>();
    const balances = new Map<string, number>();
    clients.forEach(client => {
        const clientAccount = accounts.find(acc => acc.name === client.nameAr && acc.parentCode === '1102');
        if (!clientAccount) {
            balances.set(client.id, 0);
            return;
        }
        const balance = journalEntries
            .filter(entry => entry.status === 'posted')
            .flatMap(entry => entry.lines)
            .filter(line => line.accountId === clientAccount.id)
            .reduce((sum, line) => sum + (line.debit || 0) - (line.credit || 0), 0);
        balances.set(client.id, balance);
    });
    return balances;
  }, [clients, journalEntries, accounts, loading]);
  
  const filteredClients = useMemo(() => {
    if (!searchQuery) return clients;
    const lowercasedQuery = searchQuery.toLowerCase();
    return clients.filter(client => 
        (client.nameAr && client.nameAr.toLowerCase().includes(lowercasedQuery)) ||
        (client.fileId && client.fileId.includes(lowercasedQuery)) ||
        (client.mobile && client.mobile.includes(lowercasedQuery))
    );
  }, [clients, searchQuery]);

  return (
    <div className="space-y-6" dir="rtl">
        <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-gradient-to-l from-white to-blue-50 dark:from-card dark:to-card">
            <CardHeader className="pb-8 px-8 border-b">
                <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner">
                            <Wallet className="h-8 w-8" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-black">تحصيل مديونيات العملاء</CardTitle>
                            <CardDescription className="text-base font-medium">متابعة أرصدة العملاء، مراجعة كشوفات الحساب، وتسجيل التحصيلات النقدية.</CardDescription>
                        </div>
                    </div>
                    <div className="flex flex-col md:flex-row items-center gap-4 w-full lg:w-auto">
                        <div className="flex gap-4 text-xs font-bold text-muted-foreground ml-auto lg:ml-0">
                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" /> مديونية</span>
                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /> رصيد دائن</span>
                        </div>
                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="ابحث بالاسم، رقم الملف، أو الجوال..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 h-11 rounded-xl shadow-inner bg-background border-2"
                            />
                        </div>
                    </div>
                </div>
            </CardHeader>
        </Card>

        <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
            <CardContent className="pt-8">
                <div className="border rounded-2xl overflow-hidden shadow-sm">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead>اسم العميل</TableHead>
                                <TableHead>رقم الملف</TableHead>
                                <TableHead className="text-left">الرصيد الحالي</TableHead>
                                <TableHead className="text-center">إجراءات التحصيل</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-24 ml-auto" /></TableCell>
                                        <TableCell className="text-center"><Skeleton className="h-8 w-32 mx-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredClients.length === 0 ? (
                                <TableRow><TableCell colSpan={4} className="text-center h-32 text-muted-foreground">لا توجد نتائج مطابقة لبحثك.</TableCell></TableRow>
                            ) : (
                                filteredClients.map((client) => {
                                    const balance = clientBalances.get(client.id) || 0;
                                    return (
                                        <TableRow key={client.id} className="hover:bg-muted/30 transition-colors">
                                            <TableCell className="font-bold">
                                                {client.nameAr}
                                                <div className="text-[10px] text-muted-foreground font-normal">{client.mobile}</div>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs opacity-60">{client.fileId}</TableCell>
                                            <TableCell className={cn(
                                                "text-left font-mono font-black text-lg",
                                                balance > 0 ? "text-red-600" : balance < 0 ? "text-green-600" : "text-muted-foreground"
                                            )}>
                                                {formatCurrency(balance)}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex justify-center gap-2">
                                                    <Button asChild variant="outline" size="sm" className="rounded-lg gap-2">
                                                        <Link href={`/dashboard/clients/${client.id}/statement`}>
                                                            <FileText className="h-4 w-4" />
                                                            كشف الحساب
                                                        </Link>
                                                    </Button>
                                                    <Button asChild size="sm" className="rounded-lg gap-2 bg-green-600 hover:bg-green-700">
                                                        <Link href={`/dashboard/accounting/cash-receipts/new?clientId=${client.id}`}>
                                                            <ArrowDownLeft className="h-4 w-4" />
                                                            تحصيل مبلغ
                                                        </Link>
                                                    </Button>
                                                </div>
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
    </div>
  );
}