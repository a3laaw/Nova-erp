
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
import { collection, doc, updateDoc, query, orderBy, type DocumentData, deleteDoc } from 'firebase/firestore';
import { useLanguage } from '@/context/language-context';
import { useFirestore, useCollection } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';


type ClientStatus = 'new' | 'received' | 'completed' | 'rejected';

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
  received: 'تم استلامها',
  completed: 'تم إنجازها',
  rejected: 'مرفوضة',
};

const statusColors: Record<ClientStatus, string> = {
  new: 'bg-blue-100 text-blue-800 border-blue-200',
  received: 'bg-green-100 text-green-800 border-green-200',
  completed: 'bg-lime-100 text-lime-800 border-lime-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
};

export default function ClientsPage() {
  const { language } = useLanguage();
  const firestore = useFirestore();
  const { toast } = useToast();

  const clientsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'clients'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const [snapshot, loading, error] = useCollection(clientsQuery);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const clients = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
  }, [snapshot]);


  const handleStatusChange = async (clientId: string, newStatus: ClientStatus) => {
    if (!firestore) return;
    const clientDoc = doc(firestore, 'clients', clientId);
    try {
      await updateDoc(clientDoc, { status: newStatus });
    } catch (e) {
      console.error("Error updating status: ", e);
      toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تحديث حالة الملف.' });
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
      confirmDelete: 'نعم، قم بالحذف'
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
      confirmDelete: 'Yes, delete'
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
                            onValueChange={(value) => handleStatusChange(client.id, value as ClientStatus)}
                            dir="rtl"
                          >
                            <SelectTrigger className="h-8 w-[140px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.keys(statusTranslations).map(key => (
                                <SelectItem key={key} value={key}>{statusTranslations[key as ClientStatus]}</SelectItem>
                              ))}
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
    </>
  );
}
