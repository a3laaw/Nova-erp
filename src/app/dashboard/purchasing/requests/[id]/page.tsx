
'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument } from '@/firebase';
import { doc, updateDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import type { PurchaseRequest, ConstructionProject } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle, XCircle, ShoppingCart, FileSearch, Trash2, Loader2, AlertCircle, Clock, Target, User } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved: 'bg-blue-100 text-blue-800 border-blue-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  converted: 'bg-green-100 text-green-800 border-green-200',
};

const statusTranslations: Record<string, string> = {
  pending: 'بانتظار الموافقة',
  approved: 'تمت الموافقة',
  rejected: 'مرفوض',
  converted: 'تم تحويله لأمر شراء',
};

export default function PurchaseRequestDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const [isUpdating, setIsUpdating] = useState(false);

    const prRef = useMemo(() => (firestore && id ? doc(firestore, 'purchase_requests', id) : null), [firestore, id]);
    const { data: pr, loading: prLoading } = useDocument<PurchaseRequest>(firestore, prRef?.path || null);

    const projectRef = useMemo(() => (firestore && pr?.projectId ? doc(firestore, 'projects', pr.projectId) : null), [firestore, pr?.projectId]);
    const { data: project, loading: projectLoading } = useDocument<ConstructionProject>(firestore, projectRef?.path || null);

    const handleAction = async (status: 'approved' | 'rejected') => {
        if (!prRef || !currentUser) return;
        if (currentUser.role !== 'Admin' && currentUser.role !== 'Accountant') {
            toast({ variant: 'destructive', title: 'غير مسموح', description: 'ليس لديك صلاحية اعتماد طلبات الشراء.' });
            return;
        }

        setIsUpdating(true);
        try {
            await updateDoc(prRef, { status, approvedBy: currentUser.id, approvedAt: serverTimestamp() });
            toast({ title: 'تم التحديث', description: `تم ${status === 'approved' ? 'اعتماد' : 'رفض'} الطلب بنجاح.` });
        } catch (error) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تحديث حالة الطلب.' });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleConvertToPO = () => {
        if (!pr) return;
        // نمرر بيانات الـ PR عبر الـ Query Params لشاشة أمر الشراء الجديد
        const query = new URLSearchParams({
            projectId: pr.projectId,
            sourcePrId: pr.id!
        }).toString();
        router.push(`/dashboard/purchasing/new?${query}`);
    };

    const handleConvertToRFQ = () => {
        if (!pr) return;
        const query = new URLSearchParams({
            projectId: pr.projectId,
            sourcePrId: pr.id!
        }).toString();
        router.push(`/dashboard/purchasing/rfqs/new?${query}`);
    };

    if (prLoading || projectLoading) return <div className="p-8 max-w-4xl mx-auto space-y-8" dir="rtl"><Skeleton className="h-32 w-full rounded-2xl" /><Skeleton className="h-96 w-full rounded-2xl" /></div>;
    if (!pr) return <div className="text-center py-20">لم يتم العثور على طلب الشراء.</div>;

    const prDate = toFirestoreDate(pr.date);

    return (
        <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6" dir="rtl">
            <div className="flex justify-between items-center no-print">
                <Button variant="ghost" onClick={() => router.back()} className="gap-2"><ArrowRight className="h-4 w-4"/> العودة</Button>
                <div className="flex gap-2">
                    {pr.status === 'pending' && (
                        <>
                            <Button onClick={() => handleAction('approved')} disabled={isUpdating} className="bg-blue-600 hover:bg-blue-700 gap-2 rounded-xl font-bold">
                                <CheckCircle className="h-4 w-4"/> اعتماد الطلب
                            </Button>
                            <Button variant="outline" onClick={() => handleAction('rejected')} disabled={isUpdating} className="text-destructive border-destructive hover:bg-red-50 rounded-xl">
                                <XCircle className="h-4 w-4 ml-2"/> رفض
                            </Button>
                        </>
                    )}
                    {pr.status === 'approved' && (
                        <>
                            <Button onClick={handleConvertToPO} className="bg-purple-600 hover:bg-purple-700 gap-2 rounded-xl font-bold shadow-lg shadow-purple-100">
                                <ShoppingCart className="h-4 w-4"/> تحويل لأمر شراء مباشر
                            </Button>
                            <Button onClick={handleConvertToRFQ} variant="outline" className="border-primary text-primary hover:bg-primary/5 gap-2 rounded-xl font-bold">
                                <FileSearch className="h-4 w-4"/> طلب عروض أسعار (RFQ)
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white">
                <CardHeader className="bg-muted/30 p-8 border-b">
                    <div className="flex justify-between items-start">
                        <div className="space-y-3">
                            <Badge className={cn("px-4 py-1 text-xs font-bold", statusColors[pr.status])}>
                                {statusTranslations[pr.status]}
                            </Badge>
                            <CardTitle className="text-3xl font-black tracking-tight">طلب شراء داخلي #{pr.requestNumber}</CardTitle>
                            <div className="flex gap-6 text-sm font-medium text-muted-foreground">
                                <span className="flex items-center gap-2"><Clock className="h-4 w-4"/> {prDate ? format(prDate, 'PP', { locale: ar }) : '-'}</span>
                                <span className="flex items-center gap-2"><User className="h-4 w-4"/> مقدم الطلب: {pr.requesterName}</span>
                            </div>
                        </div>
                        <div className="p-4 bg-background rounded-3xl border-2 border-primary/10 shadow-sm flex items-center gap-4">
                            <Target className="h-8 w-8 text-primary opacity-40" />
                            <div>
                                <Label className="text-[10px] font-black text-muted-foreground block mb-1">المشروع المستهدف</Label>
                                <p className="font-black text-lg">{project?.projectName || 'تحميل عام'}</p>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-8">
                    <div className="border-2 rounded-[2rem] overflow-hidden shadow-sm">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow className="h-14 border-b-2">
                                    <TableHead className="w-16 text-center font-bold">م</TableHead>
                                    <TableHead className="font-bold text-base px-6">بيان المادة المطلوبة</TableHead>
                                    <TableHead className="w-32 text-center font-bold text-base">الكمية</TableHead>
                                    <TableHead className="font-bold text-base px-6">ملاحظات الموقع</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pr.items?.map((item, idx) => (
                                    <TableRow key={idx} className="h-16 hover:bg-muted/5 transition-colors border-b last:border-0">
                                        <TableCell className="text-center font-mono font-bold text-muted-foreground">{idx + 1}</TableCell>
                                        <TableCell className="px-6 font-bold text-lg">{item.itemName}</TableCell>
                                        <TableCell className="text-center font-black text-xl text-primary font-mono">{item.quantity}</TableCell>
                                        <TableCell className="px-6 text-sm text-muted-foreground italic">{item.notes || '-'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                <CardFooter className="p-8 bg-muted/10 border-t flex items-center gap-2 text-xs text-muted-foreground italic">
                    <AlertCircle className="h-4 w-4" />
                    هذا الطلب هو مستند داخلي لأغراض الرقابة الإدارية ولا يترتب عليه أي أثر مالي أو مخزني حتى يتم تحويله لأمر شراء رسمي واستلام البضاعة.
                </CardFooter>
            </Card>
        </div>
    );
}
