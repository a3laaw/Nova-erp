'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, PlusCircle, Trash2, Loader2, X, Search, User } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { doc, deleteDoc, collection, serverTimestamp, runTransaction, query, where, getDocs } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import { useSubscription } from '@/hooks/use-subscription';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/auth-context';
import type { Client, Employee } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { searchClients } from '@/lib/cache/fuse-search';
import { ClientForm } from '@/components/clients/client-form';
import { useInfiniteScroll } from '@/lib/hooks/use-infinite-scroll';
import { cn, getTenantPath, cleanFirestoreData } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

// ... (باقي التعريفات statusTranslations و statusColors كما هي في كودك الأصلي)

export function RegisteredClientsList() {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    
    const [searchQuery, setSearchQuery] = useState('');
    const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isSavingClient, setIsSavingClient] = useState(false);
    
    const tenantId = currentUser?.currentCompanyId;
    
    const { items: clients, loading: clientsLoading, loaderRef, loadingMore } = useInfiniteScroll<Client>('clients');
    const { data: employees } = useSubscription<Employee>(firestore, 'employees');
    
    const loading = clientsLoading && clients.length === 0;

    const augmentedClients = useMemo(() => {
        const employeesMap = new Map<string, string>();
        (employees || []).forEach(emp => { if (emp.id) employeesMap.set(emp.id, emp.fullName); });
        return clients.map(client => ({
            ...client,
            assignedEngineerName: client.assignedEngineer ? employeesMap.get(client.assignedEngineer) : undefined,
        }));
    }, [clients, employees]);

    const filteredClients = useMemo(() => searchClients(augmentedClients, searchQuery), [augmentedClients, searchQuery]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-[#F8F9FE] p-4 rounded-[2rem] border shadow-inner">
                <Input placeholder="بحث..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-80" />
                <Button onClick={() => setIsFormOpen(true)}><PlusCircle className="ml-2" /> إضافة عميل جديد</Button>
            </div>

            <div className="border-2 rounded-[2rem] overflow-hidden shadow-xl bg-white">
                <Table>
                    <TableHeader className="bg-[#F8F9FE]">
                        <TableRow>
                            <TableHead>رقم الملف</TableHead>
                            <TableHead>الاسم الكامل</TableHead>
                            <TableHead>المهندس المسؤول</TableHead>
                            <TableHead className="text-center">إجراء</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredClients.map((client) => (
                            <TableRow key={client.id} className="hover:bg-[#F3E8FF]/20">
                                <TableCell>{client.fileId}</TableCell>
                                <TableCell>
                                    <Link href={`/companies/${tenantId}/clients/${client.id}`} className="font-black text-gray-800 hover:underline">
                                        {client.nameAr}
                                    </Link>
                                </TableCell>
                                <TableCell>{client.assignedEngineerName}</TableCell>
                                <TableCell className="text-center">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon"><MoreHorizontal /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" dir="rtl">
                                            <DropdownMenuLabel>إجراءات الملف</DropdownMenuLabel>
                                            {/* هنا الروابط المكتملة */}
                                            <DropdownMenuItem asChild>
                                                <Link href={`/companies/${tenantId}/clients/${client.id}`}>عرض الملف</Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem asChild>
                                                <Link href={`/companies/${tenantId}/clients/${client.id}/edit`}>تعديل</Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="text-destructive" onClick={() => setClientToDelete(client)}>
                                                <Trash2 className="ml-2 h-4 w-4" /> حذف نهائي
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* الحوارات (Dialog & AlertDialog) كما هي في كودك الأصلي تماماً */}
        </div>
    );
}