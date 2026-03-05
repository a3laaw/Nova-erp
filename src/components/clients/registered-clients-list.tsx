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
import { MoreHorizontal, PlusCircle, Trash2, Loader2, X, Search, User } from 'lucide-react';
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
import { cn } from '@/lib/utils';

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
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSavingClient, setIsSavingClient] = useState(false);
  
  const { items: clients, loading: clientsLoading, loaderRef, loadingMore } = useInfiniteScroll<Client>('clients');
  const { data: employees } = useSubscription<Employee>(firestore, 'employees');
  
  const loading = clientsLoading && clients.length === 0;

  const employeesMap = useMemo(() => {
      const newMap = new Map<string, string>();
      (employees || []).forEach(emp => { if (emp.id) newMap.set(emp.id, emp.fullName); });
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
    <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-[#F8F9FE] p-4 rounded-[2rem] border shadow-inner no-print">
            <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-40" />
                <Input
                    placeholder="ابحث بالاسم أو رقم الملف..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-11 rounded-xl bg-white border-none shadow-sm font-bold"
                />
            </div>
            <Button onClick={() => setIsFormOpen(true)} className="h-11 px-6 rounded-xl font-black gap-2 shadow-lg shadow-primary/20">
                <PlusCircle className="h-5 w-5" />
                إضافة عميل جديد
            </Button>
        </div>

        <div className="border-2 rounded-[2rem] overflow-hidden shadow-xl bg-white">
          <Table>
            <TableHeader className="bg-[#F8F9FE]">
              <TableRow className="border-none">
                <TableHead className="px-8 py-5 font-black text-[#7209B7]">رقم الملف</TableHead>
                <TableHead className="font-black text-[#7209B7]">الاسم الكامل</TableHead>
                <TableHead className="font-black text-[#7209B7]">المهندس المسؤول</TableHead>
                <TableHead className="font-black text-[#7209B7]">رقم الجوال</TableHead>
                <TableHead className="font-black text-[#7209B7]">الحالة</TableHead>
                <TableHead className="text-center font-black text-[#7209B7]">إجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={6} className="px-8"><Skeleton className="h-6 w-full rounded-lg" /></TableCell></TableRow>
                  ))
              ) : filteredClients.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="h-48 text-center text-muted-foreground font-bold italic">لا توجد ملفات عملاء مسجلة حالياً.</TableCell></TableRow>
              ) : (
                filteredClients.map((client) => (
                    <TableRow key={client.id} className="hover:bg-[#F3E8FF]/20 group transition-colors h-16">
                        <TableCell className="px-8 font-mono font-black text-primary text-sm">{client.fileId}</TableCell>
                        <TableCell>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-[#F8F9FE] rounded-full group-hover:bg-white transition-colors">
                                    <User className="h-4 w-4 text-[#7209B7]" />
                                </div>
                                <Link href={`/dashboard/clients/${client.id}`} className="font-black text-gray-800 hover:underline">{client.nameAr}</Link>
                            </div>
                        </TableCell>
                        <TableCell className="font-medium text-xs text-gray-600">{client.assignedEngineerName || <span className="text-muted-foreground">غير مسند</span>}</TableCell>
                        <TableCell dir="ltr" className="text-right font-mono text-xs opacity-60">{client.mobile}</TableCell>
                        <TableCell>
                            <Badge variant="outline" className={cn("px-3 font-black text-[10px]", statusColors[client.status])}>
                                {statusTranslations[client.status]}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl border group-hover:border-primary/20 transition-all"><MoreHorizontal className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" dir="rtl" className="rounded-xl">
                                    <DropdownMenuLabel>إجراءات الملف</DropdownMenuLabel>
                                    <DropdownMenuItem asChild><Link href={`/dashboard/clients/${client.id}`}>عرض الملف</Link></DropdownMenuItem>
                                    <DropdownMenuItem asChild><Link href={`/dashboard/clients/${client.id}/edit`}>تعديل</Link></DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-destructive focus:bg-destructive/10" onClick={() => setClientToDelete(client)}><Trash2 className="ml-2 h-4 w-4" />حذف نهائي</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                    </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <div ref={loaderRef} className="flex justify-center p-4">
            {loadingMore && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
          </div>
        </div>

        <Dialog open={isFormOpen} onOpenChange={(open) => { if (!open && !isSavingClient) setIsFormOpen(false); }}>
            <DialogContent className="max-w-[650px] p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl h-[90vh] flex flex-col" dir="rtl">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-primary z-50" />
                <div className="relative pt-8 flex flex-col h-full">
                    <DialogHeader className="px-8 pb-6 border-b bg-card">
                        <DialogTitle className="text-2xl font-black text-gray-800">إضافة عميل جديد</DialogTitle>
                        <DialogDescription className="text-sm font-medium text-gray-500 mt-1">إنشاء ملف فني ومالي جديد للعميل في النظام.</DialogDescription>
                        <button onClick={() => setIsFormOpen(false)} className="absolute left-6 top-8 p-2 rounded-full hover:bg-muted transition-colors"><X className="h-5 w-5 text-gray-400" /></button>
                    </DialogHeader>
                    <div className="flex-1 overflow-hidden">
                        <ClientForm onSave={handleSaveClient} onClose={() => setIsFormOpen(false)} isSaving={isSavingClient} />
                    </div>
                </div>
            </DialogContent>
        </Dialog>

        <AlertDialog open={!!clientToDelete} onOpenChange={() => setClientToDelete(null)}>
            <AlertDialogContent dir="rtl" className="rounded-3xl">
                <AlertDialogHeader><AlertDialogTitle>تأكيد الحذف النهائي؟</AlertDialogTitle><AlertDialogDescription>سيتم حذف ملف العميل وجميع معاملاته وسجلاته المالية بشكل دائم ومسح القيد المالي المرتبط.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter className="gap-2">
                    <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteClient} disabled={isDeleting} className="bg-destructive rounded-xl">نعم، حذف</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
