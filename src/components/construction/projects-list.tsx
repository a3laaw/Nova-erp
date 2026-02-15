'use client';

import * as React from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  getFilteredRowModel,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, ArrowUpDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useFirebase, useSubscription } from '@/firebase';
import type { ConstructionProject } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { toFirestoreDate } from '@/services/date-converter';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import { Input } from '../ui/input';

const statusColors: Record<string, string> = {
    'مخطط': 'bg-yellow-100 text-yellow-800',
    'قيد التنفيذ': 'bg-blue-100 text-blue-800',
    'مكتمل': 'bg-green-100 text-green-800',
    'معلق': 'bg-gray-100 text-gray-800',
    'ملغى': 'bg-red-100 text-red-800',
};

interface ProjectsListProps {
    searchQuery: string;
}

export function ProjectsList({ searchQuery }: ProjectsListProps) {
    const { firestore } = useFirebase();
    const [sorting, setSorting] = React.useState<SortingState>([]);

    const projectsQuery = React.useMemo(() => {
        if (!firestore) return null;
        return [orderBy('createdAt', 'desc')];
    }, [firestore]);

    const { data: projects, loading } = useSubscription<ConstructionProject>(firestore, 'projects', projectsQuery || []);

    const filteredProjects = React.useMemo(() => {
        if (!projects) return [];
        if (!searchQuery) return projects;
        const lowerCaseQuery = searchQuery.toLowerCase();
        return projects.filter(p => 
            p.projectName.toLowerCase().includes(lowerCaseQuery) ||
            p.projectId.toLowerCase().includes(lowerCaseQuery) ||
            p.clientName?.toLowerCase().includes(lowerCaseQuery)
        );
    }, [projects, searchQuery]);
    
    const formatDate = (dateValue: any) => {
        const date = toFirestoreDate(dateValue);
        return date ? format(date, 'dd/MM/yyyy') : '-';
    };

    const columns = React.useMemo<ColumnDef<ConstructionProject>[]>(
        () => [
            {
                accessorKey: 'projectId',
                header: ({ column }) => (
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                        رقم المشروع
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                ),
                cell: ({ row }) => <div className="font-mono">{row.original.projectId}</div>,
            },
            {
                accessorKey: 'projectName',
                header: 'اسم المشروع',
                cell: ({ row }) => (
                    <div>
                        <Link href={`/dashboard/construction/projects/${row.original.id}`} className="font-medium hover:underline text-primary">
                            {row.original.projectName}
                        </Link>
                        <p className="text-xs text-muted-foreground">{row.original.clientName}</p>
                    </div>
                )
            },
            {
                accessorKey: 'startDate',
                header: 'تاريخ البدء',
                cell: ({ row }) => formatDate(row.original.startDate),
            },
            {
                accessorKey: 'endDate',
                header: 'تاريخ الانتهاء',
                cell: ({ row }) => formatDate(row.original.endDate),
            },
            {
                accessorKey: 'contractValue',
                header: 'قيمة العقد',
                cell: ({ row }) => formatCurrency(row.original.contractValue),
            },
            {
                accessorKey: 'status',
                header: 'الحالة',
                cell: ({ row }) => <Badge variant="outline" className={statusColors[row.original.status] || ''}>{row.original.status}</Badge>,
            },
            {
                accessorKey: 'progressPercentage',
                header: 'نسبة الإنجاز',
                cell: ({ row }) => (
                    <div className="flex items-center gap-2">
                        <Progress value={row.original.progressPercentage} className="w-24 h-2" />
                        <span className="text-xs font-mono">{row.original.progressPercentage}%</span>
                    </div>
                )
            },
            {
                id: 'actions',
                cell: ({ row }) => (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">فتح القائمة</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" dir="rtl">
                            <DropdownMenuItem asChild>
                                <Link href={`/dashboard/construction/projects/${row.original.id}`}>عرض التفاصيل</Link>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ),
            },
        ],
        []
    );

    const table = useReactTable({
        data: filteredProjects || [],
        columns,
        state: {
            sorting,
        },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                                <TableHead key={header.id}>
                                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                </TableHead>
                            ))}
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
                            <TableRow key={row.id}>
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
                                لا توجد مشاريع مقاولات لعرضها.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
