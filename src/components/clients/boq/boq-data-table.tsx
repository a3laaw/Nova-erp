
'use client';

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter
} from '@/components/ui/table';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getFilteredRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface BoqDataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  loading: boolean;
}

export function BoqDataTable<TData, TValue>({ columns, data, loading }: BoqDataTableProps<TData, TValue>) {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
    },
  });

  const { totalCost, totalSelling, overallMargin } = React.useMemo(() => {
    const totals = data.reduce((acc, row: any) => {
        const cost = (row.quantity || 0) * (row.costUnitPrice || 0);
        const selling = (row.quantity || 0) * (row.sellingUnitPrice || 0);
        acc.totalCost += cost;
        acc.totalSelling += selling;
        return acc;
    }, { totalCost: 0, totalSelling: 0 });

    const margin = totals.totalSelling > 0 ? ((totals.totalSelling - totals.totalCost) / totals.totalSelling) * 100 : 0;
    return { ...totals, overallMargin: margin };
  }, [data]);
  

  return (
    <div>
        <div className="flex items-center py-4">
            <Input
                placeholder="ابحث في وصف البند..."
                value={(table.getColumn("description")?.getFilterValue() as string) ?? ""}
                onChange={(event) =>
                    table.getColumn("description")?.setFilterValue(event.target.value)
                }
                className="max-w-sm"
            />
        </div>
        <div className="rounded-md border">
        <Table>
            <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                    return (
                    <TableHead key={header.id}>
                        {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                            )}
                    </TableHead>
                    );
                })}
                </TableRow>
            ))}
            </TableHeader>
            <TableBody>
            {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={columns.length}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                ))
            ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                >
                    {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                    ))}
                </TableRow>
                ))
            ) : (
                <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                    لا توجد بنود في جدول الكميات بعد.
                </TableCell>
                </TableRow>
            )}
            </TableBody>
             <TableFooter>
                <TableRow className="bg-muted font-bold">
                    <TableCell colSpan={6}>الإجمالي</TableCell>
                    <TableCell className="text-left font-mono">{formatCurrency(totalCost)}</TableCell>
                    <TableCell className="text-left font-mono">{formatCurrency(totalSelling)}</TableCell>
                    <TableCell className="text-center font-mono">{overallMargin.toFixed(1)}%</TableCell>
                    <TableCell colSpan={3}></TableCell>
                </TableRow>
            </TableFooter>
        </Table>
        </div>
    </div>
  );
}



