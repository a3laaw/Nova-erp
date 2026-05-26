
'use client';

import { useState, useMemo } from 'react';
import { useSubscription } from '@/hooks/use-subscription';
import { useFirebase } from '@/firebase/provider';
import { 
  collection, 
  query, 
  orderBy, 
  doc, 
  deleteDoc, 
  where, 
  updateDoc,
  serverTimestamp,
  getDocs
} from 'firebase/firestore';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '../ui/button';
import { PlusCircle, MoreHorizontal, Trash2, Loader2, X, Pencil, CheckCircle, Eye, AlertCircle, MessageSquare, Undo2, Home, PlaneTakeoff } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { LeaveRequest } from '@/lib/types';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { cn, getTenantPath } from '@/lib/utils';
import Link from 'next/link';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  'on-leave': 'bg-blue-100 text-blue-800 border-blue-200',
  'returned': 'bg-indigo-100 text-indigo-800 border-indigo-200',
};

const statusTranslations: Record<string, string> = {
  pending: 'معلق',
  approved: 'مقبول',
  rejected: 'مرفوض',
  'on-leave': 'في إجازة',
  'returned': 'عاد للعمل',
};

export function LeaveRequestsList() {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const tenantId = currentUser?.currentCompanyId;
  
  const [activeTab, setActiveTab] = useState('all');
  const [requestToDelete, setRequestToDelete] = useState<LeaveRequest | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [requestToProcess, setRequestToProcess] = useState<{ req: LeaveRequest, action: 'approved' | 'rejected' } | null>(null);
  const [adminComment, setAdminComment] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'HR' || currentUser?.role === 'Developer';

  const queryConstraints = useMemo(() => {
      const constraints = [];
      if (!isAdmin && currentUser?.employeeId) {
          constraints.push(where('employeeId', '==', currentUser.employeeId));
      }
      return constraints;
  }, [isAdmin, currentUser?.employeeId]);

  const { data: rawLeaveRequests, loading } = useSubscription<LeaveRequest>(firestore, 'leaveRequests', queryConstraints);

  const filteredRequests = useMemo(() => {
      let filtered = [...rawLeaveRequests].sort((a, b) => {
          const dateA = toFirestoreDate(a.createdAt)?.getTime() || 0;
          const dateB = toFirestoreDate(b.createdAt)?.getTime() || 0;
          return dateB - dateA;
      });

      if (activeTab === 'on-leave') return filtered.filter(r => r.status === 'on-leave');
      if (activeTab === 'returned') return filtered.filter(r => r.status === 'returned');
      if (activeTab === 'pending') return filtered.filter(r => r.status === 'pending');
      
      return filtered;
  }, [rawLeaveRequests, activeTab]);

  const formatDate = (dateValue: any) => {
    const date = toFirestoreDate(dateValue);
    return date ? format(date, 'dd/MM/yyyy') : '-';
  };
  
  const handleDeleteRequest = async () => {
    if (!requestToDelete || !firestore || !tenantId) return;
    setIsDeleting(true);
    try {
        const finalPath = getTenantPath(`leaveRequests/${requestToDelete.id}`, tenantId);
        await deleteDoc(doc(firestore, finalPath!));
        toast({ title: '✅ تم الحذف' });
    } finally {
        setIsDeleting(false);
        setRequestToDelete(null);
    }
  };

  const handleConfirmDecision = async () => {
    if (!requestToProcess || !firestore || !tenantId || !currentUser) return;
    
    setIsProcessingAction(true);
    try {
        const finalPath = getTenantPath(`leaveRequests/${requestToProcess.req.id}`, tenantId);
        const requestData = {
            status: requestToProcess.action,
            [requestToProcess.action === 'approved' ? 'approvedBy' : 'rejectedBy']: currentUser.id,
            [requestToProcess.action === 'approved' ? 'approvedAt' : 'rejectedAt']: serverTimestamp(),
            adminComment: adminComment 
        };
        
        await updateDoc(doc(firestore, finalPath!), requestData);
        
        // 🚀 إشعار الموظف بالنتيجة 🚀
        const targetUserId = await findUserIdByEmployeeId(firestore, requestToProcess.req.employeeId, tenantId);
        if (targetUserId) {
            await createNotification(firestore, {
                userId: targetUserId,
                title: requestToProcess.action === 'approved' ? '✅ تمت الموافقة على إجازتك' : '❌ عذراً، تم رفض طلب الإجازة',
                body: `تم الرد على طلبك من قبل الإدارة. ملاحظة: ${adminComment || 'نتمنى لك التوفيق.'}`,
                link: `/dashboard/hr/leaves/${requestToProcess.req.id}`
            }, tenantId);
        }
        
        toast({ title: 'تم التنفيذ', description: 'تم إخطار الموظف بالقرار فوراً.' });
        setRequestToProcess(null);
        setAdminComment('');
    } finally { 
        setIsProcessingAction(false); 
    }
  };

  if (loading) return <Skeleton className="h-64 w-full rounded-2xl" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-center gap-4 no-print">
         <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl" className="w-full lg:w-auto">
            <TabsList className="bg-white/40 border p-1 rounded-2xl h-11">
                <TabsTrigger value="all" className="rounded-xl px-6 font-bold text-xs">الكل</TabsTrigger>
                <TabsTrigger value="on-leave" className="rounded-xl px-6 font-bold text-xs gap-2">
                    <PlaneTakeoff className="h-3 w-3" /> في إجازة
                </TabsTrigger>
                <TabsTrigger value="returned" className="rounded-xl px-6 font-bold text-xs gap-2">
                    <Home className="h-3 w-3" /> عادوا للعمل
                </TabsTrigger>
                <TabsTrigger value="pending" className="rounded-xl px-6 font-bold text-xs">قيد المراجعة</TabsTrigger>
            </TabsList>
         </Tabs>
        
        <Button asChild className="h-11 px-8 rounded-xl font-black gap-2">
          <Link href="/dashboard/hr/leaves/new"><PlusCircle className="h-5 w-5" /> تقديم طلب إجازة</Link>
        </Button>
      </div>

      <div className="border-2 rounded-[2rem] overflow-hidden shadow-xl bg-white">
        <Table>
          <TableHeader className="bg-[#F8F9FE] h-14">
            <TableRow className="border-none">
              <TableHead className="px-8 font-black text-[#7209B7]">الموظف</TableHead>
              <TableHead className="font-black text-[#7209B7]">النوع</TableHead>
              <TableHead className="font-black text-[#7209B7]">الفترة</TableHead>
              <TableHead className="font-black text-[#7209B7]">الحالة الإجرائية</TableHead>
              <TableHead className="text-center font-black text-[#7209B7]">إجراء</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRequests.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="h-48 text-center text-muted-foreground italic font-black">لا توجد سجلات في هذا التبويب.</TableCell></TableRow>
            ) : (
              filteredRequests.map(req => (
                <TableRow key={req.id} className="hover:bg-[#F3E8FF]/20 h-16 group transition-colors">
                  <TableCell className="px-8 font-black text-slate-800">
                      <Link href={`/dashboard/hr/leaves/${req.id}`} className="hover:underline flex items-center gap-2">
                         {req.employeeName}
                         <Badge variant="secondary" className="text-[9px] font-mono opacity-40">#{req.id?.substring(0,4)}</Badge>
                      </Link>
                  </TableCell>
                  <TableCell><Badge variant="secondary" className="font-bold">{req.leaveType}</Badge></TableCell>
                  <TableCell className="font-mono text-xs opacity-60 font-bold">{formatDate(req.startDate)} - {formatDate(req.endDate)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("px-3 font-black text-[10px] border-2", statusColors[req.status])}>
                        {statusTranslations[req.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl border"><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger>
                        <DropdownMenuContent dir="rtl" className="rounded-xl shadow-2xl p-2 border-none">
                            <DropdownMenuLabel className="font-black px-3 py-2 text-xs text-slate-400 uppercase">خيارات المتابعة</DropdownMenuLabel>
                            
                            <DropdownMenuItem asChild className="rounded-lg py-3 font-bold gap-2 cursor-pointer">
                                <Link href={`/dashboard/hr/leaves/${req.id}`}><Eye className="h-4 w-4 text-primary" /> تفاصيل العودة والمباشرة</Link>
                            </DropdownMenuItem>

                            {isAdmin && req.status === 'pending' && (
                                <>
                                    <DropdownMenuSeparator className="bg-slate-100" />
                                    <DropdownMenuItem onClick={() => setRequestToProcess({ req, action: 'approved' })} className="text-green-600 font-bold gap-2 py-3 rounded-lg focus:bg-green-50"><CheckCircle className="h-4 w-4"/> موافقة</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setRequestToProcess({ req, action: 'rejected' })} className="text-red-600 font-bold gap-2 rounded-lg py-3"><X className="h-4 w-4"/> رفض</DropdownMenuItem>
                                </>
                            )}
                            
                            <DropdownMenuSeparator className="bg-slate-100" />
                            
                            {isAdmin && (
                                <DropdownMenuItem className="text-red-600 font-black gap-2 rounded-lg py-3 focus:bg-red-50" onClick={() => setRequestToDelete(req)}>
                                    <Trash2 className="ml-2 h-4 w-4" /> حذف الملف نهائياً
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!requestToDelete} onOpenChange={() => setRequestToDelete(null)}>
        <AlertDialogContent dir="rtl" className="rounded-[2rem] p-10 border-none shadow-2xl bg-white">
            <AlertDialogHeader>
                <div className="p-3 bg-red-100 rounded-2xl text-red-600 w-fit mb-4 shadow-inner"><Trash2 className="h-8 w-8"/></div>
                <AlertDialogTitle className="text-2xl font-black text-red-700">تأكيد المسح النهائي؟</AlertDialogTitle>
                <AlertDialogDescription className="text-lg font-medium leading-relaxed mt-2">
                    سيتم حذف سجل الإجازة للموظف <strong className="text-foreground">"{requestToDelete?.employeeName}"</strong> بشكل دائم.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-8 gap-3">
                <AlertDialogCancel className="rounded-xl font-bold h-12 px-8 border-2 text-black">تراجع</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteRequest} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 rounded-xl font-black h-12 px-12 shadow-lg shadow-red-200">
                    {isDeleting ? <Loader2 className="animate-spin h-4 w-4"/> : 'نعم، حذف نهائي'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!requestToProcess} onOpenChange={() => { setRequestToProcess(null); setAdminComment(''); }}>
        <AlertDialogContent dir="rtl" className="rounded-3xl border-none shadow-2xl overflow-hidden p-0 bg-white">
            <AlertDialogHeader className={cn("p-8 text-white", requestToProcess?.action === 'approved' ? "bg-green-600" : "bg-red-600")}>
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                        {requestToProcess?.action === 'approved' ? <CheckCircle className="h-8 w-8 text-white" /> : <AlertCircle className="h-8 w-8 text-white" />}
                    </div>
                    <div>
                        <AlertDialogTitle className="text-2xl font-black text-white">
                            {requestToProcess?.action === 'approved' ? 'قبول طلب الإجازة' : 'رفض طلب الإجازة'}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-white/80 font-bold">للموظف: {requestToProcess?.req.employeeName}</AlertDialogDescription>
                    </div>
                </div>
            </AlertDialogHeader>
            <div className="p-8 space-y-6">
                <div className="grid gap-3">
                    <Label className="font-black text-slate-700 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-primary" /> الرد الإداري الموجه للموظف *
                    </Label>
                    <Textarea 
                        value={adminComment}
                        onChange={(e) => setAdminComment(e.target.value)}
                        placeholder="اكتب ردك هنا..."
                        className="rounded-2xl border-2 p-4 text-base font-medium min-h-[140px]"
                    />
                </div>
            </div>
            <AlertDialogFooter className="p-8 bg-muted/10 border-t gap-3 flex flex-row-reverse">
                <Button onClick={handleConfirmDecision} disabled={isProcessingAction || !adminComment.trim()} className={cn("flex-1 h-14 rounded-2xl font-black text-lg shadow-xl", requestToProcess?.action === 'approved' ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700")}>
                    {isProcessingAction ? <Loader2 className="animate-spin h-6 w-6"/> : 'تأكيد القرار وإرسال الإشعار'}
                </Button>
                <AlertDialogCancel className="rounded-2xl font-bold h-14 px-8 border-2 text-black">إلغاء</AlertDialogCancel>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
