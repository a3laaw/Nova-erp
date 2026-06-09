'use client';
import { useState, useMemo, useCallback } from 'react';
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
import { UserPlus, Calendar, MoreHorizontal, Loader2, Search, Users, Archive, ArchiveRestore } from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
// Re-importing query, where, orderBy
import { collection, doc, updateDoc, serverTimestamp, query, where, orderBy, runTransaction } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import type { Client, Employee } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn, getTenantPath } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';

export function ProspectiveClientsList() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const tenantId = currentUser?.currentCompanyId;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [clientToUpdate, setClientToUpdate] = useState<{client: Client, status: 'inactive' | 'prospective'} | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [filter, setFilter] = useState<'prospective' | 'inactive'>('prospective');

  const clientsPath = useMemo(() => tenantId ? getTenantPath('clients', tenantId) : undefined, [tenantId]);
  const employeesPath = useMemo(() => tenantId ? getTenantPath('employees', tenantId): undefined, [tenantId]);

  // Using the new, efficient queries thanks to the index.
  const prospectiveQuery = useMemo(() => clientsPath ? query(collection(firestore!, clientsPath), where('status', '==', 'prospective'), orderBy('fileNumber', 'desc')) : undefined, [clientsPath, firestore]);
  const inactiveQuery = useMemo(() => clientsPath ? query(collection(firestore!, clientsPath), where('status', '==', 'inactive'), orderBy('fileNumber', 'desc')) : undefined, [clientsPath, firestore]);

  const { data: prospectiveClients, loading: prospectiveLoading } = useSubscription<Client>(firestore, prospectiveQuery);
  const { data: inactiveClients, loading: inactiveLoading } = useSubscription<Client>(firestore, inactiveQuery);
  const { data: employees, loading: employeesLoading } = useSubscription<Employee>(firestore, employeesPath);
  
  const engineersMap = useMemo(() => {
    const newMap = new Map<string, string>();
    (employees || []).forEach(e => { if(e.id) newMap.set(e.id, e.fullName) });
    return newMap;
  }, [employees]);

  const clients = useMemo(() => (filter === 'prospective' ? prospectiveClients : inactiveClients), [filter, prospectiveClients, inactiveClients]);

  const filteredClients = useMemo(() => {
      return searchQuery && clients
        ? clients.filter(client => client.nameAr.toLowerCase().includes(searchQuery.toLowerCase()) || client.mobile.includes(searchQuery))
        : clients;
  }, [clients, searchQuery]);

  const loading = prospectiveLoading || inactiveLoading || employeesLoading;
  
  const handleUpdateStatus = useCallback(async () => {
    if (!clientToUpdate || !firestore || !clientsPath) return;
    setIsProcessing(true);
    try {
        const clientRef = doc(firestore, clientsPath, clientToUpdate.client.id!)
        await updateDoc(clientRef, { 
          status: clientToUpdate.status,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser?.id,
        });
        toast({ title: 'نجاح', description: `تم تحديث حالة العميل.` });
    } catch (error) {
        console.error('Error updating client status:', error)
        toast({ variant: 'destructive', title: 'حدث خطأ', description: 'فشل تحديث الحالة' });
    } finally { 
        setIsProcessing(false); 
        setClientToUpdate(null); 
    }
  }, [clientToUpdate, firestore, clientsPath, toast, currentUser]);

  const handleConvertToActive = useCallback(async (client: Client) => {
    if (!firestore || !clientsPath) return;
    setIsProcessing(true);
    try {
        const clientRef = doc(firestore, clientsPath, client.id!)
        await updateDoc(clientRef, { 
          status: 'active',
          contractSignedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          updatedBy: currentUser?.id,
        });
        toast({ title: '🎉 تهانينا!', description: `تم نقل العميل ${client.nameAr} إلى قائمة العملاء المسجلين بنجاح.` });
    } catch (error) {
        console.error('Error converting client to active:', error)
        toast({ variant: 'destructive', title: 'حدث خطأ', description: 'فشل نقل العميل' });
    } finally { 
        setIsProcessing(false); 
    }
  }, [firestore, clientsPath, toast, currentUser]);


  const getActionDetails = () => {
    if (!clientToUpdate) return { title: '', description: '', buttonText: '' };
    return clientToUpdate.status === 'inactive'
      ? { title: 'تأكيد إلغاء المتابعة', description: `سيتم نقل العميل إلى قائمة المحذوفات. هل أنت متأكد؟`, buttonText: 'نعم، إلغاء المتابعة' }
      : { title: 'تأكيد استعادة المتابعة', description: `سيتم إعادة العميل إلى قائمة المتابعات النشطة. هل أنت متأكد؟`, buttonText: 'نعم، استعادة المتابعة' };
  }

  return (
    <div className="space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="relative w-full md:w-80">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                    placeholder="ابحث بالاسم أو رقم الجوال..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-10 h-10 rounded-lg bg-white shadow-sm font-medium border"
                />
            </div>
             <div className="flex bg-gray-100 p-1 rounded-lg border">
                <Button 
                    variant={filter === 'prospective' ? 'default' : 'ghost'} 
                    size="sm" 
                    onClick={() => setFilter('prospective')}
                    className={cn("rounded-md px-4 h-8 font-bold text-sm")}
                >
                    <Users className="ml-2 h-4 w-4"/>
                    عملاء محتملون
                </Button>
                <Button 
                    variant={filter === 'inactive' ? 'default' : 'ghost'} 
                    size="sm" 
                    onClick={() => setFilter('inactive')}
                    className={cn("rounded-md px-4 h-8 font-bold text-sm")}
                >
                    <Archive className="ml-2 h-4 w-4" />
                    متابعات ملغاة
                </Button>
            </div>
        </div>

        <div className="border rounded-lg overflow-hidden">
            <Table>
                <TableHeader className="bg-gray-50">
                    <TableRow>
                        <TableHead>رقم الملف</TableHead>
                        <TableHead>الاسم</TableHead>
                        <TableHead>المدينة</TableHead>
                        <TableHead>المهندس المسؤول</TableHead>
                        <TableHead>تاريخ الإضافة</TableHead>
                        <TableHead className="text-center">الإجراءات</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading || isProcessing ? (
                        Array.from({ length: 4 }).map((_, i) => (
                            <TableRow key={i}><TableCell colSpan={6}>{isProcessing ? <div className='flex items-center justify-center'><Loader2 className='h-5 w-5 animate-spin'/></div> : <Skeleton className="h-8 w-full" />}</TableCell></TableRow>
                        ))
                    ) : !filteredClients || filteredClients.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="h-32 text-center text-gray-500">لا يوجد عملاء لعرضهم.</TableCell></TableRow>
                    ) : (
                        filteredClients.map(client => (
                            <TableRow key={client.id} className="hover:bg-gray-50">
                                <TableCell className="font-mono text-sm">{client.fileNumber}</TableCell>
                                <TableCell className="font-semibold">{client.nameAr}</TableCell>
                                <TableCell className="text-sm text-gray-600">{(client as any).city || '-'}</TableCell>
                                <TableCell className="text-sm">{engineersMap.get(client.assignedEngineer) || 'غير محدد'}</TableCell>
                                <TableCell className="text-sm text-gray-600">{client.createdAt ? format(client.createdAt.toDate(), "P", { locale: ar }) : '-'}</TableCell>
                                <TableCell className="text-center">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent dir="rtl">
                                            <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                            <DropdownMenuItem onClick={() => handleConvertToActive(client)} className="text-green-600 focus:text-green-700">
                                                <UserPlus className="ml-2 h-4 w-4" /> توقيع عقد (نقل للمسجلين)
                                            </DropdownMenuItem>
                                            <DropdownMenuItem asChild>
                                                <Link href={`/dashboard/appointments?clientId=${client.id}`}>
                                                    <Calendar className="ml-2 h-4 w-4" /> حجز موعد جديد
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            {filter === 'prospective' ? (
                                                <DropdownMenuItem className="text-red-600 focus:text-red-700" onClick={() => setClientToUpdate({ client, status: 'inactive'})}>
                                                    <Archive className="ml-2 h-4 w-4" /> إلغاء المتابعة
                                                </DropdownMenuItem>
                                            ) : (
                                                <DropdownMenuItem onClick={() => setClientToUpdate({ client, status: 'prospective'})}>
                                                    <ArchiveRestore className="ml-2 h-4 w-4" /> إعادة تنشيط المتابعة
                                                </DropdownMenuItem>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>

        <AlertDialog open={!!clientToUpdate} onOpenChange={() => setClientToUpdate(null)}>
            <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                    <AlertDialogTitle>{getActionDetails().title}</AlertDialogTitle>
                    <AlertDialogDescription>{getActionDetails().description}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>تراجع</AlertDialogCancel>
                    <AlertDialogAction onClick={handleUpdateStatus} disabled={isProcessing} className={cn(clientToUpdate?.status === 'inactive' && 'bg-red-600 hover:bg-red-700')}>
                        {isProcessing ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : getActionDetails().buttonText}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
