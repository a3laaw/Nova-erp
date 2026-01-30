'use client';
import { useState, useMemo, useEffect, useCallback } from 'react';
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
import { MoreHorizontal, PlusCircle, Trash2, RefreshCw, Loader2 } from 'lucide-react';
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
import { doc, deleteDoc, addDoc, collection, serverTimestamp, getDoc, runTransaction } from 'firebase/firestore';
import { useLanguage } from '@/context/language-context';
import { useFirebase } from '@/firebase';
import { useSubscription } from '@/hooks/use-subscription';
import { SmartCache } from '@/lib/cache/smart-cache';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/auth-context';
import type { Client, Employee } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { searchClients } from '@/lib/cache/fuse-search';
import { ClientForm } from '@/components/clients/client-form';
import { cn } from '@/lib/utils';


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

export default function ClientsPage() {
  const { language } = useLanguage();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const { data: clients, setData: setClients, loading: clientsLoading, error: clientsError } = useSubscription<Client>(firestore, 'clients');
  const { data: employees, loading: employeesLoading, error: employeesError } = useSubscription<Employee>(firestore, 'employees');
  
  const loading = clientsLoading || employeesLoading;
  const error = clientsError || employeesError;

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
    
    const getSafeTimestamp = (date: any): number => {
      if (!date) return 0;
      if (typeof date.toMillis === 'function') {
        return date.toMillis();
      }
      return new Date(date).getTime();
    };

    return clients.map(client => ({
        ...client,
        assignedEngineerName: client.assignedEngineer ? employeesMap.get(client.assignedEngineer) : undefined,
    })).sort((a, b) => getSafeTimestamp(b.createdAt) - getSafeTimestamp(a.createdAt));
  }, [clients, employeesMap]);


  const filteredClients = useMemo(() => {
    return searchClients(augmentedClients, searchQuery);
  }, [augmentedClients, searchQuery]);

  const handleSaveClient = async (newClientData: Partial<Client>) => {
    if (!firestore) return;
    const tempId = `optimistic-${Date.now()}`;
    const optimisticClient: Client = {
      id: tempId,
      ...newClientData,
      nameAr: newClientData.nameAr || '',
      mobile: newClientData.mobile || '',
      fileId: '...',
      fileNumber: 0,
      fileYear: 0,
      status: 'new',
      createdAt: new Date(),
      isActive: true,
    };
    
    setClients(prev => [optimisticClient, ...prev]);
    setIsFormOpen(false);

    try {
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

            const finalClientData = {
              ...newClientData,
              fileId: newFileId,
              fileNumber: nextFileNumber,
              fileYear: parseInt(currentYear, 10),
              status: 'new' as const,
              transactionCounter: 0,
              createdAt: serverTimestamp(),
              isActive: true,
            };

            const newClientRef = doc(collection(firestore, 'clients'));
            transaction.set(newClientRef, finalClientData);
        });

      toast({ title: 'نجاح', description: 'تمت إضافة العميل بنجاح.' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'فشل إضافة العميل.';
      toast({ title: "خطأ", description: errorMessage, variant: "destructive" });
      setClients(prev => prev.filter(c => c.id !== tempId));
    }
  };


  const handleDeleteClient = async () => {
    if (!clientToDelete || !firestore) return;

    setIsDeleting(true);
    const originalClients = [...clients];
    
    setClients(prev => prev.filter(c => c.id !== clientToDelete.id));
    setClientToDelete(null);

    try {
      await deleteDoc(doc(firestore, 'clients', clientToDelete.id!));
      toast({ title: 'نجاح', description: 'تم حذف العميل بنجاح.' });
    } catch (e) {
      setClients(originalClients);
      console.error("Error deleting client: ", e);
      toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف العميل. تم التراجع عن التغيير.' });
    } finally {
      setIsDeleting(false);
    }
  };
  
  const refreshData = useCallback(async () => {
    toast({ title: 'تحديث البيانات...', description: 'جاري إعادة المزامنة من الخادم.' });
    await SmartCache.invalidate('clients');
    await SmartCache.invalidate('employees');
  }, []);

  const t = {
    ar: {
      title: 'إدارة العملاء',
      description: 'عرض وتحديث حالات ملفات العملاء.',
      addClient: 'إضافة عميل',
      fileNumber: 'رقم الملف',
      fullName: 'الاسم الكامل',
      assignedEngineer: 'المهندس المسؤول',
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
      searchPlaceholder: 'ابحث بالاسم، رقم الملف، أو الجوال...'
    },
    en: {
      title: 'Client Management',
      description: 'View and update client file statuses.',
      addClient: 'Add Client',
      fileNumber: 'File Number',
      fullName: 'Full Name',
      assignedEngineer: 'Assigned Engineer',
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
      searchPlaceholder: 'Search by name, file no., or mobile...'
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
             <Button variant="outline" size="sm" onClick={refreshData} disabled={loading}>
                 {loading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <RefreshCw className="ml-2 h-4 w-4" />}
                 تحديث
             </Button>
             <Button onClick={() => setIsFormOpen(true)} size="sm" className="gap-1">
                <PlusCircle className="h-4 w-4" />
                {currentText.addClient}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
            <Input
                placeholder={currentText.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
        </div>
        <div className="border rounded-lg">
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
              {loading && filteredClients.length === 0 && Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
              ))}
              {error && <TableRow><TableCell colSpan={6} className="text-center text-destructive">{error.message}</TableCell></TableRow>}
              {!loading && filteredClients.length === 0 && <TableRow><TableCell colSpan={6} className="text-center h-24">{searchQuery ? 'لا توجد نتائج مطابقة' : currentText.noClients}</TableCell></TableRow>}
              {filteredClients.map((client) => {
                const isOptimistic = client.id.startsWith('optimistic-');
                return (
                    <TableRow key={client.id} className={cn(isOptimistic && 'opacity-50')}>
                        <TableCell className="font-mono">{isOptimistic ? <Loader2 className="h-4 w-4 animate-spin"/> : client.fileId}</TableCell>
                        <TableCell className="font-medium"><Link href={`/dashboard/clients/${client.id}`} className="hover:underline">{client.nameAr}</Link></TableCell>
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
                                    <Button aria-haspopup="true" size="icon" variant="ghost" disabled={isOptimistic}>
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
        </div>
      </CardContent>
    </Card>

    <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl" dir="rtl">
            <DialogHeader>
                <DialogTitle>إضافة عميل جديد</DialogTitle>
                <DialogDescription>قم بتعبئة بيانات العميل الجديد لإنشاء ملف له في النظام.</DialogDescription>
            </DialogHeader>
            <ClientForm 
                onSave={handleSaveClient} 
                onClose={() => setIsFormOpen(false)}
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
