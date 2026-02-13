
'use client';
import { type ColumnDef } from '@tanstack/react-table';
import type { BoqItem } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
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
    accessorKey: 'plannedQuantity',
    header: 'الكمية المخططة',
    cell: ({ row }) => (row.original.plannedQuantity || 0).toFixed(2),
  },
  {
    accessorKey: 'plannedUnitPrice',
    header: 'سعر الوحدة',
    cell: ({ row }) => formatCurrency(row.original.plannedUnitPrice || 0),
  },
  {
    id: 'plannedTotal',
    header: 'الإجمالي المخطط',
    cell: ({ row }) => {
      const total = (row.original.plannedQuantity || 0) * (row.original.plannedUnitPrice || 0);
      return <div className="font-semibold">{formatCurrency(total)}</div>;
    },
  },
  // Placeholders for future implementation
  {
    accessorKey: 'executedQuantity',
    header: 'الكمية المنفذة',
    cell: ({ row }) => (row.original.executedQuantity || 0).toFixed(2),
  },
  {
    id: 'completion',
    header: '% الإنجاز',
    cell: ({ row }) => {
        const plannedQty = row.original.plannedQuantity || 0;
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


