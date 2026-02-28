
'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Printer, ArrowRight, FileCheck, Package, Building2, Calendar, FileText } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { useBranding } from '@/context/branding-context';
import { toFirestoreDate } from '@/services/date-converter';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Logo } from '@/components/layout/logo';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Link from 'next/link';

export default function GrnDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { firestore } = useFirebase();
    const { branding, loading: brandingLoading } = useBranding();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const grnRef = useMemo(() => (firestore && id ? doc(firestore, 'grns', id) : null), [firestore, id]);
    const { data: grn, loading: grnLoading } = useDocument<any>(firestore, grnRef?.path || null);

    const handlePrint = () => window.print();

    if (grnLoading || brandingLoading) {
        return (
            <div className="p-8 max-w-4xl mx-auto space-y-8" dir="rtl">
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-96 w-full rounded-xl" />
            </div>
        );
    }

    if (!grn) return <div className="text-center p-20">لم يتم العثور على إذن الاستلام.</div>;

    const grnDate = toFirestoreDate(grn.date);

    return (
        <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6" dir="rtl">
            <div className="flex justify-between items-center no-print bg-background/80 backdrop-blur-sm sticky top-0 z-10 py-4 border-b">
                <Button variant="ghost" onClick={() => router.back()} className="gap-2">
                    <ArrowRight className="h-4 w-4"/> العودة للقائمة
                </Button>
                <div className="flex gap-2">
                    <Button asChild variant="outline" className="gap-2 rounded-xl border-blue-600 text-blue-700 hover:bg-blue-50">
                        <Link href={`/dashboard/purchasing/invoices/${id}`}>
                            <FileText className="h-4 w-4"/> عرض كفاتورة مشتريات
                        </Link>
                    </Button>
                    <Button onClick={handlePrint} className="gap-2 rounded-xl">
                        <Printer className="h-4 w-4"/> طباعة إذن الاستلام
                    </Button>
                </div>
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
                            <h2 className="text-2xl font-black text-primary flex items-center gap-2">
                                <FileCheck className="h-6 w-6"/> إذن استلام مواد (GRN)
                            </h2>
                            <p className="font-mono text-sm font-bold">{grn.grnNumber}</p>
                            <p className="text-xs text-muted-foreground">عن طلب شراء: {grn.purchaseOrderId?.substring(0,8)}</p>
                        </div>
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10 p-6 bg-muted/20 rounded-2xl border">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">المورد:</p>
                                    <p className="font-bold text-lg">{grn.vendorName}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">تاريخ الاستلام:</p>
                                    <p className="font-bold">{grnDate ? format(grnDate, 'eeee, dd MMMM yyyy', { locale: ar }) : '-'}</p>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Package className="h-4 w-4 text-primary" />
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">المستودع المستلم:</p>
                                    <p className="font-bold text-primary">تمت تغذية المخزن الرئيسي</p>
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
                                    <TableHead>اسم الصنف المستلم</TableHead>
                                    <TableHead className="text-center">الكمية المستلمة</TableHead>
                                    <TableHead className="text-center">رقم التشغيلة (Batch)</TableHead>
                                    <TableHead className="text-left px-6">القيمة الدفترية</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {grn.itemsReceived?.map((item: any, idx: number) => (
                                    <TableRow key={idx}>
                                        <TableCell className="text-center font-mono text-xs">{idx + 1}</TableCell>
                                        <TableCell className="font-bold">{item.itemName}</TableCell>
                                        <TableCell className="text-center font-mono font-black text-lg text-primary">{item.quantityReceived}</TableCell>
                                        <TableCell className="text-center text-xs opacity-60">{item.batchNumber || '-'}</TableCell>
                                        <TableCell className="text-left font-mono font-bold px-6">{formatCurrency(item.total || 0)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter>
                                <TableRow className="bg-primary/5 h-16">
                                    <TableCell colSpan={4} className="text-right px-8 font-black text-lg">إجمالي قيمة التوريد:</TableCell>
                                    <TableCell className="text-left font-mono text-xl font-black text-primary px-6">
                                        {formatCurrency(grn.totalValue || 0)}
                                    </TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>

                    {/* Signatures */}
                    <div className="grid grid-cols-2 gap-20 mt-32 text-center text-xs">
                        <div className="space-y-12">
                            <p className="font-black border-b-2 border-foreground pb-2">أمين المخزن (المستلم)</p>
                            <div className="pt-2 text-muted-foreground">التوقيع والتاريخ</div>
                        </div>
                        <div className="space-y-12">
                            <p className="font-black border-b-2 border-foreground pb-2">المحاسبة (إثبات القيد)</p>
                            <div className="pt-2 text-muted-foreground">الختم والمراجعة</div>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
}
