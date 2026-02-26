'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { InventoryAdjustment } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Printer, ArrowRight, Ban, Calendar, AlertTriangle, Info } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { useBranding } from '@/context/branding-context';
import { toFirestoreDate } from '@/services/date-converter';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Logo } from '@/components/layout/logo';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const typeTranslations: Record<string, string> = {
    damage: 'تسوية تلف مواد',
    theft: 'تسوية فقد / سرقة',
    opening_balance: 'رصيد افتتاحي',
    other: 'تسوية مخزنية أخرى'
};

export default function AdjustmentDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { firestore } = useFirebase();
    const { branding, loading: brandingLoading } = useBranding();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const adjRef = useMemo(() => (firestore && id ? doc(firestore, 'inventoryAdjustments', id) : null), [firestore, id]);
    const { data: adj, loading: adjLoading } = useDocument<InventoryAdjustment>(firestore, adjRef?.path || null);

    const handlePrint = () => window.print();

    if (adjLoading || brandingLoading) {
        return (
            <div className="p-8 max-w-4xl mx-auto space-y-8" dir="rtl">
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-96 w-full rounded-xl" />
            </div>
        );
    }

    if (!adj) return <div className="text-center p-20">لم يتم العثور على إذن التسوية.</div>;

    const adjDate = toFirestoreDate(adj.date);

    return (
        <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6" dir="rtl">
            <div className="flex justify-between items-center no-print">
                <Button variant="ghost" onClick={() => router.back()} className="gap-2">
                    <ArrowRight className="h-4 w-4"/> العودة للقائمة
                </Button>
                <Button onClick={handlePrint} className="gap-2">
                    <Printer className="h-4 w-4"/> طباعة الإذن
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
                            <h2 className="text-2xl font-black text-destructive flex items-center gap-2">
                                <Ban className="h-6 w-6"/> إذن تسوية مخزنية
                            </h2>
                            <p className="font-mono text-sm font-bold">{adj.adjustmentNumber}</p>
                        </div>
                    </div>

                    {/* Info Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-6 mb-10 p-6 bg-red-50/20 rounded-2xl border border-red-100">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                            <div>
                                <p className="text-[10px] uppercase font-bold text-muted-foreground">نوع التسوية:</p>
                                <p className="font-bold text-lg text-destructive">{typeTranslations[adj.type] || adj.type}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Calendar className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="text-[10px] uppercase font-bold text-muted-foreground">تاريخ العملية:</p>
                                <p className="font-bold">{adjDate ? format(adjDate, 'eeee, dd MMMM yyyy', { locale: ar }) : '-'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Info className="h-5 w-5 text-muted-foreground" />
                            <div className="max-w-xs">
                                <p className="text-[10px] uppercase font-bold text-muted-foreground">السبب / البيان:</p>
                                <p className="font-medium text-sm">{adj.notes || '-'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="border rounded-xl overflow-hidden mb-8">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="w-12 text-center">#</TableHead>
                                    <TableHead>الصنف المتأثر</TableHead>
                                    <TableHead className="text-center">الكمية المعدلة</TableHead>
                                    <TableHead className="text-left px-6">القيمة المالية</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {adj.items?.map((item: any, idx: number) => (
                                    <TableRow key={idx}>
                                        <TableCell className="text-center font-mono text-xs">{idx + 1}</TableCell>
                                        <TableCell className="font-bold">{item.itemName}</TableCell>
                                        <TableCell className="text-center font-mono font-black text-lg text-destructive">{item.quantity}</TableCell>
                                        <TableCell className="text-left font-mono font-bold px-6">{formatCurrency(item.totalCost || 0)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter>
                                <TableRow className="bg-red-50/50 h-16">
                                    <TableCell colSpan={3} className="text-right px-8 font-black text-lg text-red-800">إجمالي قيمة التسوية (خسارة):</TableCell>
                                    <TableCell className="text-left font-mono text-xl font-black text-red-700 px-6">
                                        {formatCurrency(adj.items?.reduce((sum, i) => sum + i.totalCost, 0) || 0)}
                                    </TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>

                    {/* Footer Warning */}
                    <div className="p-4 bg-muted/20 rounded-xl border border-dashed text-xs text-muted-foreground flex gap-2">
                        <Info className="h-4 w-4 shrink-0" />
                        <p>هذا المستند يمثل تسوية مخزنية استثنائية. تم خصم الكميات من المخازن وتحميل قيمتها كخسائر أو مصاريف تسوية في النظام المحاسبي آلياً.</p>
                    </div>

                    {/* Signatures */}
                    <div className="grid grid-cols-2 gap-20 mt-32 text-center text-xs">
                        <div className="space-y-12">
                            <p className="font-black border-b-2 border-foreground pb-2">أمين المخزن</p>
                            <div className="pt-2 text-muted-foreground">التوقيع</div>
                        </div>
                        <div className="space-y-12">
                            <p className="font-black border-b-2 border-foreground pb-2">المدير المالي / المحاسب</p>
                            <div className="pt-2 text-muted-foreground">الاعتماد</div>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
}
