'use client';
import { useState, useMemo, useEffect } from 'react';
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
import { UserPlus, Calendar, MoreHorizontal, Trash2, Loader2, Search, RotateCcw, AlertTriangle } from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, where, writeBatch, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import type { Appointment, Employee } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { format, isPast } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { useToast } from '@/hooks/use-toast';
import { toFirestoreDate } from '@/services/date-converter';

interface ProspectiveClient {
  id: string; // Using mobile as a unique ID for grouping
  name: string;
  mobile: string;
  engineerId: string;
  engineerName: string;
  lastAppointmentDate: Date;
  visitCount: number;
  status: 'active-visit' | 'no-show' | 'cancelled-visit';
}

const statusTranslations: Record<ProspectiveClient['status'], string> = {
    'active-visit': 'زيارة قادمة',
    'no-show': 'لم يحضر',
    'cancelled-visit': 'زيارة ملغاة'
};

const statusColors: Record<ProspectiveClient['status'], string> = {
    'active-visit': 'bg-blue-100 text-blue-800 border-blue-200',
    'no-show': 'bg-red-100 text-red-800 border-red-200',
    'cancelled-visit': 'bg-gray-100 text-gray-800 border-gray-200',
};


export function ProspectiveClientsList() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [clientToUnfollow, setClientToUnfollow] = useState<ProspectiveClient | null>(null);
  const [clientToDelete, setClientToDelete] = useState<ProspectiveClient | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [filter, setFilter] = useState<'active' | 'cancelled'>('active');

  const prospectiveQuery = useMemo(() => [where('clientMobile', '>', '')], []);
  const { data: prospectiveAppointments, loading: appointmentsLoading } = useSubscription<Appointment>(firestore, 'appointments', prospectiveQuery);

  const { data: employees, loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees');
  
  const engineersMap = useMemo(() => {
    if (!employees) return new Map();
    const newMap = new Map<string, string>();
    employees.forEach(e => {
        if(e.id) newMap.set(e.id, e.fullName)
    });
    return newMap;
  }, [employees]);

  const prospectiveClients = useMemo(() => {
    if (!prospectiveAppointments) return [];

    const clientsMap = new Map<string, { appointments: Appointment[] }>();

    prospectiveAppointments.forEach(appt => {
      if (!appt.clientMobile) return;

      if (!clientsMap.has(appt.clientMobile)) {
        clientsMap.set(appt.clientMobile, { appointments: [] });
      }
      clientsMap.get(appt.clientMobile)!.appointments.push(appt);
    });

    const result: ProspectiveClient[] = [];
    clientsMap.forEach((data, mobile) => {
        if (data.appointments.length === 0) return;

        const sortedAppointments = data.appointments.sort((a, b) => (toFirestoreDate(b.appointmentDate)?.getTime() || 0) - (toFirestoreDate(a.appointmentDate)?.getTime() || 0));
        const lastAppointment = sortedAppointments[0];
        
        const lastAppointmentDate = toFirestoreDate(lastAppointment.appointmentDate);
        if (!lastAppointmentDate) return; 

        let status: ProspectiveClient['status'] = 'active-visit';
        const allCancelled = data.appointments.every(a => a.status === 'cancelled');

        if (allCancelled) {
          status = 'cancelled-visit';
        } else if (lastAppointment.status === 'cancelled') {
           const nextLatestActive = sortedAppointments.find(a => a.status !== 'cancelled');
           if (nextLatestActive) {
                const nextLatestDate = toFirestoreDate(nextLatestActive.appointmentDate);
                if (nextLatestDate && isPast(nextLatestDate) && !nextLatestActive.workStageUpdated) {
                    status = 'no-show';
                }
           } else {
                status = 'cancelled-visit';
           }
        }
        else if (isPast(lastAppointmentDate) && !lastAppointment.workStageUpdated) {
            status = 'no-show';
        }

        result.push({
            id: mobile,
            name: lastAppointment.clientName || 'اسم غير معروف',
            mobile: mobile,
            engineerId: lastAppointment.engineerId,
            engineerName: engineersMap.get(lastAppointment.engineerId) || 'غير معروف',
            lastAppointmentDate: lastAppointmentDate,
            visitCount: data.appointments.filter(a => a.status !== 'cancelled').length,
            status,
        });
    });

    return result.sort((a,b) => b.lastAppointmentDate.getTime() - a.lastAppointmentDate.getTime());

  }, [prospectiveAppointments, engineersMap]);
  
  const filteredClients = useMemo(() => {
      const searchFiltered = searchQuery 
        ? prospectiveClients.filter(
            client => client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            client.mobile.includes(searchQuery)
          )
        : prospectiveClients;

      if (filter === 'active') {
          return searchFiltered.filter(c => c.status !== 'cancelled-visit');
      }
      return searchFiltered.filter(c => c.status === 'cancelled-visit');

  }, [prospectiveClients, searchQuery, filter]);

  const loading = appointmentsLoading || employeesLoading;
  
  const handleUnfollowClick = (client: ProspectiveClient) => {
    setClientToUnfollow(client);
  };

  const handleConfirmUnfollow = async () => {
    if (!clientToUnfollow || !firestore) return;

    setIsProcessing(true);
    try {
        const appointmentsRef = collection(firestore, 'appointments');
        const q = query(appointmentsRef, where('clientMobile', '==', clientToUnfollow.mobile));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            toast({ title: 'ملاحظة', description: 'لم يتم العثور على مواعيد مرتبطة لإلغائها.' });
            return;
        }

        const batch = writeBatch(firestore);
        querySnapshot.forEach(doc => {
            batch.update(doc.ref, { status: 'cancelled' });
        });
        await batch.commit();

        toast({ title: 'نجاح', description: `تم نقل العميل ${clientToUnfollow.name} إلى قائمة المتابعات الملغاة.` });
    } catch (error) {
        console.error("Error unfollowing client:", error);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل إلغاء المتابعة.' });
    } finally {
        setIsProcessing(false);
        setClientToUnfollow(null);
    }
  };

  const handleDeletePermanently = async () => {
    if (!clientToDelete || !firestore) return;

    setIsProcessing(true);
    try {
        const appointmentsRef = collection(firestore, 'appointments');
        const q = query(appointmentsRef, where('clientMobile', '==', clientToDelete.mobile));
        const querySnapshot = await getDocs(q);

        const batch = writeBatch(firestore);
        querySnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        toast({ title: 'تم الحذف', description: `تم حذف جميع سجلات العميل المحتمل ${clientToDelete.name} نهائياً.` });
    } catch (error) {
        console.error("Error deleting prospective client:", error);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف السجلات.' });
    } finally {
        setIsProcessing(false);
        setClientToDelete(null);
    }
  };


  return (
    <>
      <div className="space-y-4">
          <Tabs value={filter} onValueChange={(value) => setFilter(value as any)} dir="rtl">
            <div className="flex justify-between items-center mb-4">
                <TabsList className="grid grid-cols-2 w-fit">
                    <TabsTrigger value="active">متابعات نشطة</TabsTrigger>
                    <TabsTrigger value="cancelled">متابعات ملغاة</TabsTrigger>
                </TabsList>
                 <Input
                    placeholder="ابحث بالاسم أو رقم الجوال..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="max-w-sm"
                />
            </div>
            <TabsContent value="active">
                <ClientsTableView loading={loading} clients={filteredClients} onUnfollow={handleUnfollowClick} onDelete={setClientToDelete} />
            </TabsContent>
            <TabsContent value="cancelled">
                 <ClientsTableView loading={loading} clients={filteredClients} onUnfollow={handleUnfollowClick} onDelete={setClientToDelete} isCancelledView />
            </TabsContent>
          </Tabs>
      </div>

      <AlertDialog open={!!clientToUnfollow} onOpenChange={() => setClientToUnfollow(null)}>
        <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
                <AlertDialogTitle>تأكيد إلغاء المتابعة</AlertDialogTitle>
                <AlertDialogDescription>
                    سيتم نقل العميل "{clientToUnfollow?.name}" إلى قائمة "المتابعات الملغاة". يمكنك دائمًا إعادة متابعته من هناك.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={isProcessing}>تراجع</AlertDialogCancel>
                <AlertDialogAction
                    onClick={handleConfirmUnfollow}
                    disabled={isProcessing}
                    className="bg-destructive hover:bg-destructive/90"
                >
                    {isProcessing ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : 'نعم، قم بالإلغاء'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={!!clientToDelete} onOpenChange={() => setClientToDelete(null)}>
        <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    تأكيد الحذف النهائي
                </AlertDialogTitle>
                <AlertDialogDescription>
                    أنت على وشك حذف جميع سجلات المواعيد والمتابعات للعميل المحتمل <span className="font-bold text-foreground">"{clientToDelete?.name}"</span> نهائياً من النظام.
                    <br />
                    <span className="font-bold text-destructive">هذا الإجراء لا يمكن التراجع عنه.</span>
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={isProcessing}>تراجع</AlertDialogCancel>
                <AlertDialogAction
                    onClick={handleDeletePermanently}
                    disabled={isProcessing}
                    className="bg-destructive hover:bg-destructive/90"
                >
                    {isProcessing ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : 'نعم، احذف نهائياً'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}


function ClientsTableView({
    loading,
    clients,
    onUnfollow,
    onDelete,
    isCancelledView = false
}: {
    loading: boolean;
    clients: ProspectiveClient[];
    onUnfollow: (client: ProspectiveClient) => void;
    onDelete: (client: ProspectiveClient) => void;
    isCancelledView?: boolean;
}) {
  return (
    <div className="border rounded-lg">
      <Table>
          <TableHeader>
              <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>الجوال</TableHead>
                  <TableHead>آخر تفاعل</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead className="text-center">الإجراء</TableHead>
              </TableRow>
          </TableHeader>
          <TableBody>
              {loading && Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                      <TableCell colSpan={5}><Skeleton className="h-6 w-full" /></TableCell>
                  </TableRow>
              ))}
              {!loading && clients.length === 0 && (
                   <TableRow>
                       <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                           {isCancelledView ? 'لا يوجد عملاء ملغاة متابعتهم.' : 'لا يوجد عملاء محتملون للمتابعة.'}
                        </TableCell>
                   </TableRow>
              )}
              {!loading && clients.map(client => (
                  <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell dir="ltr" className="text-left">{client.mobile}</TableCell>
                      <TableCell>
                          <div>{format(client.lastAppointmentDate, "PPP", { locale: ar })}</div>
                          <div className="text-xs text-muted-foreground">{client.engineerName}</div>
                      </TableCell>
                       <TableCell>
                        <Badge variant="outline" className={cn(statusColors[client.status])}>
                            {statusTranslations[client.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                          <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent dir="rtl">
                                  <DropdownMenuLabel>إجراءات المتابعة</DropdownMenuLabel>
                                  <DropdownMenuItem asChild>
                                     <Link href={`/dashboard/appointments/new?nameAr=${encodeURIComponent(client.name)}&mobile=${encodeURIComponent(client.mobile)}&engineerId=${encodeURIComponent(client.engineerId)}`}>
                                        <Calendar className="ml-2 h-4 w-4" />
                                        {isCancelledView ? 'حجز موعد جديد (إعادة متابعة)' : 'حجز موعد جديد'}
                                     </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem asChild>
                                    <Link href={`/dashboard/clients/new?nameAr=${encodeURIComponent(client.name)}&mobile=${encodeURIComponent(client.mobile)}&engineerId=${encodeURIComponent(client.engineerId)}`}>
                                        <UserPlus className="ml-2 h-4 w-4" />
                                        تحويل إلى عميل
                                    </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  {!isCancelledView && (
                                      <DropdownMenuItem className="text-orange-600 focus:text-orange-700" onClick={() => onUnfollow(client)}>
                                          <Trash2 className="ml-2 h-4 w-4" />
                                          إلغاء المتابعة
                                      </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => onDelete(client)}>
                                      <Trash2 className="ml-2 h-4 w-4" />
                                      حذف نهائي
                                  </DropdownMenuItem>
                              </DropdownMenuContent>
                          </DropdownMenu>
                      </TableCell>
                  </TableRow>
              ))}
          </TableBody>
      </Table>
  </div>
  )
}