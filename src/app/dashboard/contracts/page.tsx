'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, MoreHorizontal } from 'lucide-react';
import { useLanguage } from '@/context/language-context';
import { useFirebase, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import type { Contract } from '@/lib/types';


export default function ContractsPage() {
  const { language } = useLanguage();
  const { firestore } = useFirebase();

  const contractsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'contracts'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const [snapshot, loading, error] = useCollection(contractsQuery);

  const contracts = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contract));
  }, [snapshot]);
  
  const formatDate = (dateValue: any) => {
    if (!dateValue) return '-';
    try {
        const date = dateValue.toDate();
        return format(date, 'dd/MM/yyyy');
    } catch(e) {
        return '-';
    }
  };


  const t = language === 'ar' ? {
    title: 'إدارة العقود',
    description: 'عرض وإنشاء وتعديل العقود الإلكترونية.',
    newContract: 'إنشاء عقد جديد',
    noContracts: 'لا توجد عقود محفوظة بعد.',
    noContractsDesc: 'ستظهر قائمة العقود المحفوظة هنا.',
    contractTitle: 'عنوان العقد',
    clientName: 'اسم العميل',
    contractDate: 'تاريخ العقد',
    totalAmount: 'القيمة الإجمالية',
    actions: 'الإجراءات',
  } : {
    title: 'Contract Management',
    description: 'View, create, and edit electronic contracts.',
    newContract: 'New Contract',
    noContracts: 'No saved contracts yet.',
    noContractsDesc: 'The list of saved contracts will appear here.',
    contractTitle: 'Contract Title',
    clientName: 'Client Name',
    contractDate: 'Contract Date',
    totalAmount: 'Total Amount',
    actions: 'Actions',
  };

  return (
    <Card dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t.title}</CardTitle>
            <CardDescription>{t.description}</CardDescription>
          </div>
          <Button asChild>
            <Link href="/dashboard/contracts/new">
              <PlusCircle className="ml-2 h-4 w-4" />
              {t.newContract}
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>{t.contractTitle}</TableHead>
                        <TableHead>{t.clientName}</TableHead>
                        <TableHead>{t.contractDate}</TableHead>
                        <TableHead className="text-left">{t.totalAmount}</TableHead>
                        <TableHead><span className="sr-only">{t.actions}</span></TableHead>
                    </TableRow>
                </TableHeader>
                 <TableBody>
                    {loading && Array.from({length: 3}).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell colSpan={5}><Skeleton className="h-6 w-full" /></TableCell>
                        </TableRow>
                    ))}
                    {!loading && contracts.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center">
                                {t.noContracts}
                            </TableCell>
                        </TableRow>
                    )}
                    {!loading && contracts.map(contract => (
                        <TableRow key={contract.id}>
                            <TableCell className="font-medium">{contract.title}</TableCell>
                            <TableCell>{contract.clientName}</TableCell>
                            <TableCell>{formatDate(contract.contractDate)}</TableCell>
                            <TableCell className="text-left font-mono">{formatCurrency(contract.financials.totalAmount - contract.financials.discount)}</TableCell>
                            <TableCell className="text-center">
                                <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
      </CardContent>
    </Card>
  );
}
