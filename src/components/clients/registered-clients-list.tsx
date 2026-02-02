'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { MoreHorizontal, PlusCircle, Trash2, Loader2, Calendar } from 'lucide-react';
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
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { doc, deleteDoc, addDoc, collection, serverTimestamp, getDoc, runTransaction, query, orderBy, where, getDocs, writeBatch } from 'firebase/firestore';
import { useLanguage } from '@/context/language-context';
import { useFirebase } from '@/firebase';
import { useSubscription } from '@/hooks/use-subscription';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/auth-context';
import type { Client, Employee } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { searchClients } from '@/lib/cache/fuse-search';
import { ClientForm } from '@/components/clients/client-form';
import { cn } from '@/lib/utils';
import { useInfiniteScroll } from '@/lib/hooks/use-infinite-scroll';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';


type ClientStatus = 'new' | 'contracted' | 'cancelled' | 'reContracted';

interface ClientWithEmployee extends Client {
  assignedEngineerName?: string;
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

export function RegisteredClientsList() {
  const { language } = useLanguage();
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSavingClient, setIsSavingClient] = useState(false);
  
  const { items: clients, setItems: setClients, loading: clientsLoading, hasMore, loaderRef, loadingMore } = useInfiniteScroll<Client>('clients');
  const { data: employees, loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees');
  
  const loading = clientsLoading && clients.length === 0;

  const employeesMap = useMemo(() => {
      if (!employees) return new Map<string, string>();
      const newMap = new Map<string, string>();
      employees.forEach(emp => {
          newMap.set(emp.id!, emp.fullName);
      });
      return newMap;
  }, [employees]);

  const augmentedClients = useMemo(() => {
    if (!clients) return [];
    return clients.map(client => ({
        ...client,
        assignedEngineerName: client.assignedEngineer ? employeesMap.get(client.assignedEngineer) : undefined,
    }));
  }, [clients, employeesMap]);


  const filteredClients = useMemo(() => {
    return searchClients(augmentedClients, searchQuery);
  }, [augmentedClients, searchQuery]);

  const handleSaveClient = async (newClientData: Partial<Client>) => {
        if (!firestore || !currentUser) return;
        
        setIsSavingClient(true);
        let newClientId = '';

        try {
            if (newClientData.mobile) {
                const mobileQuery = query(collection(firestore, 'clients'), where('mobile', '==', newClientData.mobile));
                const mobileSnapshot = await getDocs(mobileQuery);
                if (!mobileSnapshot.empty) {
                    throw new Error('رقم الهاتف هذا مسجل بالفعل لعميل آخر.');
                }
                
                const prospectiveClientQuery = query(collection(firestore, 'appointments'), where('clientMobile', '==', newClientData.mobile));
                const prospectiveSnapshot = await getDocs(prospectiveClientQuery);
                if (!prospectiveSnapshot.empty) {
                    throw new Error('رقم الهاتف هذا مستخدم لموعد عميل محتمل. الرجاء إنشاء ملف العميل من داخل الموعد.');
                }
            }

            await runTransaction(firestore, async (transaction) => {
                const currentYear = String(new Date().getFullYear());
                const clientFileCounterRef = doc(firestore, 'counters', 'clientFiles');
                const clientFileCounterDoc = await transaction.get(clientFileCounterRef);
                
                let nextFileNumber = 1;
                if (clientFileCounterDoc.exists()) {
                    const counts = clientFileCounterDoc.data()?.counts || {};
                    nextFileNumber = (counts[currentYear] || 0) + 1;
                }
                
                transaction.set(clientFileCounterRef, { counts: { [currentYear]: nextFileNumber } }, { merge: true });
                const newFileId = `${nextFileNumber}/${currentYear}`;

                const finalClientData: Omit<Client, 'id'> = {
                  ...(newClientData as Omit<Client, 'id' | 'fileId' | 'fileNumber' | 'fileYear' | 'status' | 'createdAt' | 'isActive'>),
                  fileId: newFileId,
                  fileNumber: nextFileNumber,
                  fileYear: parseInt(currentYear, 10),
                  status: 'new',
                  transactionCounter: 0,
                  createdAt: serverTimestamp(),
                  isActive: true,
                };

                const newClientRef = doc(collection(firestore, 'clients'));
                newClientId = newClientRef.id;
                transaction.set(newClientRef, finalClientData);
            });

            toast({ title: 'نجاح', description: 'تمت إضافة العميل بنجاح.' });

            if (newClientData.assignedEngineer) {
                const targetUserId = await findUserIdByEmployeeId(firestore, newClientData.assignedEngineer);
                if (targetUserId && targetUserId !== currentUser.id) {
                    await createNotification(firestore, {
                        userId: targetUserId,
                        title: 'تم إسناد عميل جديد لك',
                        body: `قام ${currentUser.fullName} بإسناد العميل "${newClientData.nameAr}" إليك.`,
                        link: `/dashboard/clients/${newClientId}`
                    });
                }
            }
            
            setIsFormOpen(false);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'فشل إضافة العميل.';
            toast({ title: "خطأ", description: errorMessage, variant: "destructive" });
        } finally {
            setIsSavingClient(false);
        }
    };


  const handleDeleteClient = async () => {
        if (!clientToDelete || !firestore) return;
        setIsDeleting(true);
    
        try {
            const batch = writeBatch(firestore);
            
            const historySnapshot = await getDocs(collection(firestore, `clients/${clientToDelete.id}/history`));
            historySnapshot.forEach(doc => batch.delete(doc.ref));

            const transactionsSnapshot = await getDocs(collection(firestore, `clients/${clientToDelete.id}/transactions`));
            for (const txDoc of transactionsSnapshot.docs) {
                const timelineSnapshot = await getDocs(collection(firestore, `clients/${clientToDelete.id}/transactions/${txDoc.id}/timelineEvents`));
                timelineSnapshot.forEach(doc => batch.delete(doc.ref));
                batch.delete(txDoc.ref);
            }
            
            batch.delete(doc(firestore, 'clients', clientToDelete.id!));

            await batch.commit();

            toast({ title: 'نجاح', description: 'تم حذف العميل وكل بياناته بنجاح.' });
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
      addClient: 'إضافة عميل',
      fileNumber: 'رقم الملف',
      fullName: 'الاسم الكامل',
      assignedEngineer: 'المهندس المسؤول',
      mobile: 'رقم الجوال',
      status: 'الحالة',
      loading: 'جاري تحميل البيانات...',
      error: 'حدث خطأ أثناء جلب البيانات.',
      noClients: 'لا يوجد عملاء مسجلون حالياً.',
      actions: 'الإجراءات',
      viewProfile: 'عرض الملف',
      edit: 'تعديل',
      delete: 'حذف',
      deleteConfirmTitle: 'هل أنت متأكد؟',
      deleteConfirmDesc: 'سيتم حذف ملف العميل وجميع معاملاته وسجلاته بشكل دائم. لا يمكن التراجع عن هذا الإجراء.',
      cancel: 'إلغاء',
      confirmDelete: 'نعم، قم بالحذف',
      searchPlaceholder: 'ابحث بالاسم، رقم الملف، أو الجوال...'
    },
    en: {
        addClient: 'Add Client',
        fileNumber: 'File No.',
        fullName: 'Full Name',
        assignedEngineer: 'Assigned Engineer',
        mobile: 'Mobile',
        status: 'Status',
        loading: 'Loading data...',
        error: 'An error occurred while fetching data.',
        noClients: 'No registered clients yet.',
        actions: 'Actions',
        viewProfile: 'View Profile',
        edit: 'Edit',
        delete: 'Delete',
        deleteConfirmTitle: 'Are you sure?',
        deleteConfirmDesc: 'This will permanently delete the client file and all related data. This action cannot be undone.',
        cancel: 'Cancel',
        confirmDelete: 'Yes, delete',
        searchPlaceholder: 'Search by name, file no., or mobile...'
    }
  }
  const currentText = t[language];

  return (
    <>
      <div className="flex items-center justify-between">
          <Input
              placeholder={currentText.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
          />
          <Button onClick={() => setIsFormOpen(true)} size="sm" className="gap-1">
              <PlusCircle className="h-4 w-4" />
              {currentText.addClient}
          </Button>
      </div>
      <div className='border rounded-lg mt-4'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{currentText.fileNumber}</TableHead>
                <TableHead>{currentText.fullName}</TableHead>
                <TableHead>{currentText.assignedEngineer}</TableHead>
                <TableHead>{currentText.mobile}</TableHead>
                <TableHead>{currentText.status}</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={6}><Skeleton className="h-20 w-full" /></TableCell></TableRow>}
              {!loading && filteredClients.length === 0 && <TableRow><TableCell colSpan={6} className="text-center h-24">{searchQuery ? 'لا توجد نتائج مطابقة' : currentText.noClients}</TableCell></TableRow>}
              {filteredClients.map((client) => {
                return (
                    <TableRow key={client.id}>
                        <TableCell className="font-mono">{client.fileId}</TableCell>
                        <TableCell className="font-medium">
                            <Link href={`/dashboard/clients/${client.id}`} className="hover:underline">{client.nameAr}</Link>
                        </TableCell>
                        <TableCell>{client.assignedEngineerName || <span className="text-muted-foreground">غير مسند</span>}</TableCell>
                        <TableCell>{client.mobile}</TableCell>
                        <TableCell>
                            <Badge variant="outline" className={statusColors[client.status]}>
                                {statusTranslations[client.status]}
                            </Badge>
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
                )
              })}
            </TableBody>
          </Table>
          <div ref={loaderRef} className="flex justify-center p-4">
            {loadingMore && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
          </div>
        </div>

    <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl" dir="rtl">
            <DialogHeader>
                <DialogTitle>إضافة عميل جديد</DialogTitle>
                <DialogDescription>قم بتعبئة بيانات العميل الجديد لإنشاء ملف له في النظام.</DialogDescription>
            </DialogHeader>
            <ClientForm 
                onSave={handleSaveClient} 
                onClose={() => setIsFormOpen(false)}
                isSaving={isSavingClient}
            />
        </DialogContent>
    </Dialog>


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
