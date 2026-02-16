'use client';
import { useState, useMemo } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { collectionGroup, query, orderBy, where } from 'firebase/firestore';
import type { ClientTransaction, Client } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PlusCircle, Search } from 'lucide-react';
import { format } from 'date-fns';
import { toFirestoreDate } from '@/services/date-converter';
import Fuse from 'fuse.js';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '../ui/badge';

export function BoqLibrary() {
    const { firestore } = useFirebase();
    const [searchQuery, setSearchQuery] = useState('');

    const transactionsQuery = useMemo(() => {
        if (!firestore) return null;
        // Using collectionGroup to fetch all transactions from all clients
        return [where('boqItemCount', '>', 0), orderBy('createdAt', 'desc')];
    }, [firestore]);

    const { data: transactions, loading: transactionsLoading } = useSubscription<ClientTransaction & {id: string}>(firestore, 'transactions', transactionsQuery, true);
    const { data: clients, loading: clientsLoading } = useSubscription<Client>(firestore, 'clients');

    const loading = transactionsLoading || clientsLoading;

    const clientsMap = useMemo(() => {
        if (!clients) return new Map();
        return new Map(clients.map(c => [c.id, c.nameAr]));
    }, [clients]);

    const augmentedTransactions = useMemo(() => {
        return (transactions || []).map(tx => ({
            ...tx,
            clientName: clientsMap.get(tx.clientId) || 'غير معروف'
        }));
    }, [transactions, clientsMap]);

    const fuse = useMemo(() => new Fuse(augmentedTransactions, {
        keys: ['transactionType', 'transactionNumber', 'clientName'],
        threshold: 0.3,
        minMatchCharLength: 2,
        ignoreLocation: true,
    }), [augmentedTransactions]);
    
    const filteredTransactions = useMemo(() => {
        if (!searchQuery) return augmentedTransactions;
        return fuse.search(searchQuery).map(result => result.item);
    }, [augmentedTransactions, searchQuery, fuse]);


    const formatDate = (date: any) => toFirestoreDate(date) ? format(toFirestoreDate(date)!, 'dd/MM/yyyy') : '-';

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="ابحث باسم المعاملة, العميل, أو الرقم..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 rtl:pr-10"
                    />
                </div>
                <Button asChild>
                    <Link href="/dashboard/clients">
                        <PlusCircle className="ml-2 h-4" />
                        إنشاء معاملة جديدة
                    </Link>
                </Button>
            </div>
             <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>اسم المشروع/المعاملة</TableHead>
                            <TableHead>العميل</TableHead>
                            <TableHead>تاريخ الإنشاء</TableHead>
                            <TableHead>عدد البنود</TableHead>
                            <TableHead className="text-left">القيمة الإجمالية</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}>
                                <TableCell colSpan={5}><Skeleton className="h-6 w-full" /></TableCell>
                            </TableRow>
                        ))}
                        {!loading && filteredTransactions.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    لا توجد جداول كميات لعرضها.
                                </TableCell>
                            </TableRow>
                        )}
                        {!loading && filteredTransactions.map(tx => (
                             <TableRow key={tx.id}>
                                <TableCell className="font-medium">
                                    <Link href={`/dashboard/clients/${tx.clientId}/transactions/${tx.id}`} className="hover:underline text-primary">
                                        {tx.transactionType}
                                    </Link>
                                    <p className="text-xs text-muted-foreground font-mono">{tx.transactionNumber}</p>
                                </TableCell>
                                <TableCell>{tx.clientName}</TableCell>
                                <TableCell>{formatDate(tx.createdAt)}</TableCell>
                                <TableCell className="text-center">{tx.boqItemCount || 0}</TableCell>
                                <TableCell className="text-left font-mono font-semibold">{formatCurrency(tx.boqTotalValue || 0)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
