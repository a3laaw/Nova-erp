'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { PurchaseOrder, Vendor } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Printer, ArrowRight, ShoppingCart, Calendar, User, Target } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { useBranding } from '@/context/branding-context';
import { toFirestoreDate } from '@/services/date-converter';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Logo } from '@/components/layout/logo';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';

const statusColors: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-blue-100 text-blue-800',
    received: 'bg-green-100 text-green-800',
    partially_received: 'bg-indigo-100 text-indigo-800',
    cancelled: 'bg-red-100 text-red-800',
};

const statusTranslations: Record<string, string> = {
    draft: 'مسودة',
    approved: 'معتمد',
    received: 'تم الاستلام',
    partially_received: 'مستلم جزئياً',
    cancelled: 'ملغي',
};

export default function PurchaseOrderDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { firestore } = useFirebase();
    const { branding, loading: brandingLoading } = useBranding();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const poRef = useMemo(() => (firestore && id ? doc(firestore, 'purchaseOrders', id) : null), [firestore, id]);
    const { data: po, loading: poLoading } = useDocument<PurchaseOrder>(firestore, poRef?.path || null);

    const handlePrint = () => window.print();

    if (poLoading || brandingLoading) {
        return (
            <div className="p-8 max-w-4xl mx-auto space-y-8" dir="rtl">
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-96 w-full rounded-xl" />
            </div>
        );
    }

    if (!po) return <div className="text-center p-20">لم يتم العثور على أمر الشراء.</div>;

    const orderDate = toFirestoreDate(po.orderDate);

    return (
        <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6" dir="rtl">
            <div className="flex justify-between items-center no-print">
                <Button variant="ghost" onClick={() => router.back()} className="gap-2">
                    <ArrowRight className="h-4 w-4"/> العودة للقائمة
                </Button>
                <Button onClick={handlePrint} className="gap-2">
                    <Printer className="h-4 w-4"/> طباعة أمر الشراء
                </Button>
            </div>

            <Card className="print:border-none shadow-lg rounded-2xl overflow-hidden bg-white dark:bg-card">
                <div id="printable-area" className="p-8 sm:p-12 print:p-0">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-10 border-b-2 pb-6">
                        <div className="flex items-center gap-4">
                            <Logo className="h-16 w-16 !p-2" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                            <div>
                                <h1 className="text-xl font-black">{branding?.company_name || 'Nova ERP'}</h1>
                                <p className="text-xs text-muted-foreground">{branding?.address}</p>
                            </div>
                        </div>
                        <div className="text-left space-y-1">
                            <h2 className="text-2xl font-black text-primary">أمر شراء / Purchase Order</h2>
                            <p className="font-mono text-sm font-bold">{po.poNumber}</p>
                            <Badge variant="outline" className={cn("mt-1", statusColors[po.status])}>
                                الحالة: {statusTranslations[po.status]}
                            </Badge>
                        </div>
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">المورد:</p>
                                    <p className="font-bold text-lg">{po.vendorName}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">تاريخ الطلب:</p>
                                    <p className="font-bold">{orderDate ? format(orderDate, 'eeee, dd MMMM yyyy', { locale: ar }) : '-'}</p>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {po.projectId && (
                                <div className="flex items-center gap-3">
                                    <Target className="h-4 w-4 text-primary" />
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground">مرتبط بالمشروع:</p>
                                        <p className="font-bold text-primary">مركز تكلفة محدد</p>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center gap-3">
                                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">شروط الدفع:</p>
                                    <p className="font-bold">{po.paymentTerms || 'حسب الاتفاق المسبق'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="border rounded-xl overflow-hidden mb-8">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="w-12 text-center">#</TableHead>
                                    <TableHead>بيان المواد المطلوبة</TableHead>
                                    <TableHead className="text-center">الكمية</TableHead>
                                    <TableHead className="text-center">سعر الوحدة</TableHead>
                                    <TableHead className="text-left px-6">الإجمالي</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {po.items.map((item, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell className="text-center font-mono text-xs">{idx + 1}</TableCell>
                                        <TableCell className="font-bold">{item.itemName}</TableCell>
                                        <TableCell className="text-center font-mono">{item.quantity}</TableCell>
                                        <TableCell className="text-center font-mono">{formatCurrency(item.unitPrice)}</TableCell>
                                        <TableCell className="text-left font-mono font-bold px-6">{formatCurrency(item.total)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter>
                                <TableRow className="bg-primary/5 h-16">
                                    <TableCell colSpan={4} className="text-right px-8 font-black text-lg">المجموع الإجمالي للطلب:</TableCell>
                                    <TableCell className="text-left font-mono text-xl font-black text-primary px-6">
                                        {formatCurrency(po.totalAmount)}
                                    </TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>

                    {po.notes && (
                        <div className="mb-10">
                            <Label className="font-bold text-muted-foreground block mb-2">ملاحظات إضافية:</Label>
                            <p className="p-4 bg-muted/30 rounded-xl text-sm italic">{po.notes}</p>
                        </div>
                    )}

                    {/* Signatures */}
                    <div className="grid grid-cols-3 gap-8 mt-20 text-center text-xs">
                        <div className="space-y-10">
                            <p className="font-bold border-b pb-2">أعد بواسطة</p>
                            <div className="h-1 bg-muted w-24 mx-auto" />
                        </div>
                        <div className="space-y-10">
                            <p className="font-bold border-b pb-2">المدير المسؤول</p>
                            <div className="h-1 bg-muted w-24 mx-auto" />
                        </div>
                        <div className="space-y-10">
                            <p className="font-bold border-b pb-2">اعتماد المورد</p>
                            <div className="h-1 bg-muted w-24 mx-auto" />
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
}
