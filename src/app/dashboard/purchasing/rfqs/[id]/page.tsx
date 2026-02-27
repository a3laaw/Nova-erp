'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument, useSubscription } from '@/firebase';
import { doc, collection, query, where, updateDoc, getDocs, arrayUnion, orderBy } from 'firebase/firestore';
import type { RequestForQuotation, Vendor, SupplierQuotation } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ArrowRight, FileText, GanttChartSquare, BarChart, XCircle, Send, AlertTriangle, UserPlus, Loader2, Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toFirestoreDate } from '@/services/date-converter';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { SupplierQuotationCard } from '@/components/purchasing/supplier-quotation-card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useToast } from '@/hooks/use-toast';

const statusColors: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    sent: 'bg-blue-100 text-blue-800',
    closed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
};

const statusTranslations: Record<string, string> = {
    draft: 'مسودة',
    sent: 'مرسل للموردين',
    closed: 'مغلق (تحت المقارنة)',
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
    const [isAddingVendor, setIsAddingVendor] = useState(false);

    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [supplierQuotations, setSupplierQuotations] = useState<SupplierQuotation[]>([]);
    const [dataLoading, setDataLoading] = useState(true);

    const rfqRef = useMemo(() => (firestore && id ? doc(firestore, 'rfqs', id) : null), [firestore, id]);
    const { data: rfq, loading: rfqLoading } = useDocument<RequestForQuotation>(firestore, rfqRef?.path || null);

    // Fetch all system vendors for the "Add Vendor" feature
    const { data: allSystemVendors } = useSubscription<Vendor>(firestore, 'vendors', [orderBy('name')]);

    useEffect(() => {
        if (!firestore || !rfq?.vendorIds || rfq.vendorIds.length === 0) {
            setDataLoading(false);
            return;
        }

        const fetchData = async () => {
            setDataLoading(true);
            try {
                const vendorIds = rfq.vendorIds;
                const chunks = [];
                for (let i = 0; i < vendorIds.length; i += 30) {
                    chunks.push(vendorIds.slice(i, i + 30));
                }

                const vendorPromises = chunks.map(chunk => 
                    getDocs(query(collection(firestore, 'vendors'), where('__name__', 'in', chunk)))
                );
                const vendorSnapshots = await Promise.all(vendorPromises);
                const fetchedVendors = vendorSnapshots.flatMap(snap => 
                    snap.docs.map(d => ({ id: d.id, ...d.data() } as Vendor))
                );
                setVendors(fetchedVendors);

                const quotesSnap = await getDocs(query(collection(firestore, 'supplierQuotations'), where('rfqId', '==', id)));
                setSupplierQuotations(quotesSnap.docs.map(d => ({ id: d.id, ...d.data() } as SupplierQuotation)));

            } catch (err) {
                console.error("Error fetching RFQ related data:", err);
            } finally {
                setDataLoading(false);
            }
        };

        fetchData();
    }, [firestore, rfq?.vendorIds, id]);
    
    const handleChangeStatus = async (newStatus: RequestForQuotation['status']) => {
        if (!rfqRef) return;
        setIsUpdatingStatus(true);
        try {
            await updateDoc(rfqRef, { status: newStatus });
            toast({ title: 'تحديث الحالة', description: `تم تغيير حالة الطلب إلى ${statusTranslations[newStatus]}.` });
        } catch (e) {
            console.error("Failed to update status", e);
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const handleAddVendor = async () => {
        if (!rfqRef || !newVendorId) return;
        setIsAddingVendor(true);
        try {
            await updateDoc(rfqRef, {
                vendorIds: arrayUnion(newVendorId)
            });
            toast({ title: 'تمت الإضافة', description: 'تمت إضافة المورد للطلب بنجاح.' });
            setIsAddVendorOpen(false);
            setNewVendorId('');
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

    const loading = rfqLoading || dataLoading;

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
                                <Button onClick={() => handleChangeStatus('closed')} disabled={isUpdatingStatus} className="bg-green-600 hover:bg-green-700 gap-2 rounded-xl font-bold shadow-lg shadow-green-200">
                                    <XCircle className="h-4 w-4" /> إغلاق وبدء المقارنة
                                </Button>
                            )}
                            {rfq.status === 'closed' && (
                                <Button asChild className="bg-primary shadow-lg shadow-primary/20 gap-2 rounded-xl font-bold">
                                    <Link href={`/dashboard/purchasing/rfqs/${id}/compare`}>
                                        <BarChart className="h-4 w-4" /> مصفوفة المقارنة
                                    </Link>
                                </Button>
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
                {vendors.map(vendor => {
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
                {vendors.length === 0 && (
                    <div className="col-span-full h-48 flex flex-col items-center justify-center border-2 border-dashed rounded-[2rem] bg-muted/5 opacity-40">
                        <Search className="h-12 w-12 mb-2" />
                        <p className="font-bold">لا يوجد موردون حالياً، أضف مورد لبدء التسعير.</p>
                    </div>
                )}
            </div>

            {/* Add Vendor Dialog */}
            <Dialog open={isAddVendorOpen} onOpenChange={setIsAddVendorOpen}>
                <DialogContent dir="rtl" className="rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>إضافة مورد لطلب التسعير</DialogTitle>
                        <DialogDescription>يمكنك إضافة مورد جديد لهذا الطلب حتى بعد إرساله لاستقبال عرضه ومقارنته مع البقية.</DialogDescription>
                    </DialogHeader>
                    <div className="py-6">
                        <Label className="mb-2 block font-bold">اختر المورد من القائمة:</Label>
                        <InlineSearchList 
                            value={newVendorId}
                            onSelect={setNewVendorId}
                            options={vendorOptions}
                            placeholder="ابحث باسم المورد..."
                            className="h-12 rounded-xl"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsAddVendorOpen(false)} disabled={isAddingVendor}>إلغاء</Button>
                        <Button onClick={handleAddVendor} disabled={!newVendorId || isAddingVendor} className="rounded-xl px-8">
                            {isAddingVendor ? <Loader2 className="h-4 w-4 animate-spin ml-2"/> : <PlusCircle className="h-4 w-4 ml-2"/>}
                            تأكيد الإضافة للطلب
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
