'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument, useSubscription } from '@/firebase';
import { doc, collection, query, where, updateDoc, arrayUnion, orderBy } from 'firebase/firestore';
import type { RequestForQuotation, Vendor, SupplierQuotation } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ArrowRight, FileText, GanttChartSquare, BarChart, XCircle, Send, UserPlus, Loader2, Search, PlusCircle, Undo2, UserSearch, AlertCircle } from 'lucide-react';
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

    // 2. اشتراك لحظي في جميع الموردين للمطابقة
    const { data: allSystemVendors, loading: vendorsLoading } = useSubscription<Vendor>(firestore, 'vendors', [orderBy('name')]);

    // 3. اشتراك لحظي في عروض الأسعار المرتبطة بهذا الطلب
    const quotesQuery = useMemo(() => {
        if (!firestore || !id) return [];
        return [where('rfqId', '==', id)];
    }, [firestore, id]);
    const { data: supplierQuotations, loading: quotesLoading } = useSubscription<SupplierQuotation>(firestore, 'supplierQuotations', quotesQuery);

    // 4. دمج الموردين (المسجلين والمحتملين) بشكل تفاعلي
    const displayVendors = useMemo(() => {
        if (!rfq || !allSystemVendors) return [];
        
        const registered = allSystemVendors.filter(v => rfq.vendorIds?.includes(v.id!));
        const prospective = rfq.prospectiveVendors || [];
        
        return [...registered, ...prospective];
    }, [rfq, allSystemVendors]);
    
    const handleChangeStatus = async (newStatus: RequestForQuotation['status']) => {
        if (!rfqRef) return;

        // الرقابة: منع الإغلاق إذا لم توجد عروض أسعار
        if (newStatus === 'closed' && supplierQuotations.length === 0) {
            toast({
                variant: 'destructive',
                title: 'لا يمكن البدء بالمقارنة',
                description: 'يجب إضافة عرض سعر واحد على الأقل من الموردين قبل إغلاق باب التقديم والبدء في الترسية.'
            });
            return;
        }

        setIsUpdatingStatus(true);
        try {
            await updateDoc(rfqRef, { status: newStatus });
            toast({ title: 'تحديث الحالة', description: `تم تغيير حالة الطلب إلى ${statusTranslations[newStatus]}.` });
        } catch (e) {
            console.error("Failed to update status", e);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تحديث حالة الطلب.' });
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
                await updateDoc(rfqRef, {
                    vendorIds: arrayUnion(newVendorId)
                });
            } else {
                if (!prospectiveName.trim()) return;
                const tempId = `prospective-${Math.random().toString(36).substring(2, 9)}`;
                await updateDoc(rfqRef, {
                    prospectiveVendors: arrayUnion({ id: tempId, name: prospectiveName.trim() })
                });
            }
            
            toast({ title: 'تمت الإضافة', description: 'تمت إضافة المورد للطلب بنجاح.' });
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
        return (allSystemVendors || [])
            .filter(v => !existingIds.has(v.id!))
            .map(v => ({ value: v.id!, label: v.name }));
    }, [allSystemVendors, rfq?.vendorIds]);

    const loading = rfqLoading || vendorsLoading;

    if (loading) {
        return (
            <div className="space-y-6" dir="rtl">
                <Skeleton className="h-32 w-full rounded-2xl" />
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Skeleton className="h-64 w-full rounded-2xl" />
                    <Skeleton className="h-64 w-full rounded-2xl" />
                    <Skeleton className="h-64 w-full rounded-2xl" />
                </div>
            </div>
        );
    }
    
    if (!rfq) return <div className="text-center py-20 text-muted-foreground">لم يتم العثور على طلب التسعير.</div>;

    const safeDate = toFirestoreDate(rfq.date);

    return (
        <div className="space-y-6" dir="rtl">
             <Card className="rounded-2xl border-none shadow-sm bg-gradient-to-l from-white to-sky-50 dark:from-card dark:to-card">
                <CardHeader>
                     <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <CardTitle className="text-3xl font-black text-foreground flex items-center gap-2">
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
                                <Button 
                                    onClick={() => handleChangeStatus('closed')} 
                                    disabled={isUpdatingStatus} 
                                    className={cn(
                                        "bg-green-600 hover:bg-green-700 gap-2 rounded-xl font-bold shadow-lg",
                                        supplierQuotations.length === 0 ? "opacity-50" : "shadow-green-200"
                                    )}
                                >
                                    <XCircle className="h-4 w-4" /> إغلاق وبدء المقارنة
                                </Button>
                            )}
                            {rfq.status === 'closed' && (
                                <>
                                    <Button onClick={() => handleChangeStatus('sent')} disabled={isUpdatingStatus} variant="outline" className="gap-2 rounded-xl font-bold border-orange-200 text-orange-700 hover:bg-orange-50">
                                        <Undo2 className="h-4 w-4" /> إعادة فتح لاستلام العروض
                                    </Button>
                                    <Button asChild className="bg-primary shadow-lg shadow-primary/20 gap-2 rounded-xl font-bold">
                                        <Link href={`/dashboard/purchasing/rfqs/${id}/compare`}>
                                            <BarChart className="h-4 w-4" /> مصفوفة المقارنة والترسية
                                        </Link>
                                    </Button>
                                </>
                            )}
                            <Button variant="ghost" onClick={() => router.back()} className="gap-2 rounded-xl"><ArrowRight className="h-4 w-4"/> العودة</Button>
                         </div>
                    </div>
                </CardHeader>
                 <CardContent>
                    <div className="p-4 bg-white/50 dark:bg-muted/20 rounded-xl border flex flex-col md:flex-row justify-between gap-4">
                        <div className="flex-grow">
                            <h3 className="text-sm font-bold text-muted-foreground mb-3">الأصناف المطلوبة للتحليل:</h3>
                            <div className="flex flex-wrap gap-2">
                                {rfq.items.map(item => (
                                    <Badge key={item.id} variant="secondary" className="px-3 py-1 text-xs font-bold bg-background border shadow-sm">
                                        {item.itemName} ({item.quantity})
                                    </Badge>
                                ))}
                            </div>
                        </div>
                        {rfq.status !== 'closed' && (
                            <Button variant="outline" className="rounded-xl border-dashed border-primary/50 text-primary hover:bg-primary/5 gap-2 h-auto py-3" onClick={() => setIsAddVendorOpen(true)}>
                                <UserPlus className="h-5 w-5" />
                                إضافة مورد إضافي للطلب
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            <div className="flex items-center gap-3 mb-2">
                <GanttChartSquare className="text-primary h-6 w-6" />
                <h3 className="text-xl font-black">عروض أسعار الموردين المستلمة</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayVendors.map(vendor => {
                    const existingQuote = supplierQuotations.find(q => q.vendorId === vendor.id);
                    return (
                        <SupplierQuotationCard 
                            key={vendor.id}
                            rfq={rfq}
                            vendor={vendor}
                            existingQuote={existingQuote}
                        />
                    )
                })}
                {!loading && displayVendors.length === 0 && (
                    <div className="col-span-full h-48 flex flex-col items-center justify-center border-2 border-dashed rounded-[2rem] bg-muted/5 opacity-40">
                        <Search className="h-12 w-12 mb-2" />
                        <p className="font-bold">لا يوجد موردون حالياً، أضف مورد لبدء التسعير.</p>
                    </div>
                )}
            </div>

            {/* Add Vendor Dialog */}
            <Dialog open={isAddVendorOpen} onOpenChange={setIsAddVendorOpen}>
                <DialogContent dir="rtl" className="rounded-2xl max-w-lg">
                    <DialogHeader>
                        <DialogTitle>إضافة مورد لطلب التسعير</DialogTitle>
                        <DialogDescription>يمكنك اختيار مورد مسجل من النظام أو إدخال مورد محتمل جديد لهذا الطلب فقط.</DialogDescription>
                    </DialogHeader>
                    
                    <Tabs defaultValue="registered" className="py-4">
                        <TabsList className="grid w-full grid-cols-2 rounded-xl">
                            <TabsTrigger value="registered">مورد مسجل</TabsTrigger>
                            <TabsTrigger value="prospective">مورد محتمل</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="registered" className="space-y-4 pt-4">
                            <div className="grid gap-2">
                                <Label className="font-bold">اختر المورد من القائمة:</Label>
                                <InlineSearchList 
                                    value={newVendorId}
                                    onSelect={setNewVendorId}
                                    options={vendorOptions}
                                    placeholder="ابحث باسم المورد..."
                                    className="h-12 rounded-xl"
                                />
                            </div>
                            <Button onClick={() => handleAddVendor('registered')} disabled={!newVendorId || isAddingVendor} className="w-full h-12 rounded-xl font-bold">
                                {isAddingVendor ? <Loader2 className="h-4 w-4 animate-spin ml-2"/> : <PlusCircle className="h-4 w-4 ml-2"/>}
                                إضافة المورد المختار
                            </Button>
                        </TabsContent>
                        
                        <TabsContent value="prospective" className="space-y-4 pt-4">
                            <div className="grid gap-2">
                                <Label className="font-bold">اسم المورد المحتمل:</Label>
                                <Input 
                                    value={prospectiveName} 
                                    onChange={(e) => setProspectiveName(e.target.value)} 
                                    placeholder="ادخل اسم الشركة أو المورد..." 
                                    className="h-12 rounded-xl border-2"
                                />
                            </div>
                            <Button onClick={() => handleAddVendor('prospective')} disabled={!prospectiveName.trim() || isAddingVendor} className="w-full h-12 rounded-xl font-bold bg-orange-600 hover:bg-orange-700">
                                {isAddingVendor ? <Loader2 className="h-4 w-4 animate-spin ml-2"/> : <UserSearch className="h-4 w-4 ml-2"/>}
                                إضافة كمورد محتمل
                            </Button>
                        </TabsContent>
                    </Tabs>
                    
                    <DialogFooter className="mt-4">
                        <Button variant="ghost" onClick={() => setIsAddVendorOpen(false)} disabled={isAddingVendor}>إلغاء</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
