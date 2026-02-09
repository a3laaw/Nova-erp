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
import { UserPlus, Calendar, UserX, Repeat, MoreHorizontal, Trash2, Loader2 } from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, where, writeBatch, getDocs, doc } from 'firebase/firestore';
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
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch prospective appointments by checking for the existence of 'clientMobile'
  const prospectiveQuery = useMemo(() => [where('clientMobile', '>', '')], []);
  const { data: prospectiveAppointments, loading: appointmentsLoading } = useSubscription<Appointment>(firestore, 'appointments', prospectiveQuery);

  // Fetch all employees to map engineer IDs to names
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

        // Sort ALL appointments to find the most recent one
        const sortedAppointments = data.appointments.sort((a, b) => (toFirestoreDate(b.appointmentDate)?.getTime() || 0) - (toFirestoreDate(a.appointmentDate)?.getTime() || 0));
        const lastAppointment = sortedAppointments[0];
        
        const lastAppointmentDate = toFirestoreDate(lastAppointment.appointmentDate);
        if (!lastAppointmentDate) return; // Skip if date is invalid

        let status: ProspectiveClient['status'] = 'active-visit';
        if (lastAppointment.status === 'cancelled') {
            status = 'cancelled-visit';
        } else if (isPast(lastAppointmentDate) && !lastAppointment.workStageUpdated) {
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
      if (!searchQuery) return prospectiveClients;
      const lowercasedQuery = searchQuery.toLowerCase();
      return prospectiveClients.filter(
          client => client.name.toLowerCase().includes(lowercasedQuery) ||
          client.mobile.includes(lowercasedQuery)
      );
  }, [prospectiveClients, searchQuery]);

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

        toast({ title: 'نجاح', description: `تم إلغاء متابعة العميل ${clientToUnfollow.name}.` });
    } catch (error) {
        console.error("Error unfollowing client:", error);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل إلغاء المتابعة.' });
    } finally {
        setIsProcessing(false);
        setClientToUnfollow(null);
    }
  };


  return (
    <>
      <div className="space-y-4">
          <Input
              placeholder="ابحث بالاسم أو رقم الجوال..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
          />
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
                      {!loading && filteredClients.length === 0 && (
                           <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">لا يوجد عملاء محتملون حالياً.</TableCell>
                           </TableRow>
                      )}
                      {!loading && filteredClients.map(client => (
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
                                                حجز موعد جديد
                                             </Link>
                                          </DropdownMenuItem>
                                          <DropdownMenuItem asChild>
                                            <Link href={`/dashboard/clients/new?nameAr=${encodeURIComponent(client.name)}&mobile=${encodeURIComponent(client.mobile)}&engineerId=${encodeURIComponent(client.engineerId)}`}>
                                                <UserPlus className="ml-2 h-4 w-4" />
                                                تحويل إلى عميل
                                            </Link>
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleUnfollowClick(client)}>
                                              <Trash2 className="ml-2 h-4 w-4" />
                                              إلغاء المتابعة
                                          </DropdownMenuItem>
                                      </DropdownMenuContent>
                                  </DropdownMenu>
                              </TableCell>
                          </TableRow>
                      ))}
                  </TableBody>
              </Table>
          </div>
      </div>
      <AlertDialog open={!!clientToUnfollow} onOpenChange={() => setClientToUnfollow(null)}>
        <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
                <AlertDialogTitle>تأكيد إلغاء المتابعة</AlertDialogTitle>
                <AlertDialogDescription>
                    هل أنت متأكد من رغبتك في إلغاء متابعة العميل "{clientToUnfollow?.name}"؟ سيتم إلغاء جميع مواعيده وإخفاؤه من هذه القائمة.
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
    </>
  );
}
