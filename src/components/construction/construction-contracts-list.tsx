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
import { FileSignature, User, ExternalLink, ArrowRight, Phone, Target } from 'lucide-react';
import Link from 'next/link';
import { toFirestoreDate } from '@/services/date-converter';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';

interface ConstructionContractsListProps {
  searchQuery?: string;
  contractNo?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

const statusMap: Record<string, { label: string, color: string }> = {
    'in-progress': { label: 'فعال', color: 'bg-green-100 text-green-800 border-green-200' },
    'on-hold': { label: 'متوقف', color: 'bg-orange-100 text-orange-800 border-orange-200' },
    'cancelled': { label: 'ملغي', color: 'bg-red-100 text-red-800 border-red-200' },
    'completed': { label: 'مكتمل', color: 'bg-blue-100 text-blue-800 border-blue-200' },
    'new': { label: 'مسودة', color: 'bg-gray-100 text-gray-800 border-gray-200' },
};

export function ConstructionContractsList({ searchQuery, contractNo, dateFrom, dateTo }: ConstructionContractsListProps) {
  const { firestore } = useFirebase();

  // جلب كافة المعاملات التي تحتوي على عقد مالي
  const txQuery = useMemo(() => [
    orderBy('createdAt', 'desc')
  ], []);

  const { data: rawTransactions, loading: txLoading } = useSubscription<ClientTransaction>(
    firestore, 
    'transactions', 
    txQuery, 
    true // collectionGroup
  );

  const { data: projects, loading: projectsLoading } = useSubscription<ConstructionProject>(firestore, 'projects');
  const { data: clients } = useSubscription<Client>(firestore, 'clients');

  const contractsData = useMemo(() => {
    if (!rawTransactions || !projects || !clients) return [];

    const clientsMap = new Map(clients.map(c => [c.id, c]));

    return rawTransactions
      .filter(tx => !!tx.contract) 
      .map(tx => {
          const client = clientsMap.get(tx.clientId);
          return {
            ...tx,
            clientName: client?.nameAr || '...',
            clientPhone: client?.mobile || '',
            hasTechnicalProject: !!tx.projectId || projects.some(p => p.linkedTransactionId === tx.id)
          };
      });
  }, [rawTransactions, projects, clients]);

  const filteredContracts = useMemo(() => {
    return contractsData.filter(c => {
        // منطق البحث الموحد: فحص الاسم أو الهاتف أو نوع المعاملة في حقل واحد
        const searchLower = searchQuery?.toLowerCase() || '';
        const matchesSearch = !searchQuery || 
            c.clientName.toLowerCase().includes(searchLower) || 
            c.clientPhone.includes(searchQuery) ||
            c.transactionType.toLowerCase().includes(searchLower);

        const matchesNo = !contractNo || c.transactionNumber.toLowerCase().includes(contractNo.toLowerCase());
        
        let matchesDate = true;
        if (dateFrom && dateTo) {
            const contractDate = toFirestoreDate(c.createdAt);
            if (contractDate) {
                matchesDate = isWithinInterval(contractDate, { 
                    start: startOfDay(dateFrom), 
                    end: endOfDay(dateTo) 
                });
            }
        }

        return matchesSearch && matchesNo && matchesDate;
    });
  }, [contractsData, searchQuery, contractNo, dateFrom, dateTo]);

  if (txLoading || projectsLoading) return (
    <div className="space-y-4">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
    </div>
  );

  return (
    <div className="border-2 rounded-[2rem] overflow-hidden bg-card shadow-sm">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="h-14 border-b-2">
            <TableHead className="px-6 font-bold">رقم العقد</TableHead>
            <TableHead className="font-bold">العميل والمعاملة</TableHead>
            <TableHead>تاريخ التوقيع</TableHead>
            <TableHead className="text-left">إجمالي القيمة</TableHead>
            <TableHead className="text-center">حالة العقد</TableHead>
            <TableHead className="w-[100px] text-center">عرض</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredContracts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-48 text-center">
                <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground opacity-40">
                  <FileSignature className="h-12 w-12" />
                  <p className="font-bold">لا توجد نتائج تطابق فلاتر البحث المحددة.</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            filteredContracts.map((contract) => (
              <TableRow key={contract.id} className="h-20 hover:bg-muted/5 transition-colors border-b last:border-0">
                <TableCell className="px-6 font-mono font-black text-primary text-sm">
                    {contract.transactionNumber}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-black text-foreground">{contract.transactionType}</span>
                    <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                            <User className="h-3 w-3" /> {contract.clientName}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1" dir="ltr">
                            <Phone className="h-3 w-3" /> {contract.clientPhone}
                        </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs font-bold text-muted-foreground">
                  {toFirestoreDate(contract.createdAt) ? format(toFirestoreDate(contract.createdAt)!, 'dd/MM/yyyy') : '-'}
                </TableCell>
                <TableCell className="text-left font-mono font-black text-primary text-lg">
                  {formatCurrency(contract.contract?.totalAmount || 0)}
                </TableCell>
                <TableCell className="text-center">
                    <Badge variant="outline" className={cn("font-black px-3 py-1", statusMap[contract.status]?.color)}>
                        {statusMap[contract.status]?.label || contract.status}
                    </Badge>
                </TableCell>
                <TableCell className="text-center px-6">
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-primary/10 hover:text-primary transition-all" asChild>
                        <Link href={`/dashboard/clients/${contract.clientId}/transactions/${contract.id}`}>
                            <ExternalLink className="h-5 w-5" />
                        </Link>
                    </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
