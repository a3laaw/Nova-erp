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
import { MoreHorizontal, Search, FileEdit, Eye } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore'; 
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/auth-context';
import type { Client, Employee } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { getTenantPath } from '@/lib/utils';

export function RegisteredClientsList() {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const tenantId = currentUser?.currentCompanyId;

    const [searchQuery, setSearchQuery] = useState('');

    const clientsPath = useMemo(() => tenantId ? getTenantPath('clients', tenantId) : undefined, [tenantId]);
    const employeesPath = useMemo(() => tenantId ? getTenantPath('employees', tenantId) : undefined, [tenantId]);

    const clientsQuery = useMemo(() => 
        clientsPath 
            ? query(
                collection(firestore!, clientsPath),
                where('status', 'in', ['active', 'contracted', 'reContracted']),
                orderBy('fileNumber', 'desc')
              )
            : undefined,
    [clientsPath, firestore]);

    const { data: clients, loading: clientsLoading } = useSubscription<Client>(firestore, clientsQuery);
    const { data: employees, loading: employeesLoading } = useSubscription<Employee>(firestore, employeesPath);
    
    const loading = clientsLoading || employeesLoading;

    const engineersMap = useMemo(() => {
        const newMap = new Map<string, string>();
        (employees || []).forEach(emp => { if (emp.id) newMap.set(emp.id, emp.fullName); });
        return newMap;
    }, [employees]);

    const filteredClients = useMemo(() => {
        if (!clients) return [];
        if (!searchQuery) return clients;

        return clients.filter(client => 
            (client.nameAr && client.nameAr.toLowerCase().includes(searchQuery.toLowerCase())) || 
            (client.fileNumber && client.fileNumber.toString().includes(searchQuery))
        );
    }, [clients, searchQuery]);

    return (
        <div className="space-y-4">
            <div className="flex justify-start">
                 <div className="relative w-full md:w-80">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="ابحث بالاسم أو رقم الملف..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pr-10 h-10 rounded-lg bg-white shadow-sm font-medium border"
                    />
                </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader className="bg-gray-50">
                        <TableRow>
                            <TableHead>رقم الملف</TableHead>
                            <TableHead>الاسم الكامل</TableHead>
                            <TableHead>المهندس المسؤول</TableHead>
                            <TableHead className="text-center">الإجراءات</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell>
                                </TableRow>
                            ))
                        ) : filteredClients.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-32 text-center text-gray-500">
                                    لا يوجد عملاء مسجلون حاليًا.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredClients.map((client) => (
                                <TableRow key={client.id} className="hover:bg-gray-50">
                                    <TableCell className="font-mono text-sm text-gray-600">{client.fileNumber}</TableCell>
                                    <TableCell className="font-semibold">
                                        <Link href={`/dashboard/clients/${client.id}`} className="hover:underline">
                                            {client.nameAr}
                                        </Link>
                                    </TableCell>
                                    <TableCell>{engineersMap.get((client as any).assignedEngineer) || 'غير محدد'}</TableCell>
                                    <TableCell className="text-center">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent dir="rtl" align="end">
                                                <DropdownMenuLabel>إجراءات الملف</DropdownMenuLabel>
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/dashboard/clients/${client.id}`}><Eye className="ml-2 h-4 w-4"/>عرض الملف</Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/dashboard/clients/edit/${client.id}`}><FileEdit className="ml-2 h-4 w-4"/>تعديل البيانات</Link>
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
