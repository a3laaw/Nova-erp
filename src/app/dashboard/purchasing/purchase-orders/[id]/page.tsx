
'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument } from '@/firebase';
import { doc, updateDoc, serverTimestamp, getDocs, collection, query, where, deleteField, writeBatch } from 'firebase/firestore';
import type { PurchaseOrder } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { 
    Printer, 
    ArrowRight, 
    ShoppingCart, 
    Calendar, 
    User, 
    Target, 
    CheckCircle, 
    XCircle, 
    Loader2, 
    Info,
    Undo2
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { useBranding } from '@/context/branding-context';
import { toFirestoreDate } from '@/services/date-converter';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Logo } from '@/components/layout/logo';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';

const statusColors: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    approved: 'bg-blue-100 text-blue-800 border-blue-200',
    received: 'bg-green-100 text-green-800 border-green-200',
    partially_received: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    cancelled: 'bg-red-100 text-red-800 border-red-200',
};

const statusTranslations: Record<string, string> = {
    draft: 'مسودة',
    approved: 'معتمد (بانتظار التوريد)',
    received: 'تم الاستلام بالكامل',
    partially_received: 'مستلم جزئياً',
    cancelled: 'ملغي',
};

export default function PurchaseOrderDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const { branding, loading: brandingLoading } = useBranding();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const [isUpdating, setIsUpdating] = useState(false);

    const poRef = useMemo(() => (firestore && id ? doc(firestore, 'purchaseOrders', id) : null), [firestore, id]);
    const { data: po, loading: poLoading } = useDocument<PurchaseOrder>(firestore, poRef?.path || null);

    const handlePrint = () => window.print();

    const handleApprove = async () => {
        if (!poRef || !currentUser) return;
        if (currentUser.role !== 'Admin' && currentUser.role !== 'Accountant') {
            toast({ variant: 'destructive', title: 'غير مسموح', description: 'ليس لديك صلاحية اعتماد أوامر الشراء.' });
            return;
        }

        setIsUpdating(true);
        try {
            await updateDoc(poRef, {
                status: 'approved',
                approvedBy: currentUser.id,
                approvedAt: serverTimestamp()
            });
            toast({ title: 'تم الاعتماد', description: 'أصبح أمر الشراء معتمداً الآن ويمكن استلامه في المخازن.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل اعتماد الطلب.' });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleUndoApproval = async () => {
        if (!poRef || !currentUser || !po || !firestore) return;
        
        setIsUpdating(true);
        try {
            const grnsQuery = query(
                collection(firestore, 'grns'), 
                where('purchaseOrderId', '==', po.id)
            );
            const grnsSnap = await getDocs(grnsQuery);
            const activeGrns = grnsSnap.docs.filter(d => d.data().status !== 'cancelled');
            
            if (activeGrns.length > 0) {
                toast({ 
                    variant: 'destructive', 
                    title: 'لا يمكن التراجع', 
                    description: 'تم البدء باستلام بضاعة لهذا الأمر بالفعل. يجب حذف أذونات الاستلام أولاً.' 
                });
                return;
            }

            await updateDoc(poRef, { 
                status: 'draft',
                approvedBy: deleteField(),
                approvedAt: deleteField()
            });
            
            toast({ title: 'تم التراجع', description: 'تمت إعادة أمر الشراء لحالة المسودة بنجاح.' });
        } catch (error) {
            console.error("Undo approval failed:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل التراجع عن الاعتماد.' });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleCancel = async () => {
        if (!poRef) return;
        setIsUpdating(true);
        try {
            await updateDoc(poRef, { status: 'cancelled' });
            toast({ title: 'تم الإلغاء', description: 'تم إلغاء أمر الشراء بنجاح.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل إلغاء الطلب.' });
        } finally {
            setIsUpdating(false);
        }
    };

    if (poLoading || brandingLoading) {
        return (
            <div className="p-8 max-w-5xl mx-auto space-y-8" dir="rtl">
                <Skeleton className="h-32 w-full rounded-2xl" />
                <Skeleton className="h-96 w-full rounded-2xl" />
            </div>
        );
    }

    if (!po) {
        return (
            <div className="text-center p-20" dir="rtl">
                <p className="text-muted-foreground text-lg">لم يتم العثور على أمر الشراء المطلوب.</p>
                <Button variant="link" onClick={() => router.back()}>العودة للخلف</Button>
            </div>
        );
    }

    const orderDate = toFirestoreDate(po.orderDate);

    return (
        <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6" dir="rtl">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 no-print bg-background/80 backdrop-blur-sm sticky top-0 z-10 py-4 border-b">
                <Button variant="ghost" onClick={() => router.back()} className="gap-2">
                    <ArrowRight className="h-4 w-4"/> العودة للقائمة
                </Button>
                
                <div className="flex gap-2">
                    {po.status === 'draft' && (
                        <>
                            <Button onClick={handleApprove} disabled={isUpdating} className="bg-blue-600 hover:bg-blue-700 gap-2 rounded-xl font-bold">
                                {isUpdating ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle className="h-4 w-4"/>}
                                اعتماد وتحويل للتوريد
                            </Button>
                            <Button variant="outline" onClick={handleCancel} disabled={isUpdating} className="text-destructive border-destructive hover:bg-destructive/10 rounded-xl">
                                <XCircle className="h-4 w-4 ml-2"/> إلغاء الطلب
                            </Button>
                        </>
                    )}
                    {po.status === 'approved' && (
                        <Button onClick={handleUndoApproval} disabled={isUpdating} variant="outline" className="text-orange-600 border-orange-200 hover:bg-orange-50 gap-2 rounded-xl font-bold">
                            {isUpdating ? <Loader2 className="h-4 w-4 animate-spin"/> : <Undo2 className="h-4 w-4"/>}
                            تراجع عن الاعتماد (إعادة لمسودة)
                        </Button>
                    )}
                    <Button onClick={handlePrint} variant="outline" className="gap-2 rounded-xl border-2">
                        <Printer className="h-4 w-4"/> طباعة المستند
                    </Button>
                </div>
            </div>

            <Card className="print:border-none shadow-lg rounded-3xl overflow-hidden bg-white dark:bg-card">
                <div id="printable-area" className="p-8 sm:p-12 print:p-0">
                    <div className="flex justify-between items-start mb-12 border-b-4 border-primary/20 pb-8">
                        <div className="flex items-center gap-6">
                            <Logo className="h-20 w-20 !p-3 shadow-inner border bg-background" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                            <div>
                                <h1 className="text-2xl font-black tracking-tight">{branding?.company_name || 'شركة المقاولات'}</h1>
                                <p className="text-sm text-muted-foreground max-sm mt-1 leading-relaxed">{branding?.address}</p>
                                <p className="text-xs text-muted-foreground mt-1">هاتف: {branding?.phone} | البريد: {branding?.email}</p>
                            </div>
                        </div>
                        <div className="text-left space-y-2">
                            <h2 className="text-3xl font-black text-primary tracking-tighter">أمر شراء بضاعة</h2>
                            <p className="text-lg font-bold text-gray-700 tracking-widest font-mono">PURCHASE ORDER</p>
                            <div className="pt-2">
                                <p className="font-mono text-xl font-black bg-muted px-3 py-1 rounded-lg inline-block">{po.poNumber}</p>
                            </div>
                            <Badge className={cn("px-4 py-1 text-xs font-bold", statusColors[po.status])}>
                                {statusTranslations[po.status]}
                            </Badge>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12 p-8 bg-muted/30 rounded-3xl border">
                        <div className="space-y-6">
                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-background rounded-xl border shadow-sm">
                                    <User className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">السادة الموردون:</Label>
                                    <p className="font-black text-xl">{po.vendorName}</p>
                                    <p className="text-xs text-muted-foreground mt-1 italic">يرجى توريد المواد المذكورة أدناه وفق الشروط المتفق عليها.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-background rounded-xl border shadow-sm">
                                    <Calendar className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">تاريخ الطلب:</Label>
                                    <p className="font-bold text-lg">{orderDate ? format(orderDate, 'eeee, dd MMMM yyyy', { locale: ar }) : '-'}</p>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-6">
                            {po.projectId && (
                                <div className="flex items-start gap-4">
                                    <div className="p-2 bg-primary/10 rounded-xl border border-primary/20 shadow-sm">
                                        <Target className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <Label className="text-[10px] uppercase font-bold text-primary mb-1 block">مركز التكلفة / المشروع:</Label>
                                        <p className="font-black text-lg text-primary">تحميل على ميزانية المشروع</p>
                                        <p className="text-[10px] text-muted-foreground">كود المشروع: {po.projectId.substring(0,8)}</p>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-background rounded-xl border shadow-sm">
                                    <ShoppingCart className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">شروط الدفع المتفق عليها:</Label>
                                    <p className="font-bold">{po.paymentTerms || 'حسب اتفاقية التوريد المعتمدة'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="border-2 rounded-[2rem] overflow-hidden shadow-sm mb-10">
                        <Table>
                            <TableHeader className="bg-muted/80">
                                <TableRow className="h-14 border-b-2">
                                    <TableHead className="w-16 text-center font-bold text-xs uppercase px-1">م</TableHead>
                                    <TableHead className="px-6 font-bold text-foreground text-right">بيان المـواد / الأصنـاف</TableHead>
                                    <TableHead className="w-24 text-center font-bold text-foreground">الكمية</TableHead>
                                    <TableHead className="w-32 text-center font-bold text-foreground">سعر الوحدة</TableHead>
                                    <TableHead className="w-40 text-left font-bold text-foreground px-8">الإجمالي</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {po.items.map((item, idx) => (
                                    <TableRow key={idx} className="h-16 border-b last:border-0 hover:bg-transparent">
                                        <TableCell className="text-center font-mono text-xs font-bold text-muted-foreground bg-muted/10 border-l">{idx + 1}</TableCell>
                                        <TableCell className="px-6 font-bold text-lg text-right">{item.itemName}</TableCell>
                                        <TableCell className="text-center font-mono font-black text-xl">{item.quantity}</TableCell>
                                        <TableCell className="text-center font-mono font-bold text-primary">{formatCurrency(item.unitPrice)}</TableCell>
                                        <TableCell className="text-left font-mono font-black text-xl px-8 bg-primary/[0.02] border-r">
                                            {formatCurrency(item.total)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter className="bg-primary/5">
                                <TableRow className="h-24 border-t-4 border-primary/20">
                                    <TableCell colSpan={4} className="text-right px-12 font-black text-2xl">إجمالي قيمة أمـر الشـراء:</TableCell>
                                    <TableCell className="text-left font-mono text-3xl font-black text-primary px-8 border-r bg-primary/5">
                                        {formatCurrency(po.totalAmount)}
                                    </TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-8">
                        <div className="space-y-3">
                            <Label className="font-black text-sm text-muted-foreground flex items-center gap-2">
                                <Info className="h-4 w-4"/> تعليمات إضافية للمورد:
                            </Label>
                            <div className="p-6 bg-muted/20 rounded-3xl border border-dashed text-sm italic leading-relaxed min-h-[100px]">
                                {po.notes || 'لا توجد ملاحظات إضافية. يرجى الالتزام بمواصفات المواد وتواريخ التوريد المتفق عليها.'}
                            </div>
                        </div>
                        <div className="flex flex-col justify-center items-center text-center p-6 bg-primary/5 rounded-3xl border border-primary/10">
                            <CheckCircle className="h-10 w-10 text-primary opacity-20 mb-3" />
                            <p className="text-xs text-muted-foreground font-medium leading-loose max-w-xs">
                                هذا المستند يعتبر تعميداً رسمياً من الشركة بالتوريد. يرجى إرفاق نسخة من هذا الأمر مع سند التسليم عند وصول البضاعة للمخازن.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-12 mt-24 text-center text-sm border-t-2 pt-12">
                        <div className="space-y-16">
                            <p className="font-black border-b-2 border-foreground pb-2">قسم المشتريات</p>
                            <div className="pt-2 border-t border-dashed text-[10px] text-muted-foreground">التوقيع والتاريخ</div>
                        </div>
                        <div className="space-y-16">
                            <p className="font-black border-b-2 border-foreground pb-2">اعتماد الإدارة المالية</p>
                            <div className="pt-2 border-t border-dashed text-[10px] text-muted-foreground">الختم والمراجعة</div>
                        </div>
                        <div className="space-y-16">
                            <p className="font-black border-b-2 border-foreground pb-2">استلام المورد</p>
                            <div className="pt-2 border-t border-dashed text-[10px] text-muted-foreground">الموافقة على الطلب</div>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
}
