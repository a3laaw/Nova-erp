
'use client';
import { type ColumnDef } from '@tanstack/react-table';
import type { BoqItem } from '@/lib/types';
import { formatCurrency, cn } from '@/lib/utils';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface BoqColumnsProps {
  onEdit: (item: BoqItem) => void;
  onDelete: (item: BoqItem) => void;
}

export const getBoqColumns = ({ onEdit, onDelete }: BoqColumnsProps): ColumnDef<BoqItem>[] => [
  {
    accessorKey: 'itemNumber',
    header: 'رقم البند',
  },
  {
    accessorKey: 'description',
    header: 'وصف البند',
    cell: ({ row }) => <div className="min-w-[200px] whitespace-pre-wrap">{row.original.description}</div>,
  },
  {
    accessorKey: 'unit',
    header: 'الوحدة',
  },
  {
    accessorKey: 'quantity',
    header: 'الكمية',
    cell: ({ row }) => (row.original.quantity || 0).toFixed(2),
  },
  {
    accessorKey: 'costUnitPrice',
    header: 'سعر تكلفة الوحدة',
    cell: ({ row }) => formatCurrency(row.original.costUnitPrice || 0),
  },
  {
    accessorKey: 'sellingUnitPrice',
    header: 'سعر بيع الوحدة',
    cell: ({ row }) => formatCurrency(row.original.sellingUnitPrice || 0),
  },
  {
    id: 'totalCost',
    header: 'إجمالي التكلفة',
    cell: ({ row }) => {
        const total = (row.original.quantity || 0) * (row.original.costUnitPrice || 0);
        return formatCurrency(total);
    },
  },
  {
    id: 'totalSelling',
    header: 'إجمالي البيع',
    cell: ({ row }) => {
        const total = (row.original.quantity || 0) * (row.original.sellingUnitPrice || 0);
        return <div className="font-semibold">{formatCurrency(total)}</div>;
    },
  },
  {
    accessorKey: 'margin',
    header: 'هامش الربح',
     cell: ({ row }) => {
      const margin = row.original.margin;
      if (typeof margin !== 'number') return '-';
      const color = margin < 15 ? 'text-destructive' : margin < 30 ? 'text-amber-600' : 'text-green-600';
      return <div className={cn("font-semibold", color)}>{margin.toFixed(1)}%</div>;
    },
  },
  {
    accessorKey: 'executedQuantity',
    header: 'الكمية المنفذة',
    cell: ({ row }) => (row.original.executedQuantity || 0).toFixed(2),
  },
  {
    id: 'completion',
    header: '% الإنجاز',
    cell: ({ row }) => {
        const plannedQty = row.original.quantity || 0;
        const executedQty = row.original.executedQuantity || 0;
        const completion = plannedQty > 0 
            ? (executedQty / plannedQty) * 100
            : 0;
        return `${completion.toFixed(1)}%`;
    }
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const item = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(item)}>تعديل</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(item)} className="text-destructive">
              حذف
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

