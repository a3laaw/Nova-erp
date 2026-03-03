'use client';

import * as React from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
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
import { MoreHorizontal, ArrowUpDown, Pencil, FolderLock, FolderOpen, Trash2, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { doc, orderBy, query, updateDoc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
    const { toast } = useToast();
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [isProcessing, setIsProcessing] = React.useState(false);
    const [projectToDelete, setProjectToDelete] = React.useState<ConstructionProject | null>(null);

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

    const handleToggleStatus = async (project: ConstructionProject) => {
        if (!firestore) return;
        setIsProcessing(true);
        const newStatus = project.status === 'معلق' ? 'قيد التنفيذ' : 'معلق';
        try {
            const projectRef = doc(firestore, 'projects', project.id!);
            await updateDoc(projectRef, { status: newStatus });
            toast({
                title: 'نجاح',
                description: `تم تغيير حالة المشروع إلى "${newStatus}".`
            });
        } catch (error) {
            console.error("Failed to toggle project status:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تحديث حالة المشروع.' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDelete = async () => {
        if (!firestore || !projectToDelete) return;
        setIsProcessing(true);
        try {
            await deleteDoc(doc(firestore, 'projects', projectToDelete.id!));
            toast({
                title: 'تم الحذف',
                description: `تم حذف المشروع "${projectToDelete.projectName}" بنجاح.`
            });
        } catch (error) {
            console.error("Failed to delete project:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف المشروع.' });
        } finally {
            setIsProcessing(false);
            setProjectToDelete(null);
        }
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
                accessorKey: 'projectCategory',
                header: 'الفئة',
                cell: ({ row }) => <Badge variant="outline">{row.original.projectCategory === 'Private (Subsidized)' ? 'مدعوم' : 'تجاري'}</Badge>,
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
                cell: ({ row }) => {
                    const project = row.original;
                    return (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0" disabled={isProcessing}>
                                    <span className="sr-only">فتح القائمة</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" dir="rtl">
                                <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                <DropdownMenuItem asChild>
                                    <Link href={`/dashboard/construction/projects/${project.id}`}>عرض التفاصيل</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                     <Link href={`/dashboard/construction/projects/${project.id}/edit`}>
                                        <Pencil className="ml-2 h-4 w-4" />
                                        تعديل
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleToggleStatus(project)}>
                                    {project.status === 'معلق' ? <FolderOpen className="ml-2 h-4 w-4" /> : <FolderLock className="ml-2 h-4 w-4" />}
                                    {project.status === 'معلق' ? 'إلغاء التعليق' : 'تعليق المشروع'}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                    onClick={() => setProjectToDelete(project)} 
                                    className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                >
                                    <Trash2 className="ml-2 h-4 w-4" />
                                    حذف المشروع
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )
                },
            },
        ],
        [isProcessing]
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
        <>
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

            <AlertDialog open={!!projectToDelete} onOpenChange={() => setProjectToDelete(null)}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد حذف المشروع؟</AlertDialogTitle>
                        <AlertDialogDescription>
                            هل أنت متأكد من رغبتك في حذف المشروع "{projectToDelete?.projectName}"؟ 
                            سيؤدي هذا إلى حذف كافة البيانات الفنية والهيكل المرتبط بالمشروع بشكل نهائي. 
                            لا يمكن التراجع عن هذا الإجراء.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isProcessing}>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={isProcessing} className="bg-destructive hover:bg-destructive/90">
                            {isProcessing ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : 'نعم، قم بالحذف'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}