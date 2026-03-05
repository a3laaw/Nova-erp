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
import { UserPlus, Calendar, MoreHorizontal, Trash2, Loader2, Search, RotateCcw, AlertTriangle, Users } from 'lucide-react';
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
  id: string; 
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
    employees.forEach(e => { if(e.id) newMap.set(e.id, e.fullName) });
    return newMap;
  }, [employees]);

  const prospectiveClients = useMemo(() => {
    if (!prospectiveAppointments) return [];
    const clientsMap = new Map<string, { appointments: Appointment[] }>();
    prospectiveAppointments.forEach(appt => {
      if (!appt.clientMobile) return;
      if (!clientsMap.has(appt.clientMobile)) clientsMap.set(appt.clientMobile, { appointments: [] });
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
        if (allCancelled) status = 'cancelled-visit';
        else if (lastAppointment.status === 'cancelled') {
           const nextLatestActive = sortedAppointments.find(a => a.status !== 'cancelled');
           if (nextLatestActive) {
                const nextLatestDate = toFirestoreDate(nextLatestActive.appointmentDate);
                if (nextLatestDate && isPast(nextLatestDate) && !nextLatestActive.workStageUpdated) status = 'no-show';
           } else status = 'cancelled-visit';
        }
        else if (isPast(lastAppointmentDate) && !lastAppointment.workStageUpdated) status = 'no-show';

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
        ? prospectiveClients.filter(client => client.name.toLowerCase().includes(searchQuery.toLowerCase()) || client.mobile.includes(searchQuery))
        : prospectiveClients;
      return filter === 'active' ? searchFiltered.filter(c => c.status !== 'cancelled-visit') : searchFiltered.filter(c => c.status === 'cancelled-visit');
  }, [prospectiveClients, searchQuery, filter]);

  const loading = appointmentsLoading || employeesLoading;
  
  const handleConfirmUnfollow = async () => {
    if (!clientToUnfollow || !firestore) return;
    setIsProcessing(true);
    try {
        const batch = writeBatch(firestore);
        const q = query(collection(firestore, 'appointments'), where('clientMobile', '==', clientToUnfollow.mobile));
        const snap = await getDocs(q);
        snap.forEach(doc => batch.update(doc.ref, { status: 'cancelled' }));
        await batch.commit();
        toast({ title: 'نجاح', description: `تم نقل العميل ${clientToUnfollow.name} إلى المتابعات الملغاة.` });
    } finally { setIsProcessing(false); setClientToUnfollow(null); }
  };

  return (
    <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white/50 p-4 rounded-[2rem] border shadow-inner">
            <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-40" />
                <Input
                    placeholder="ابحث بالاسم أو رقم الجوال..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-11 rounded-xl bg-white border-none shadow-sm font-bold"
                />
            </div>
            <div className="flex bg-muted p-1 rounded-2xl border shadow-inner">
                <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setFilter('active')}
                    className={cn("rounded-xl px-6 h-9 font-bold transition-all", filter === 'active' && "bg-white shadow-md text-primary")}
                >
                    متابعات نشطة
                </Button>
                <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setFilter('cancelled')}
                    className={cn("rounded-xl px-6 h-9 font-bold transition-all", filter === 'cancelled' && "bg-white shadow-md text-primary")}
                >
                    متابعات ملغاة
                </Button>
            </div>
        </div>

        <div className="border-2 rounded-[2rem] overflow-hidden shadow-xl bg-white">
            <Table>
                <TableHeader className="bg-[#F8F9FE]">
                    <TableRow className="border-none">
                        <TableHead className="px-8 py-5 font-black text-[#7209B7]">الاسم</TableHead>
                        <TableHead className="font-black text-[#7209B7]">الجوال</TableHead>
                        <TableHead className="font-black text-[#7209B7]">آخر تفاعل</TableHead>
                        <TableHead className="font-black text-[#7209B7]">الحالة</TableHead>
                        <TableHead className="text-center font-black text-[#7209B7]">الإجراء</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <TableRow key={i}><TableCell colSpan={5} className="px-8"><Skeleton className="h-6 w-full rounded-lg" /></TableCell></TableRow>
                        ))
                    ) : filteredClients.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="h-48 text-center text-muted-foreground font-bold">لا يوجد عملاء محتملون للمتابعة.</TableCell></TableRow>
                    ) : (
                        filteredClients.map(client => (
                            <TableRow key={client.id} className="hover:bg-[#F3E8FF]/20 group transition-colors h-20">
                                <TableCell className="px-8 font-black text-gray-800">{client.name}</TableCell>
                                <TableCell dir="ltr" className="text-right font-mono font-bold opacity-60">{client.mobile}</TableCell>
                                <TableCell>
                                    <div className="font-bold text-xs">{format(client.lastAppointmentDate, "PPP", { locale: ar })}</div>
                                    <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1"><Users className="h-2 w-2"/> {client.engineerName}</div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={cn("px-3 font-black text-[10px]", statusColors[client.status])}>
                                        {statusTranslations[client.status]}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl border group-hover:border-primary/20"><MoreHorizontal className="h-4 w-4" /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent dir="rtl" className="rounded-xl">
                                            <DropdownMenuLabel>إجراءات المتابعة</DropdownMenuLabel>
                                            <DropdownMenuItem asChild>
                                                <Link href={`/dashboard/appointments/new?nameAr=${encodeURIComponent(client.name)}&mobile=${encodeURIComponent(client.mobile)}&engineerId=${encodeURIComponent(client.engineerId)}`}>
                                                    <Calendar className="ml-2 h-4 w-4" /> حجز موعد جديد
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem asChild>
                                                <Link href={`/dashboard/clients/new?nameAr=${encodeURIComponent(client.name)}&mobile=${encodeURIComponent(client.mobile)}&engineerId=${encodeURIComponent(client.engineerId)}`}>
                                                    <UserPlus className="ml-2 h-4 w-4" /> تحويل إلى عميل رسمي
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            {filter === 'active' && <DropdownMenuItem className="text-orange-600" onClick={() => setClientToUnfollow(client)}><Trash2 className="ml-2 h-4 w-4" /> إلغاء المتابعة</DropdownMenuItem>}
                                            <DropdownMenuItem className="text-destructive" onClick={() => setClientToDelete(client)}><Trash2 className="ml-2 h-4 w-4" /> حذف نهائي</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>

        <AlertDialog open={!!clientToUnfollow} onOpenChange={() => setClientToUnfollow(null)}>
            <AlertDialogContent dir="rtl" className="rounded-3xl">
                <AlertDialogHeader>
                    <AlertDialogTitle>تأكيد إلغاء المتابعة</AlertDialogTitle>
                    <AlertDialogDescription>سيتم نقل العميل "{clientToUnfollow?.name}" إلى قائمة "المتابعات الملغاة".</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2">
                    <AlertDialogCancel className="rounded-xl">تراجع</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmUnfollow} disabled={isProcessing} className="bg-destructive hover:bg-destructive/90 rounded-xl font-bold">
                        {isProcessing ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : 'نعم، قم بالإلغاء'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
