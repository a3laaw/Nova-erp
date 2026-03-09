
'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument, useSubscription } from '@/firebase';
import { doc, collection, query, where, updateDoc, arrayUnion, orderBy, writeBatch, getDocs, deleteField } from 'firebase/firestore';
import type { RequestForQuotation, Vendor, SupplierQuotation, PurchaseOrder } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ArrowRight, FileText, GanttChartSquare, BarChart, XCircle, Send, UserPlus, Loader2, Search, PlusCircle, Undo2, UserSearch, AlertCircle, Sparkles } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toFirestoreDate } from '@/services/date-converter';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { SupplierQuotationCard } from '@/components/purchasing/supplier-quotation-card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';

const statusColors: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    sent: 'bg-blue-100 text-blue-800',
    closed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
};

const statusTranslations: Record<string, string> = {
    draft: 'مسودة',
    sent: 'مرسل للموردين',
    closed: 'مغلق (مرحلة الترسية)',
    cancelled: 'ملغي',
};

export default function RfqDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [isAddVendorOpen, setIsAddVendorOpen] = useState(false);
    const [newVendorId, setNewVendorId] = useState('');
    const [prospectiveName, setProspectiveName] = useState('');
    const [isAddingVendor, setIsAddingVendor] = useState(false);

    // 1. اشتراك لحظي في وثيقة طلب التسعير
    const rfqRef = useMemo(() => (firestore && id ? doc(firestore, 'rfqs', id) : null), [firestore, id]);
    const { data: rfq, loading: rfqLoading } = useDocument<RequestForQuotation>(firestore, rfqRef ? rfqRef.path : null);

    // 2. اشتراك لحظي في جميع الموردين
    const { data: allSystemVendors, loading: vendorsLoading } = useSubscription<Vendor>(firestore, 'vendors', [orderBy('name')]);

    // 3. اشتراك لحظي في عروض الأسعار
    const quotesQuery = useMemo(() => [where('rfqId', '==', id)], [id]);
    const { data: supplierQuotations } = useSubscription<SupplierQuotation>(firestore, 'supplierQuotations', quotesQuery);

    const displayVendors = useMemo(() => {
        if (!rfq || !allSystemVendors) return [];
        const registered = allSystemVendors.filter(v => rfq.vendorIds?.includes(v.id!));
        const prospective = rfq.prospectiveVendors || [];
        return [...registered, ...prospective];
    }, [rfq, allSystemVendors]);
    
    const handleReopenRfq = async () => {
        if (!rfqRef || !firestore || !rfq) return;

        setIsUpdatingStatus(true);
        try {
            const poIds = rfq.awardedPoIds || [];
            if (poIds.length > 0) {
                const grnsQuery = query(collection(firestore, 'grns'), where('purchaseOrderId', 'in', poIds));
                const grnsSnap = await getDocs(grnsQuery);
                const activeGrns = grnsSnap.docs.filter(d => d.data().status !== 'cancelled');

                if (activeGrns.length > 0) {
                    toast({
                        variant: 'destructive',
                        title: 'منع التراجع الرقابي',
                        description: 'لا يمكن التراجع عن الترسية بعد أن تم استلام بضاعة للمخزن فعلياً. يجب إلغاء أذونات الاستلام أولاً.'
                    });
                    setIsUpdatingStatus(false);
                    return;
                }
            }

            const batch = writeBatch(firestore);
            poIds.forEach(poId => {
                batch.delete(doc(firestore, 'purchaseOrders', poId));
            });

            batch.update(rfqRef, {
                status: 'sent',
                awardedVendorId: deleteField(),
                awardedPoIds: deleteField(),
                awardedItems: deleteField()
            });

            await batch.commit();
            toast({ title: 'تم التراجع عن الترسية', description: 'تم حذف أوامر الشراء غير المنفذة وإعادة فتح الطلب للمقارنة.' });
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل التراجع عن الترسية.' });
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const handleChangeStatus = async (newStatus: RequestForQuotation['status']) => {
        if (!rfqRef) return;
        if (newStatus === 'closed' && supplierQuotations.length === 0) {
            toast({ variant: 'destructive', title: 'منع الإغلاق', description: 'يجب إضافة عرض سعر واحد على الأقل قبل الإغلاق.' });
            return;
        }
        setIsUpdatingStatus(true);
        try {
            await updateDoc(rfqRef, { status: newStatus });
            toast({ title: 'تحديث الحالة', description: `تم تغيير حالة الطلب إلى ${statusTranslations[newStatus]}.` });
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تحديث الحالة.' });
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const handleAddVendor = async (type: 'registered' | 'prospective') => {
        if (!rfqRef) return;
        setIsAddingVendor(true);
        try {
            if (type === 'registered') {
                if (!newVendorId) return;
                await updateDoc(rfqRef, { vendorIds: arrayUnion(newVendorId) });
            } else {
                if (!prospectiveName.trim()) return;
                const tempId = `prospective-${Math.random().toString(36).substring(2, 9)}`;
                await updateDoc(rfqRef, { prospectiveVendors: arrayUnion({ id: tempId, name: prospectiveName.trim() }) });
            }
            toast({ title: 'نجاح', description: 'تمت إضافة المورد للطلب.' });
            setIsAddVendorOpen(false);
            setNewVendorId('');
            setProspectiveName('');
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل إضافة المورد.' });
        } finally {
            setIsAddingVendor(false);
        }
    };

    const vendorOptions = useMemo(() => {
        const existingIds = new Set(rfq?.vendorIds || []);
        return (allSystemVendors || []).filter(v => !existingIds.has(v.id!)).map(v => ({ value: v.id!, label: v.name }));
    }, [allSystemVendors, rfq?.vendorIds]);

    if (rfqLoading || vendorsLoading) return <div className="space-y-6" dir="rtl"><Skeleton className="h-32 w-full rounded-2xl" /><div className="grid md:grid-cols-3 gap-6"><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" /></div></div>;
    if (!rfq) return <div className="text-center py-20 text-muted-foreground">لم يتم العثور على طلب التسعير.</div>;

    const safeDate = toFirestoreDate(rfq.date);
    const hasQuotes = (supplierQuotations || []).length > 0;

    return (
        <div className="space-y-6" dir="rtl">
             <Card className="rounded-2xl border-none shadow-sm bg-gradient-to-l from-white to-sky-50">
                <CardHeader>
                     <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <CardTitle className="text-3xl font-black flex items-center gap-2">
                                    <FileText className="text-primary"/>
                                    {`طلب تسعير #${rfq.rfqNumber}`}
                                </CardTitle>
                                <Badge className={cn("text-xs px-3", statusColors[rfq.status])}>{statusTranslations[rfq.status]}</Badge>
                            </div>
                            <CardDescription className="text-base font-medium">
                                تاريخ الطلب: {safeDate ? format(safeDate, 'eeee, dd MMMM yyyy', { locale: ar }) : '-'}
                            </CardDescription>
                        </div>
                         <div className="flex gap-2">
                            {rfq.status === 'draft' && (
                                <Button onClick={() => handleChangeStatus('sent')} disabled={isUpdatingStatus} className="gap-2 rounded-xl font-bold">
                                    <Send className="h-4 w-4" /> إرسال الطلب
                                </Button>
                            )}
                            {rfq.status === 'sent' && (
                                <Button onClick={() => handleChangeStatus('closed')} disabled={isUpdatingStatus} className="bg-green-600 hover:bg-green-700 gap-2 rounded-xl font-bold shadow-lg shadow-green-100">
                                    <XCircle className="h-4 w-4" /> إغلاق وبدء المقارنة
                                </Button>
                            )}
                            
                            {/* زر المقارنة الذكية - يظهر الآن بمجرد وجود أي عرض سعر */}
                            {hasQuotes && rfq.status !== 'draft' && (
                                <Button asChild className="bg-gradient-to-r from-primary to-indigo-600 shadow-lg shadow-primary/20 gap-2 rounded-xl font-black text-base animate-in zoom-in-95">
                                    <Link href={`/dashboard/purchasing/rfqs/${id}/compare`}>
                                        <Sparkles className="h-5 w-5" /> مصفوفة المقارنة والترسية
                                    </Link>
                                </Button>
                            )}

                            {rfq.status === 'closed' && (
                                <Button onClick={handleReopenRfq} disabled={isUpdatingStatus} variant="outline" className="gap-2 rounded-xl font-bold border-orange-200 text-orange-700 hover:bg-orange-50">
                                    {isUpdatingStatus ? <Loader2 className="h-4 w-4 animate-spin"/> : <Undo2 className="h-4 w-4" />}
                                    تراجع عن الترسية
                                </Button>
                            )}
                            <Button variant="ghost" onClick={() => router.back()} className="gap-2"><ArrowRight className="h-4 w-4"/> العودة</Button>
                         </div>
                    </div>
                </CardHeader>
                 <CardContent>
                    <div className="p-4 bg-white/50 rounded-xl border flex flex-col md:flex-row justify-between gap-4">
                        <div className="flex-grow">
                            <h3 className="text-sm font-bold text-muted-foreground mb-3">الأصناف المطلوبة:</h3>
                            <div className="flex flex-wrap gap-2">
                                {rfq.items.map(item => (
                                    <Badge key={item.id} variant="secondary" className="bg-background border shadow-sm">
                                        {item.itemName} ({item.quantity})
                                    </Badge>
                                ))}
                            </div>
                        </div>
                        {rfq.status !== 'closed' && (
                            <Button variant="outline" className="rounded-xl border-dashed border-primary/50 text-primary gap-2 h-auto py-3" onClick={() => setIsAddVendorOpen(true)}>
                                <UserPlus className="h-5 w-5" /> إضافة مورد
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            <div className="flex items-center gap-3 mb-2">
                <GanttChartSquare className="text-primary h-6 w-6" />
                <h3 className="text-xl font-black">عروض أسعار الموردين ({(supplierQuotations || []).length})</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayVendors.map(vendor => {
                    const existingQuote = supplierQuotations?.find(q => q.vendorId === vendor.id);
                    return <SupplierQuotationCard key={vendor.id} rfq={rfq} vendor={vendor} existingQuote={existingQuote} />;
                })}
            </div>

            <Dialog open={isAddVendorOpen} onOpenChange={setIsAddVendorOpen}>
                <DialogContent dir="rtl" className="rounded-2xl max-w-lg">
                    <DialogHeader>
                        <DialogTitle>إضافة مورد للطلب</DialogTitle>
                        <DialogDescription>اختر مورد مسجل أو أدخل بيانات مورد محتمل جديد.</DialogDescription>
                    </DialogHeader>
                    <Tabs defaultValue="registered" className="py-4">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="registered">مورد مسجل</TabsTrigger>
                            <TabsTrigger value="prospective">مورد محتمل</TabsTrigger>
                        </TabsList>
                        <TabsContent value="registered" className="space-y-4 pt-4">
                            <div className="grid gap-2">
                                <Label>اختر المورد:</Label>
                                <InlineSearchList value={newVendorId} onSelect={setNewVendorId} options={vendorOptions} placeholder="ابحث..." />
                            </div>
                            <Button onClick={() => handleAddVendor('registered')} disabled={!newVendorId || isAddingVendor} className="w-full h-12 rounded-xl">
                                {isAddingVendor ? <Loader2 className="h-4 w-4 animate-spin ml-2"/> : <PlusCircle className="h-4 w-4 ml-2"/>} إضافة المورد
                            </Button>
                        </TabsContent>
                        <TabsContent value="prospective" className="space-y-4 pt-4">
                            <div className="grid gap-2">
                                <Label>اسم المورد المحتمل:</Label>
                                <Input value={prospectiveName} onChange={(e) => setProspectiveName(e.target.value)} placeholder="اسم الشركة..." />
                            </div>
                            <Button onClick={() => handleAddVendor('prospective')} disabled={!prospectiveName.trim() || isAddingVendor} className="w-full h-12 rounded-xl bg-orange-600">
                                {isAddingVendor ? <Loader2 className="h-4 w-4 animate-spin ml-2"/> : <UserSearch className="h-4 w-4 ml-2"/>} إضافة محتمل
                            </Button>
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>
        </div>
    );
}
