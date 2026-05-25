
'use client';

import { useMemo } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { orderBy, where } from 'firebase/firestore';
import type { ClientTransaction, Client } from '@/lib/types';
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
import { User, Eye, Pencil, FileText, Ban, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { toFirestoreDate } from '@/services/date-converter';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { ar } from 'date-fns/locale';

interface ConstructionContractsListProps {
  searchQuery?: string;
  contractNo?: string;
  statusFilter?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

const statusMap: Record<string, { label: string, color: string }> = {
    'in-progress': { label: 'فعال', color: 'bg-green-100 text-green-800 border-green-200' },
    'on-hold': { label: 'معلق', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    'cancelled': { label: 'عقد مفسوخ', color: 'bg-red-50 text-red-700 border-red-200' },
    'completed': { label: 'مكتمل', color: 'bg-blue-100 text-blue-800 border-blue-200' },
};

/**
 * أرشيف العقود الموقعة الموحد (Contract Archive V58.1):
 * يقوم بسحب كافة المعاملات التي تملك "عقد" ويوفر نفاذاً سريعاً لها.
 */
export function ConstructionContractsList({ searchQuery, contractNo, statusFilter = 'all', dateFrom, dateTo }: ConstructionContractsListProps) {
  const { firestore } = useFirebase();

  // جلب كافة المعاملات من النطاق العالمي للمنشأة
  const { data: rawTransactions, loading: txLoading } = useSubscription<ClientTransaction>(
    firestore, 
    'transactions', 
    [], 
    true 
  );

  const { data: clients, loading: clientsLoading } = useSubscription<Client>(firestore, 'clients');

  const contractsData = useMemo(() => {
    if (!rawTransactions || !clients) return [];

    const clientsMap = new Map(clients.map(c => [c.id, c]));

    return rawTransactions
      .filter(tx => !!tx.contract) // نأخذ فقط المعاملات التي تحولت لعقود
      .map(tx => {
          const client = clientsMap.get(tx.clientId);
          return {
            ...tx,
            clientName: client?.nameAr || '---',
            clientPhone: client?.mobile || '',
          };
      })
      .sort((a, b) => (toFirestoreDate(b.updatedAt || b.createdAt)?.getTime() || 0) - (toFirestoreDate(a.updatedAt || a.createdAt)?.getTime() || 0));
  }, [rawTransactions, clients]);

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

  if (txLoading || clientsLoading) return (
    <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
    </div>
  );

  return (
    <div className="border-2 rounded-[2rem] overflow-hidden shadow-sm bg-white">
      <Table>
        <TableHeader className="bg-[#F8F9FE] h-14">
          <TableRow className="border-none">
            <TableHead className="px-8 font-black text-[#7209B7]">رقم العقد</TableHead>
            <TableHead className="font-black text-[#7209B7]">المالك / العميل</TableHead>
            <TableHead className="font-black text-[#7209B7]">نوع المعاملة</TableHead>
            <TableHead className="font-black text-[#7209B7] text-center">التاريخ</TableHead>
            <TableHead className="font-black text-[#7209B7] text-left">قيمة العقد</TableHead>
            <TableHead className="font-black text-[#7209B7] text-center">الحالة</TableHead>
            <TableHead className="w-[120px] font-black text-[#7209B7] text-center">إدارة</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredContracts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-48 text-center text-muted-foreground opacity-30 italic font-black text-xl">
                لا توجد عقود مسجلة في الأرشيف الموحد.
              </TableCell>
            </TableRow>
          ) : (
            filteredContracts.map((contract) => (
              <TableRow 
                key={contract.id} 
                className="h-20 hover:bg-primary/[0.02] group transition-all border-b last:border-0"
              >
                <TableCell className="px-8 font-mono font-black text-primary text-sm">
                    {contract.transactionNumber}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 rounded-xl group-hover:bg-white transition-colors">
                        <User className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-black text-[#000000] text-base">{contract.clientName}</span>
                        <span className="text-[10px] font-bold text-slate-400" dir="ltr">{contract.clientPhone}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-bold text-slate-600">
                    {contract.transactionType}
                </TableCell>
                <TableCell className="text-center font-mono text-xs font-bold text-slate-400">
                    {toFirestoreDate(contract.createdAt) ? format(toFirestoreDate(contract.createdAt)!, 'dd/MM/yyyy') : '-'}
                </TableCell>
                <TableCell className="text-left font-mono font-black text-[#2E5BCC] text-lg">
                  {formatCurrency(contract.contract?.totalAmount || 0)}
                </TableCell>
                <TableCell className="text-center">
                    <Badge variant="outline" className={cn("px-4 py-1 rounded-full font-black text-[9px] border-2", statusMap[contract.status]?.color)}>
                        {statusMap[contract.status]?.label || contract.status}
                    </Badge>
                </TableCell>
                <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-10 w-10 rounded-xl border-2 border-primary/20 text-primary hover:bg-primary hover:text-white transition-all shadow-sm" 
                            asChild
                        >
                            <Link href={`/dashboard/clients/${contract.clientId}/transactions/${contract.id}/contract`} title="عرض العقد">
                                <FileText className="h-5 w-5" />
                            </Link>
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-10 w-10 rounded-xl border-2 bg-slate-50 hover:bg-white transition-all shadow-sm" 
                            asChild
                        >
                            <Link href={`/dashboard/clients/${contract.clientId}/transactions/${contract.id}`} title="فتح المسار الفني">
                                <RotateCcw className="h-5 w-5" />
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
