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
import { MoreHorizontal, ArrowUpDown, Pencil, FolderLock, FolderOpen, Trash2, Loader2, User } from 'lucide-react';
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
            console.error("Failed to update status:", error);
            toast({ variant: 'destructive', title: 'خطأ' });
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
                description: `تم حذف المشروع بنجاح.`
            });
        } catch (error) {
            console.error("Failed to delete project:", error);
            toast({ variant: 'destructive', title: 'خطأ' });
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
                cell: ({ row }) => <div className="font-mono text-xs">{row.original.projectId}</div>,
            },
            {
                accessorKey: 'projectName',
                header: 'المشروع والمالك',
                cell: ({ row }) => (
                    <div className="flex flex-col gap-1">
                        <Link href={`/dashboard/construction/projects/${row.original.id}`} className="font-black hover:underline text-primary text-base">
                            {row.original.projectName}
                        </Link>
                        <div className="flex items-center gap-1.5">
                            <User className="h-3 w-3 text-muted-foreground opacity-40"/>
                            {row.original.clientId ? (
                                <Link href={`/dashboard/clients/${row.original.clientId}`} className='text-[11px] font-bold text-slate-500 hover:text-primary transition-colors'>
                                    {row.original.clientName}
                                </Link>
                            ) : (
                                <span className="text-[11px] font-bold text-slate-500">{row.original.clientName}</span>
                            )}
                        </div>
                    </div>
                )
            },
            {
                accessorKey: 'startDate',
                header: 'تاريخ البدء',
                cell: ({ row }) => formatDate(row.original.startDate),
            },
            {
                accessorKey: 'status',
                header: 'الحالة',
                cell: ({ row }) => <Badge variant="outline" className={cn("px-3 font-black text-[10px]", statusColors[row.original.status] || '')}>{row.original.status}</Badge>,
            },
            {
                accessorKey: 'progressPercentage',
                header: 'نسبة الإنجاز',
                cell: ({ row }) => (
                    <div className="flex items-center gap-3 w-40">
                        <Progress value={row.original.progressPercentage} className="h-1.5 flex-1" />
                        <span className="text-[10px] font-black font-mono text-primary">{row.original.progressPercentage}%</span>
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
                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl border" disabled={isProcessing}>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" dir="rtl" className="rounded-xl p-2 shadow-2xl border-none bg-white">
                                <DropdownMenuLabel className="font-black px-3 py-2 text-xs text-slate-400 uppercase">إدارة المشروع</DropdownMenuLabel>
                                <DropdownMenuItem asChild className="rounded-lg py-3 font-bold gap-3">
                                    <Link href={`/dashboard/construction/projects/${project.id}`}>
                                        <Eye className="h-4 w-4 text-primary"/> فتح المسار الفني
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild className="rounded-lg py-3 font-bold gap-3">
                                     <Link href={`/dashboard/construction/projects/${project.id}/edit`}>
                                        <Pencil className="h-4 w-4 text-primary" /> تعديل البيانات
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-slate-100" />
                                <DropdownMenuItem onClick={() => handleToggleStatus(project)} className="rounded-lg py-3 font-bold gap-3">
                                    {project.status === 'معلق' ? <FolderOpen className="ml-2 h-4 w-4 text-green-600" /> : <FolderLock className="ml-2 h-4 w-4 text-orange-600" />}
                                    {project.status === 'معلق' ? 'إلغاء التعليق' : 'تعليق المشروع'}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-slate-100" />
                                <DropdownMenuItem 
                                    onClick={() => setProjectToDelete(project)} 
                                    className="text-red-600 font-black rounded-lg py-3 gap-3 focus:bg-red-50"
                                >
                                    <Trash2 className="ml-2 h-4 w-4" /> حذف نهائي
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )
                },
            },
        ],
        [isProcessing, firestore, toast]
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
            <div className="border-2 rounded-[2rem] overflow-hidden shadow-sm">
                <Table>
                    <TableHeader className="bg-muted/50 h-14">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id} className="border-none">
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id} className="font-black">
                                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <TableRow key={i}><TableCell colSpan={columns.length} className="p-8"><Skeleton className="h-10 w-full rounded-2xl" /></TableCell></TableRow>
                            ))
                        ) : table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id} className="h-20 hover:bg-muted/5 transition-colors border-b last:border-0 group">
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-48 text-center text-muted-foreground font-black italic">
                                    لا توجد مشاريع مقاولات نشطة حالياً.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <AlertDialog open={!!projectToDelete} onOpenChange={() => setProjectToDelete(null)}>
                <AlertDialogContent dir="rtl" className="rounded-[2.5rem] p-10 border-none shadow-2xl">
                    <AlertDialogHeader>
                        <div className="p-3 bg-red-100 rounded-2xl text-red-600 w-fit mb-4 shadow-inner"><Trash2 className="h-10 w-10"/></div>
                        <AlertDialogTitle className="text-2xl font-black text-red-700 tracking-tighter">تأكيد حذف المشروع؟</AlertDialogTitle>
                        <AlertDialogDescription className="text-lg font-medium leading-relaxed mt-2">سيتم مسح كافة البيانات الفنية، مراحل الإنجاز الميداني، والارتباط بجدول الكميات لـ "{projectToDelete?.projectName}" نهائياً.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-8 gap-3">
                        <AlertDialogCancel className="rounded-xl font-bold h-12 px-8 border-2">إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={isProcessing} className="bg-red-600 hover:bg-red-700 rounded-xl font-black h-12 px-12 shadow-xl shadow-red-200">
                            {isProcessing ? <Loader2 className="animate-spin h-4 w-4"/> : 'نعم، حذف نهائي'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
