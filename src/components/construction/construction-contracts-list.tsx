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
import { FileSignature, User, Eye, Pencil, Phone, Target, Calendar } from 'lucide-react';
import Link from 'next/link';
import { toFirestoreDate } from '@/services/date-converter';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';

interface ConstructionContractsListProps {
  searchQuery?: string;
  contractNo?: string;
  statusFilter?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

const statusMap: Record<string, { label: string, color: string }> = {
    'in-progress': { label: 'فعال (Active)', color: 'bg-[#ECFDF5] text-[#14453D] border-[#14453D]/20' }, // Emerald Green
    'on-hold': { label: 'معلق (Pending)', color: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]' }, // Amber
    'cancelled': { label: 'ملغي (Closed)', color: 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]' }, // Soft Red
    'completed': { label: 'مكتمل (Closed)', color: 'bg-[#F0F9FF] text-[#2E5BCC] border-[#BAE6FD]' }, // Steel Blue
    'new': { label: 'مسودة (Draft)', color: 'bg-[#F3F4F6] text-[#374151] border-[#E5E7EB]' },
};

export function ConstructionContractsList({ searchQuery, contractNo, statusFilter = 'all', dateFrom, dateTo }: ConstructionContractsListProps) {
  const { firestore } = useFirebase();

  const txQuery = useMemo(() => [
    orderBy('createdAt', 'desc')
  ], []);

  const { data: rawTransactions, loading: txLoading } = useSubscription<ClientTransaction>(
    firestore, 
    'transactions', 
    txQuery, 
    true 
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
        const searchLower = searchQuery?.toLowerCase() || '';
        const matchesSearch = !searchQuery || 
            c.clientName.toLowerCase().includes(searchLower) || 
            c.clientPhone.includes(searchQuery) ||
            c.transactionType.toLowerCase().includes(searchLower);

        const matchesNo = !contractNo || c.transactionNumber.toLowerCase().includes(contractNo.toLowerCase());
        const matchesStatus = statusFilter === 'all' || c.status === statusFilter;

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

        return matchesSearch && matchesNo && matchesStatus && matchesDate;
    });
  }, [contractsData, searchQuery, contractNo, statusFilter, dateFrom, dateTo]);

  if (txLoading || projectsLoading) return (
    <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
    </div>
  );

  return (
    <div className="rounded-[2rem] border-none shadow-sm overflow-hidden bg-white">
      <Table className="border-separate border-spacing-y-2 px-2">
        <TableHeader className="bg-[#F8F9FE]">
          <TableRow className="hover:bg-transparent border-none">
            <TableHead className="px-6 py-5 font-black text-[#7209B7] text-right rounded-r-2xl">رقم العقد</TableHead>
            <TableHead className="font-black text-[#7209B7] text-right">العميل</TableHead>
            <TableHead className="font-black text-[#7209B7] text-right">نوع المعاملة</TableHead>
            <TableHead className="font-black text-[#7209B7] text-center">التاريخ</TableHead>
            <TableHead className="font-black text-[#7209B7] text-left">المبلغ</TableHead>
            <TableHead className="font-black text-[#7209B7] text-center">الحالة</TableHead>
            <TableHead className="w-[120px] font-black text-[#7209B7] text-center rounded-l-2xl">إجراءات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="before:block before:h-2">
          {filteredContracts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-48 text-center">
                <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground opacity-40">
                  <FileSignature className="h-12 w-12" />
                  <p className="font-bold">لا توجد نتائج تطابق فلاتر البحث المحددة.</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            filteredContracts.map((contract) => (
              <TableRow 
                key={contract.id} 
                className="group border-none shadow-sm transition-all duration-300 hover:bg-[#F3E8FF]/50 [&:nth-child(even)]:bg-[#F3E8FF]/20"
              >
                <TableCell className="px-6 py-5 font-mono font-black text-[#7209B7] text-sm rounded-r-2xl">
                    {contract.transactionNumber}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#F8F9FE] rounded-full group-hover:bg-white transition-colors">
                        <User className="h-4 w-4 text-[#7209B7]" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-black text-[#14453D]">{contract.clientName}</span>
                        <span className="text-[10px] font-bold text-muted-foreground" dir="ltr">{contract.clientPhone}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-bold text-foreground/80">
                    {contract.transactionType}
                </TableCell>
                <TableCell className="text-center">
                    <div className="flex flex-col items-center">
                        <span className="font-mono text-xs font-bold text-muted-foreground">
                            {toFirestoreDate(contract.createdAt) ? format(toFirestoreDate(contract.createdAt)!, 'dd/MM/yyyy') : '-'}
                        </span>
                    </div>
                </TableCell>
                <TableCell className="text-left font-mono font-black text-[#2E5BCC] text-lg">
                  {formatCurrency(contract.contract?.totalAmount || 0)}
                </TableCell>
                <TableCell className="text-center">
                    <Badge variant="outline" className={cn("font-black px-4 py-1 rounded-full border-2", statusMap[contract.status]?.color)}>
                        {statusMap[contract.status]?.label || contract.status}
                    </Badge>
                </TableCell>
                <TableCell className="text-center rounded-l-2xl">
                    <div className="flex items-center justify-center gap-2">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 rounded-xl border-2 border-[#7209B7]/20 text-[#7209B7] hover:bg-[#7209B7] hover:text-white transition-all shadow-none" 
                            asChild
                        >
                            <Link href={`/dashboard/clients/${contract.clientId}/transactions/${contract.id}`}>
                                <Eye className="h-4 w-4" />
                            </Link>
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 rounded-xl border-2 border-[#7209B7]/20 text-[#7209B7] hover:bg-[#7209B7] hover:text-white transition-all shadow-none" 
                            asChild
                        >
                            <Link href={`/dashboard/clients/${contract.clientId}/transactions/${contract.id}/edit`}>
                                <Pencil className="h-4 w-4" />
                            </Link>
                        </Button>
                    </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
