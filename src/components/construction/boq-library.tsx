'use client';
import { useState, useMemo } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Boq } from '@/lib/types';
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

    const boqsQuery = useMemo(() => {
        if (!firestore) return null;
        return [orderBy('createdAt', 'desc')];
    }, [firestore]);

    const { data: boqs, loading } = useSubscription<Boq>(firestore, 'boqs', boqsQuery || []);

    const fuse = useMemo(() => new Fuse(boqs, {
        keys: ['name', 'boqNumber', 'clientName'],
        threshold: 0.3,
        minMatchCharLength: 2,
    }), [boqs]);
    
    const filteredBoqs = useMemo(() => {
        if (!searchQuery) return boqs;
        return fuse.search(searchQuery).map(result => result.item);
    }, [boqs, searchQuery, fuse]);


    const formatDate = (date: any) => toFirestoreDate(date) ? format(toFirestoreDate(date)!, 'dd/MM/yyyy') : '-';

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="ابحث باسم الـ BOQ, العميل, أو الرقم..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 rtl:pr-10"
                    />
                </div>
                <Button asChild>
                    <Link href="/dashboard/construction/boq/new">
                        <PlusCircle className="ml-2 h-4" />
                        إنشاء جدول كميات جديد
                    </Link>
                </Button>
            </div>
             <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>اسم/رقم الـ BOQ</TableHead>
                            <TableHead>العميل (المحتمل)</TableHead>
                            <TableHead>تاريخ الإنشاء</TableHead>
                            <TableHead>الحالة</TableHead>
                            <TableHead>عدد البنود</TableHead>
                            <TableHead className="text-left">القيمة الإجمالية</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}>
                                <TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell>
                            </TableRow>
                        ))}
                        {!loading && filteredBoqs.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    لا توجد جداول كميات لعرضها.
                                </TableCell>
                            </TableRow>
                        )}
                        {!loading && filteredBoqs.map(boq => (
                             <TableRow key={boq.id}>
                                <TableCell className="font-medium">
                                    <Link href={`/dashboard/construction/boq/${boq.id}`} className="hover:underline text-primary">
                                        {boq.name}
                                    </Link>
                                    <p className="text-xs text-muted-foreground font-mono">{boq.boqNumber}</p>
                                </TableCell>
                                <TableCell>{boq.clientName || '-'}</TableCell>
                                <TableCell>{formatDate(boq.createdAt)}</TableCell>
                                <TableCell><Badge variant="outline">{boq.status}</Badge></TableCell>
                                <TableCell className="text-center">{boq.itemCount || 0}</TableCell>
                                <TableCell className="text-left font-mono font-semibold">{formatCurrency(boq.totalValue || 0)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
