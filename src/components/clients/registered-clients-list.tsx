
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
import { MoreHorizontal, PlusCircle, Trash2, Loader2, X } from 'lucide-react';
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
import { doc, deleteDoc, collection, serverTimestamp, runTransaction, query, where, getDocs, writeBatch } from 'firebase/firestore';
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
import { useInfiniteScroll } from '@/lib/hooks/use-infinite-scroll';
import { findUserIdByEmployeeId, createNotification } from '@/services/notification-service';

type ClientStatus = 'new' | 'contracted' | 'cancelled' | 'reContracted';

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
  
  const { items: clients, loading: clientsLoading, loaderRef, loadingMore } = useInfiniteScroll<Client>('clients');
  const { data: employees, loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees');
  
  const loading = clientsLoading && clients.length === 0;

  const employeesMap = useMemo(() => {
      if (!employees) return new Map<string, string>();
      const newMap = new Map<string, string>();
      employees.forEach(emp => { if (emp.id) newMap.set(emp.id, emp.fullName); });
      return newMap;
  }, [employees]);

  const augmentedClients = useMemo(() => {
    return clients.map(client => ({
        ...client,
        assignedEngineerName: client.assignedEngineer ? employeesMap.get(client.assignedEngineer) : undefined,
    }));
  }, [clients, employeesMap]);

  const filteredClients = useMemo(() => searchClients(augmentedClients, searchQuery), [augmentedClients, searchQuery]);

  const handleSaveClient = async (newClientData: Partial<Client>) => {
        if (!firestore || !currentUser) return;
        setIsSavingClient(true);
        let newClientId = '';

        try {
            if (newClientData.mobile) {
                const mobileQuery = query(collection(firestore, 'clients'), where('mobile', '==', newClientData.mobile));
                const mobileSnapshot = await getDocs(mobileQuery);
                if (!mobileSnapshot.empty) throw new Error('رقم الهاتف هذا مسجل بالفعل لعميل آخر.');
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
                  ...(newClientData as any),
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
        } catch (error: any) {
            toast({ title: "خطأ", description: error.message, variant: "destructive" });
        } finally {
            setIsSavingClient(false);
        }
    };

  const handleDeleteClient = async () => {
        if (!clientToDelete || !firestore) return;
        setIsDeleting(true);
        try {
            const batch = writeBatch(firestore);
            batch.delete(doc(firestore, 'clients', clientToDelete.id!));
            await batch.commit();
            toast({ title: 'نجاح', description: 'تم حذف العميل بنجاح.' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف العميل.' });
        } finally {
            setIsDeleting(false);
            setClientToDelete(null);
        }
    };

  return (
    <>
      <div className="flex items-center justify-between">
          <Input
              placeholder="ابحث بالاسم، رقم الملف، أو الجوال..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
          />
          <Button onClick={() => setIsFormOpen(true)} size="sm" className="gap-1">
              <PlusCircle className="h-4 w-4" />
              إضافة عميل
          </Button>
      </div>

      <div className='border rounded-lg mt-4'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم الملف</TableHead>
                <TableHead>الاسم الكامل</TableHead>
                <TableHead>المهندس المسؤول</TableHead>
                <TableHead>رقم الجوال</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={6}><Skeleton className="h-20 w-full" /></TableCell></TableRow>}
              {!loading && filteredClients.length === 0 && <TableRow><TableCell colSpan={6} className="text-center h-24">لا يوجد عملاء مسجلون حالياً.</TableCell></TableRow>}
              {filteredClients.map((client) => (
                    <TableRow key={client.id}>
                        <TableCell className="font-mono">{client.fileId}</TableCell>
                        <TableCell className="font-medium">
                            <Link href={`/dashboard/clients/${client.id}`} className="hover:underline">{client.nameAr}</Link>
                        </TableCell>
                        <TableCell>{(client as any).assignedEngineerName || <span className="text-muted-foreground">غير مسند</span>}</TableCell>
                        <TableCell>{client.mobile}</TableCell>
                        <TableCell>
                            <Badge variant="outline" className={statusColors[client.status]}>{statusTranslations[client.status]}</Badge>
                        </TableCell>
                        <TableCell>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" dir="rtl">
                                    <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                    <DropdownMenuItem asChild><Link href={`/dashboard/clients/${client.id}`}>عرض الملف</Link></DropdownMenuItem>
                                    <DropdownMenuItem asChild><Link href={`/dashboard/clients/${client.id}/edit`}>تعديل</Link></DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-destructive" onClick={() => setClientToDelete(client)}><Trash2 className="mr-2 h-4 w-4" />حذف</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                    </TableRow>
              ))}
            </TableBody>
          </Table>
          <div ref={loaderRef} className="flex justify-center p-4">
            {loadingMore && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
          </div>
        </div>

    <Dialog open={isFormOpen} onOpenChange={(open) => { if (!open && !isSavingClient) setIsFormOpen(false); }}>
        <DialogContent className="max-w-[650px] p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl animate-in zoom-in-95 duration-200" dir="rtl">
            {/* Slim purple top line */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-primary z-50" />
            
            <div className="relative pt-8">
                <DialogHeader className="px-8 pb-6 border-b bg-card">
                    <DialogTitle className="text-2xl font-black text-gray-800">إضافة عميل جديد</DialogTitle>
                    <DialogDescription className="text-sm font-medium text-gray-500 mt-1">
                        قم بتعبئة بيانات العميل الجديد لإنشاء ملف له في النظام.
                    </DialogDescription>
                    <button 
                        onClick={() => setIsFormOpen(false)}
                        className="absolute left-6 top-8 p-2 rounded-full hover:bg-muted transition-colors"
                    >
                        <X className="h-5 w-5 text-gray-400" />
                    </button>
                </DialogHeader>
                
                <ClientForm 
                    onSave={handleSaveClient} 
                    onClose={() => setIsFormOpen(false)}
                    isSaving={isSavingClient}
                />
            </div>
        </DialogContent>
    </Dialog>

    <AlertDialog open={!!clientToDelete} onOpenChange={(open) => !open && setClientToDelete(null)}>
        <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
                <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                <AlertDialogDescription>سيتم حذف ملف العميل وجميع معاملاته وسجلاته بشكل دائم. لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>إلغاء</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteClient} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                    {isDeleting ? 'جاري الحذف...' : 'نعم، قم بالحذف'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
