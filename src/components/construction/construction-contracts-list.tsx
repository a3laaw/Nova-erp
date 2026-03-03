
'use client';

import { useMemo } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { collectionGroup, query, where, orderBy } from 'firebase/firestore';
import type { ClientTransaction, Client, ConstructionProject } from '@/lib/types';
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
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, cn } from '@/lib/utils';
import { PlusCircle, FileSignature, User, ExternalLink, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { toFirestoreDate } from '@/services/date-converter';
import { format } from 'date-fns';

interface ConstructionContractsListProps {
  searchQuery: string;
}

export function ConstructionContractsList({ searchQuery }: ConstructionContractsListProps) {
  const { firestore } = useFirebase();

  // 1. جلب كافة المعاملات التي تحتوي على عقد مالي
  const txQuery = useMemo(() => [
    where('status', '==', 'in-progress'),
    orderBy('createdAt', 'desc')
  ], []);

  const { data: rawTransactions, loading: txLoading } = useSubscription<ClientTransaction>(
    firestore, 
    'transactions', 
    txQuery, 
    true // collectionGroup
  );

  // 2. جلب كافة المشاريع الفنية للتحقق من الربط
  const { data: projects, loading: projectsLoading } = useSubscription<ConstructionProject>(firestore, 'projects');
  const { data: clients } = useSubscription<Client>(firestore, 'clients');

  const contractsData = useMemo(() => {
    if (!rawTransactions || !projects || !clients) return [];

    const projectTxIds = new Set(projects.map(p => p.linkedTransactionId).filter(Boolean));
    const clientsMap = new Map(clients.map(c => [c.id, c.nameAr]));

    return rawTransactions
      .filter(tx => !!tx.contract) // فقط المعاملات التي لها عقد
      .map(tx => ({
        ...tx,
        clientName: clientsMap.get(tx.clientId) || '...',
        hasTechnicalProject: projectTxIds.has(tx.id!) || !!tx.projectId
      }));
  }, [rawTransactions, projects, clients]);

  const filteredContracts = useMemo(() => {
    if (!searchQuery) return contractsData;
    const lower = searchQuery.toLowerCase();
    return contractsData.filter(c => 
        c.clientName.toLowerCase().includes(lower) || 
        c.transactionType.toLowerCase().includes(lower)
    );
  }, [contractsData, searchQuery]);

  if (txLoading || projectsLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;

  return (
    <div className="border-2 rounded-[2rem] overflow-hidden bg-card shadow-sm">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="h-14 border-b-2">
            <TableHead className="px-6 font-bold">العميل والمعاملة</TableHead>
            <TableHead>تاريخ العقد</TableHead>
            <TableHead className="text-left">قيمة العقد</TableHead>
            <TableHead>الحالة الفنية</TableHead>
            <TableHead className="w-[200px] text-center">الإجراء</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredContracts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-48 text-center">
                <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground opacity-40">
                  <FileSignature className="h-12 w-12" />
                  <p className="font-bold">لا توجد عقود مبرمة بانتظار التأسيس الفني.</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            filteredContracts.map((contract) => (
              <TableRow key={contract.id} className="h-20 hover:bg-muted/5 transition-colors border-b last:border-0">
                <TableCell className="px-6">
                  <div className="flex flex-col">
                    <span className="font-black text-foreground">{contract.transactionType}</span>
                    <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" /> {contract.clientName}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {toFirestoreDate(contract.createdAt) ? format(toFirestoreDate(contract.createdAt)!, 'dd/MM/yyyy') : '-'}
                </TableCell>
                <TableCell className="text-left font-mono font-black text-primary text-lg">
                  {formatCurrency(contract.contract?.totalAmount || 0)}
                </TableCell>
                <TableCell>
                  {contract.hasTechnicalProject ? (
                    <Badge className="bg-green-600 text-white border-none font-bold px-3">
                      تم تأسيس المشروع الفني
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 font-bold px-3">
                      بانتظار تأسيس الهيكل
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-center px-6">
                  {contract.hasTechnicalProject ? (
                    <Button variant="ghost" size="sm" className="gap-2 font-bold" asChild>
                        <Link href={`/dashboard/clients/${contract.clientId}/transactions/${contract.id}`}>
                            <ExternalLink className="h-4 w-4" /> عرض التفاصيل
                        </Link>
                    </Button>
                  ) : (
                    <Button size="sm" className="bg-primary hover:bg-primary/90 font-black gap-2 rounded-xl h-10 px-6 shadow-lg shadow-primary/20" asChild>
                        <Link href={`/dashboard/construction/projects/new?clientId=${contract.clientId}&transactionId=${contract.id}`}>
                            <PlusCircle className="h-4 w-4" /> تأسيس هيكل المشروع
                        </Link>
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
