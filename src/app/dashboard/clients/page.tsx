'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, PlusCircle, Trash2 } from 'lucide-react';
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
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { collection, doc, updateDoc, query, orderBy, type DocumentData, deleteDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { useLanguage } from '@/context/language-context';
import { useFirestore, useCollection } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/auth-context';


type ClientStatus = 'new' | 'contracted' | 'cancelled' | 'reContracted';

interface Client extends DocumentData {
  id: string;
  fileId: string;
  nameAr: string;
  nameEn?: string;
  mobile: string;
  status: ClientStatus;
}

const statusTranslations: Record<ClientStatus, string> = {
  new: 'جديد',
  contracted: 'تم التعاقد',
  cancelled: 'ملغي',
  reContracted: 'معاد تعاقده',
};

const statusColors: Record<ClientStatus, string> = {
  new: 'bg-blue-100 text-blue-800 border-blue-200',
  contracted: 'bg-purple-100 text-purple-800 border-purple-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
  reContracted: 'bg-yellow-100 text-yellow-800 border-yellow-200',
};

const isStatusChangeDisabled = (targetStatus: ClientStatus, currentStatus: ClientStatus): boolean => {
    if (targetStatus === currentStatus) return true;

    switch (currentStatus) {
        case 'new':
            return !['contracted', 'cancelled'].includes(targetStatus);
        case 'contracted':
            return targetStatus !== 'cancelled';
        case 'cancelled':
            return targetStatus !== 'reContracted';
        case 'reContracted':
            return targetStatus !== 'cancelled';
        default:
            return true;
    }
};

export default function ClientsPage() {
  const { language } = useLanguage();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const clientsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'clients'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const [snapshot, loading, error] = useCollection(clientsQuery);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [statusChangeInfo, setStatusChangeInfo] = useState<{ client: Client; newStatus: ClientStatus } | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  
  const clients = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
  }, [snapshot]);


  const handleConfirmStatusChange = async () => {
    if (!statusChangeInfo || !firestore || !currentUser) return;
    setIsUpdatingStatus(true);
    
    const { client, newStatus } = statusChangeInfo;
    const clientRef = doc(firestore, 'clients', client.id);
    const historyCollectionRef = collection(firestore, `clients/${client.id}/history`);
    
    const batch = writeBatch(firestore);

    batch.update(clientRef, { status: newStatus });

    const logContent = `قام بتغيير حالة الملف من "${statusTranslations[client.status]}" إلى "${statusTranslations[newStatus]}".`;
    batch.set(doc(historyCollectionRef), {
        type: 'log',
        content: logContent,
        userId: currentUser.id,
        userName: currentUser.fullName,
        userAvatar: currentUser.avatarUrl,
        createdAt: serverTimestamp(),
    });

    try {
      await batch.commit();
      toast({ title: 'نجاح', description: 'تم تحديث حالة الملف بنجاح.' });
    } catch (e) {
      console.error("Error updating status: ", e);
      toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تحديث حالة الملف.' });
    } finally {
      setIsUpdatingStatus(false);
      setStatusChangeInfo(null);
    }
  };
  
  const handleDeleteClient = async () => {
    if (!clientToDelete || !firestore) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(firestore, 'clients', clientToDelete.id));
      toast({ title: 'نجاح', description: 'تم حذف العميل بنجاح.' });
    } catch (e) {
      console.error("Error deleting client: ", e);
      toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف العميل.' });
    } finally {
      setIsDeleting(false);
      setClientToDelete(null);
    }
  };
  
  const t = {
    ar: {
      title: 'إدارة العملاء',
      description: 'عرض وتحديث حالات ملفات العملاء.',
      addClient: 'إضافة عميل',
      fileNumber: 'رقم الملف',
      fullName: 'الاسم الكامل',
      mobile: 'رقم الجوال',
      status: 'الحالة',
      loading: 'جاري تحميل البيانات...',
      error: 'حدث خطأ أثناء جلب البيانات.',
      noClients: 'لا يوجد عملاء لعرضهم حالياً.',
      actions: 'الإجراءات',
      viewProfile: 'عرض الملف',
      edit: 'تعديل',
      delete: 'حذف',
      deleteConfirmTitle: 'هل أنت متأكد؟',
      deleteConfirmDesc: 'سيتم حذف ملف العميل بشكل دائم. لا يمكن التراجع عن هذا الإجراء.',
      cancel: 'إلغاء',
      confirmDelete: 'نعم، قم بالحذف',
      statusConfirmTitle: 'تأكيد تغيير الحالة',
      statusConfirmDesc: (clientName: string, from: string, to: string) => `هل أنت متأكد من رغبتك في تغيير حالة ملف العميل "${clientName}" من "${from}" إلى "${to}"؟ سيتم تسجيل هذا الإجراء في سجل العميل.`,
      confirmStatusChange: 'نعم، قم بالتغيير',
      updating: 'جاري التحديث...'
    },
    en: {
      title: 'Client Management',
      description: 'View and update client file statuses.',
      addClient: 'Add Client',
      fileNumber: 'File Number',
      fullName: 'Full Name',
      mobile: 'Mobile',
      status: 'Status',
      loading: 'Loading data...',
      error: 'An error occurred while fetching data.',
      noClients: 'No clients to display at the moment.',
      actions: 'Actions',
      viewProfile: 'View Profile',
      edit: 'Edit',
      delete: 'Delete',
      deleteConfirmTitle: 'Are you sure?',
      deleteConfirmDesc: 'This will permanently delete the client file. This action cannot be undone.',
      cancel: 'Cancel',
      confirmDelete: 'Yes, delete',
      statusConfirmTitle: 'Confirm Status Change',
      statusConfirmDesc: (clientName: string, from: string, to: string) => `Are you sure you want to change the status for "${clientName}" from "${from}" to "${to}"? This action will be logged.`,
      confirmStatusChange: 'Yes, change',
      updating: 'Updating...'
    }
  }
  const currentText = t[language];


  return (
    <>
    <Card dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{currentText.title}</CardTitle>
            <CardDescription>{currentText.description}</CardDescription>
          </div>
          <div className="flex gap-2">
             <Button asChild size="sm" className="gap-1">
                <Link href="/dashboard/clients/new">
                    <PlusCircle className="h-4 w-4" />
                    {currentText.addClient}
                </Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{currentText.fileNumber}</TableHead>
                <TableHead>{currentText.fullName}</TableHead>
                <TableHead>{currentText.mobile}</TableHead>
                <TableHead>{currentText.status}</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
              ))}
              {error && <TableRow><TableCell colSpan={5} className="text-center text-destructive">{currentText.error}</TableCell></TableRow>}
              {!loading && clients.length === 0 && <TableRow><TableCell colSpan={5} className="text-center h-24">{currentText.noClients}</TableCell></TableRow>}
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-mono">{client.fileId || client.id.substring(0, 8)}</TableCell>
                  <TableCell className="font-medium"><Link href={`/dashboard/clients/${client.id}`} className="hover:underline">{client.nameAr}</Link></TableCell>
                  <TableCell>{client.mobile}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className={statusColors[client.status]}>
                            {statusTranslations[client.status]}
                        </Badge>
                         <Select
                            value={client.status}
                            onValueChange={(newStatus) => {
                                if (client.status !== newStatus && !isStatusChangeDisabled(newStatus as ClientStatus, client.status)) {
                                    setStatusChangeInfo({ client, newStatus: newStatus as ClientStatus });
                                }
                            }}
                            dir="rtl"
                          >
                            <SelectTrigger className="h-8 w-[140px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.keys(statusTranslations).map(key => {
                                const targetStatus = key as ClientStatus;
                                return (
                                    <SelectItem key={key} value={key} disabled={isStatusChangeDisabled(targetStatus, client.status)}>
                                        {statusTranslations[targetStatus]}
                                    </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Toggle menu</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                            <DropdownMenuLabel>{currentText.actions}</DropdownMenuLabel>
                            <DropdownMenuItem asChild>
                                <Link href={`/dashboard/clients/${client.id}`}>{currentText.viewProfile}</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href={`/dashboard/clients/${client.id}/edit`}>{currentText.edit}</Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => setClientToDelete(client)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                {currentText.delete}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>

    <AlertDialog open={!!clientToDelete} onOpenChange={(open) => !open && setClientToDelete(null)}>
        <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
                <AlertDialogTitle>{currentText.deleteConfirmTitle}</AlertDialogTitle>
                <AlertDialogDescription>
                    {currentText.deleteConfirmDesc}
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>{currentText.cancel}</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteClient} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                    {isDeleting ? 'جاري الحذف...' : currentText.confirmDelete}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={!!statusChangeInfo} onOpenChange={(open) => !open && setStatusChangeInfo(null)}>
        <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
                <AlertDialogTitle>{currentText.statusConfirmTitle}</AlertDialogTitle>
                <AlertDialogDescription>
                    {statusChangeInfo && currentText.statusConfirmDesc(statusChangeInfo.client.nameAr, statusTranslations[statusChangeInfo.client.status], statusTranslations[statusChangeInfo.newStatus])}
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={isUpdatingStatus}>{currentText.cancel}</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmStatusChange} disabled={isUpdatingStatus}>
                    {isUpdatingStatus ? currentText.updating : currentText.confirmStatusChange}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
