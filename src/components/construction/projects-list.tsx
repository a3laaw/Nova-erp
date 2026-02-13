
'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '../ui/badge';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { ConstructionProject } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { format } from 'date-fns';
import { toFirestoreDate } from '@/services/date-converter';

const statusColors: Record<string, string> = {
    'مخطط': 'bg-yellow-100 text-yellow-800',
    'قيد التنفيذ': 'bg-blue-100 text-blue-800',
    'مكتمل': 'bg-green-100 text-green-800',
    'معلق': 'bg-gray-100 text-gray-800',
    'ملغى': 'bg-red-100 text-red-800',
};

export function ProjectsList() {
    const { firestore } = useFirebase();
    const projectsQuery = useMemo(() => {
        if (!firestore) return null;
        return [orderBy('createdAt', 'desc')];
    }, [firestore]);

    const { data: projects, loading } = useSubscription<ConstructionProject>(firestore, 'projects', projectsQuery || []);

    const formatDate = (dateValue: any) => {
        const date = toFirestoreDate(dateValue);
        return date ? format(date, 'dd/MM/yyyy') : '-';
    };

    return (
        <div className="border rounded-lg">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>اسم المشروع</TableHead>
                        <TableHead>العميل</TableHead>
                        <TableHead>تاريخ البدء</TableHead>
                        <TableHead>تاريخ الانتهاء المخطط</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead><span className="sr-only">الإجراءات</span></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading && Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell>
                        </TableRow>
                    ))}
                    {!loading && projects.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center">لا توجد مشاريع مقاولات حاليًا.</TableCell>
                        </TableRow>
                    )}
                    {!loading && projects.map((project) => (
                        <TableRow key={project.id}>
                            <TableCell className="font-medium">
                                <Link href={`/dashboard/construction/projects/${project.id}`} className="hover:underline text-primary">
                                    {project.projectName}
                                </Link>
                                <p className="text-xs text-muted-foreground font-mono">{project.projectId}</p>
                            </TableCell>
                            <TableCell>{project.clientName}</TableCell>
                            <TableCell>{formatDate(project.startDate)}</TableCell>
                            <TableCell>{formatDate(project.endDate)}</TableCell>
                            <TableCell>
                                <Badge variant="outline" className={statusColors[project.status] || ''}>
                                    {project.status}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button aria-haspopup="true" size="icon" variant="ghost">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" dir="rtl">
                                        <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                        <DropdownMenuItem asChild>
                                            <Link href={`/dashboard/construction/projects/${project.id}`}>عرض التفاصيل</Link>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
