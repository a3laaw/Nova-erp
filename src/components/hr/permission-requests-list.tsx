
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSubscription } from '@/hooks/use-subscription';
import { useFirebase } from '@/firebase';
import { collection, query, orderBy, doc, deleteDoc, updateDoc, where, serverTimestamp } from 'firebase/firestore';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '../ui/button';
import { PlusCircle, MoreHorizontal, Trash2, Loader2, Check, X, Pencil, Search, Clock, MessageSquare, Eye } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '../ui/badge';
import type { PermissionRequest, Employee } from '@/lib/types';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { PermissionRequestForm } from './permission-request-form';
import { toFirestoreDate } from '@/services/date-converter';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { Textarea } from '../ui/textarea';
import { useSearchParams } from 'next/navigation';
import { cn, getTenantPath } from '@/lib/utils';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
};

const statusTranslations: Record<string, string> = {
  pending: 'معلق',
  approved: 'موافق عليه',
  rejected: 'مرفوض',
};

const typeTranslations: Record<PermissionRequest['type'], string> = {
    late_arrival: 'تأخير صباحي',
    early_departure: 'خروج مبكر',
};

export function PermissionRequestsList() {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const tenantId = currentUser?.currentCompanyId;
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [requestToEdit, setRequestToEdit] = useState<PermissionRequest | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [requestToDelete, setRequestToDelete] = useState<PermissionRequest | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [requestToAction, setRequestToAction] = useState<{ request: PermissionRequest, action: 'approve' | 'reject' } | null>(null);
  const [adminComment, setAdminComment] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'HR' || currentUser?.role === 'Developer';

  useEffect(() => {
    const employeeId = searchParams.get('employeeId');
    if (employeeId) {
        setIsFormOpen(true);
    }
  }, [searchParams]);

  const queryConstraints = useMemo(() => {
      const constraints = [];
      if (!isAdmin && currentUser?.employeeId) {
          constraints.push(where('employeeId', '==', currentUser.employeeId));
      }
      return constraints;
  }, [isAdmin, currentUser?.employeeId]);

  const { data: rawRequests, loading: loadingRequests } = useSubscription<PermissionRequest>(firestore, 'permissionRequests', queryConstraints);
  const { data: employees, loading: loadingEmployees } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);

  const permissionRequests = useMemo(() => {
      const sorted = [...rawRequests].sort((a, b) => {
          const dateA = toFirestoreDate(a.createdAt)?.getTime() || 0;
          const dateB = toFirestoreDate(b.createdAt)?.getTime() || 0;
          return dateB - dateA;
      });

      if (!searchQuery) return sorted;
      const lower = searchQuery.toLowerCase();
      return sorted.filter(r => 
        r.employeeName.toLowerCase().includes(lower) || 
        r.reason.toLowerCase().includes(lower)
      );
  }, [rawRequests, searchQuery]);

  const loading = loadingRequests || loadingEmployees;

  const formatDate = (dateValue: any) => {
    const date = toFirestoreDate(dateValue);
    return date ? format(date, 'dd/MM/yyyy') : '-';
  };
  
  const handleEditClick = (req: PermissionRequest) => {
    setRequestToEdit(req);
    setIsFormOpen(true);
  };

  const handleDeleteRequest = async () => {
    if (!requestToDelete || !firestore || !tenantId) return;
    setIsDeleting(true);
    try {
        const finalPath = getTenantPath(`permissionRequests/${requestToDelete.id}`, tenantId);
        await deleteDoc(doc(firestore, finalPath!));
        toast({ title: 'نجاح الحذف', description: 'تم حذف طلب الاستئذان بنجاح.' });
    } catch (e) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف الطلب.' });
    } finally {
        setIsDeleting(false);
        setRequestToDelete(null);
    }
  };
  
  const handleConfirmAction = async () => {
    if (!requestToAction || !firestore || !currentUser || !tenantId) return;
    
    setIsProcessingAction(true);
    try {
        const finalPath = getTenantPath(`permissionRequests/${requestToAction.request.id}`, tenantId);
        const reqRef = doc(firestore, finalPath!);
        const newStatus = requestToAction.action === 'approve' ? 'approved' : 'rejected';
        
        await updateDoc(reqRef, {
            status: newStatus,
            approvedBy: currentUser.id,
            approvedAt: serverTimestamp(),
            adminComment: adminComment
        });

        // 🚀 إخطار الموظف بالنتيجة 🚀
        const targetUserId = await findUserIdByEmployeeId(firestore, requestToAction.request.employeeId, tenantId);
        if (targetUserId) {
            await createNotification(firestore, {
                userId: targetUserId,
                title: newStatus === 'approved' ? '✅ تمت الموافقة على الاستئذان' : '❌ عذراً، تم رفض طلب الاستئذان',
                body: `تم الرد على طلبك من قبل الإدارة. ملاحظة: ${adminComment || 'نتمنى لك يوماً سعيداً.'}`,
                link: `/dashboard/hr/permissions`
            }, tenantId);
        }
        
        toast({ title: 'تم التنفيذ', description: `تم ${newStatus === 'approved' ? 'الموافقة على' : 'رفض'} الطلب وإخطار الموظف.` });
    } catch (e) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تحديث حالة الطلب.' });
    } finally {
        setIsProcessingAction(false);
        setRequestToAction(null);
        setAdminComment('');
    }
  };

  return (
    <>
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 p-4 bg-[#F8F9FE] rounded-[2rem] border shadow-inner no-print" dir="rtl">
        <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-40" />
            <Input
                placeholder="ابحث بالاسم أو السبب..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 rounded-xl bg-white border-none shadow-sm font-bold"
            />
        </div>
        <Button onClick={() => { setRequestToEdit(null); setIsFormOpen(true); }} className="h-11 px-8 rounded-xl font-black gap-2 shadow-xl shadow-primary/20">
          <PlusCircle className="h-5 w-5" />
          تقديم طلب استئذان
        </Button>
      </div>

      <div className="border-2 rounded-[2rem] overflow-hidden shadow-xl bg-white" dir="rtl">
        <Table>
          <TableHeader className="bg-[#F8F9FE] h-14">
            <TableRow className="border-none">
              <TableHead className="px-8 font-black text-[#7209B7]">الموظف</TableHead>
              <TableHead className="font-black text-[#7209B7]">نوع الاستئذان</TableHead>
              <TableHead className="font-black text-[#7209B7]">التاريخ</TableHead>
              <TableHead className="font-black text-[#7209B7]">الحالة</TableHead>
              <TableHead className="text-center font-black text-[#7209B7]">إجراء</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={5} className="px-8"><Skeleton className="h-10 w-full rounded-xl" /></TableCell></TableRow>
              ))
            ) : permissionRequests.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="h-48 text-center text-muted-foreground font-bold italic">لا توجد طلبات استئذان مسجلة.</TableCell></TableRow>
            ) : (
              permissionRequests.map((req) => (
              <TableRow key={req.id} className="hover:bg-[#F3E8FF]/20 group transition-colors h-16">
                <TableCell className="px-8 font-black text-gray-800">
                    {req.employeeName}
                    <p className="text-[10px] text-muted-foreground font-medium italic line-clamp-1">{req.reason}</p>
                </TableCell>
                <TableCell className="font-bold text-slate-600">{typeTranslations[req.type]}</TableCell>
                <TableCell className="font-mono text-xs font-black opacity-60">{formatDate(req.date)}</TableCell>
                <TableCell><Badge variant="outline" className={cn("px-4 py-1 rounded-full font-black text-[10px] border-2", statusColors[req.status])}>{statusTranslations[req.status]}</Badge></TableCell>
                <TableCell className="text-center">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl border group-hover:border-primary/20"><MoreHorizontal className="h-4 w-4"/></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent dir="rtl" className="rounded-xl shadow-2xl p-2 border-none bg-white">
                            <DropdownMenuLabel className="font-black px-3 py-2 text-xs text-slate-400 uppercase">خيارات الطلب</DropdownMenuLabel>
                             {isAdmin && req.status === 'pending' && (
                                <>
                                    <DropdownMenuItem onClick={() => setRequestToAction({request: req, action: 'approve'})} className="text-green-600 font-bold gap-2 py-3 rounded-lg focus:bg-green-50">
                                        <Check className="h-4 w-4" /> موافقة مع رد
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setRequestToAction({request: req, action: 'reject'})} className="text-red-600 font-bold gap-2 py-3 rounded-lg focus:bg-red-50">
                                        <X className="h-4 w-4" /> رفض مع ذكر السبب
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                </>
                            )}
                            {req.status === 'pending' && (
                                <DropdownMenuItem onClick={() => handleEditClick(req)} className="gap-2 py-3 rounded-lg font-bold text-black">
                                    <Pencil className="h-4 w-4 text-primary" /> تعديل البيانات
                                </DropdownMenuItem>
                            )}
                            {req.status === 'pending' && (
                                <DropdownMenuItem className="text-red-600 font-black gap-2 rounded-lg py-3 focus:bg-red-50" onClick={() => setRequestToDelete(req)}>
                                    <Trash2 className="ml-2 h-4 w-4" /> حذف الطلب
                                </DropdownMenuItem>
                            )}
                            {req.status !== 'pending' && (
                                <DropdownMenuItem className="opacity-50 cursor-not-allowed">تم اتخاذ قرار</DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </TableCell>
              </TableRow>
            )))}
          </TableBody>
        </Table>
      </div>
      
      <PermissionRequestForm 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)} 
        onSaveSuccess={() => {}}
        permissionToEdit={requestToEdit}
        employees={employees}
        loadingRefs={loadingEmployees}
      />
      
      <AlertDialog open={!!requestToDelete} onOpenChange={() => setRequestToDelete(null)}>
        <AlertDialogContent dir="rtl" className="rounded-[2.5rem] p-10 border-none shadow-2xl bg-white">
            <AlertDialogHeader>
                <div className="p-3 bg-red-100 rounded-2xl text-red-600 w-fit mb-4 shadow-inner"><Trash2 className="h-8 w-8"/></div>
                <AlertDialogTitle className="text-2xl font-black text-red-700">تأكيد الحذف النهائي؟</AlertDialogTitle>
                <AlertDialogDescription className="text-lg font-medium leading-relaxed mt-2 text-slate-600">سيتم مسح طلب الاستئذان نهائياً من سجلات الموظف. لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-8 gap-3">
                <AlertDialogCancel className="rounded-xl font-bold h-12 px-8 border-2 text-black">تراجع</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteRequest} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 rounded-xl font-black h-12 px-12 shadow-lg shadow-red-200">
                    {isDeleting ? <Loader2 className="animate-spin h-4 w-4"/> : 'نعم، حذف الطلب'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!requestToAction} onOpenChange={() => { setRequestToAction(null); setAdminComment(''); }}>
        <AlertDialogContent dir="rtl" className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
            <AlertDialogHeader className={cn("p-8 text-white", requestToAction?.action === 'approve' ? "bg-green-600" : "bg-red-600")}>
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                        {requestToAction?.action === 'approve' ? <Check className="h-8 w-8 text-white" /> : <X className="h-8 w-8 text-white" />}
                    </div>
                    <div>
                        <AlertDialogTitle className="text-2xl font-black">
                            {requestToAction?.action === 'approve' ? 'الموافقة على الاستئذان' : 'رفض طلب الاستئذان'}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-white/80 font-bold">
                            للموظف: {requestToAction?.request.employeeName}
                        </AlertDialogDescription>
                    </div>
                </div>
            </AlertDialogHeader>
            <div className="p-8 space-y-6">
                <div className="grid gap-3">
                    <Label className="font-black text-slate-700 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-primary" /> الرد الإداري / الملاحظات *
                    </Label>
                    <Textarea
                        placeholder="اكتب ردك هنا ليرزه الموظف فوراً..."
                        value={adminComment}
                        onChange={(e) => setAdminComment(e.target.value)}
                        className="rounded-2xl border-2 p-4 text-base font-medium min-h-[140px]"
                    />
                </div>
            </div>
            <AlertDialogFooter className="p-8 bg-muted/10 border-t gap-3 flex flex-row-reverse">
                <Button 
                    onClick={handleConfirmAction} 
                    disabled={isProcessingAction || !adminComment.trim()} 
                    className={cn(
                        "flex-1 h-14 rounded-2xl font-black text-lg shadow-xl",
                        requestToAction?.action === 'approve' ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                    )}
                >
                    {isProcessingAction ? <Loader2 className="animate-spin h-6 w-6"/> : 'تأكيد وحفظ القرار'}
                </Button>
                <AlertDialogCancel className="rounded-2xl font-bold h-14 px-8 border-2 text-black">إلغاء</AlertDialogCancel>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
