
'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { InventoryAdjustment, ConstructionProject } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Printer, ArrowRight, ArrowUpFromLine, Building2, Calendar, ClipboardList, Receipt } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { useBranding } from '@/context/branding-context';
import { toFirestoreDate } from '@/services/date-converter';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Logo } from '@/components/layout/logo';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Link from 'next/link';

export default function MaterialIssueDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { firestore } = useFirebase();
    const { branding, loading: brandingLoading } = useBranding();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const issueRef = useMemo(() => (firestore && id ? doc(firestore, 'inventoryAdjustments', id) : null), [firestore, id]);
    const { data: issue, loading: issueLoading } = useDocument<InventoryAdjustment>(firestore, issueRef?.path || null);

    const handlePrint = () => window.print();

    if (issueLoading || brandingLoading) {
        return (
            <div className="p-8 max-w-4xl mx-auto space-y-8" dir="rtl">
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-96 w-full rounded-xl" />
            </div>
        );
    }

    if (!issue || issue.type !== 'material_issue') return <div className="text-center p-20">لم يتم العثور على إذن الصرف.</div>;

    const issueDate = toFirestoreDate(issue.date);
    const isDirectSale = !!issue.clientId;

    return (
        <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6" dir="rtl">
            <div className="flex justify-between items-center no-print bg-background/80 backdrop-blur-sm sticky top-0 z-10 py-4 border-b">
                <Button variant="ghost" onClick={() => router.back()} className="gap-2">
                    <ArrowRight className="h-4 w-4"/> العودة للقائمة
                </Button>
                <div className="flex gap-2">
                    {isDirectSale && (
                        <Button asChild variant="outline" className="gap-2 rounded-xl border-primary text-primary hover:bg-primary/5">
                            <Link href={`/dashboard/sales/invoices/${id}`}>
                                <Receipt className="h-4 w-4"/> عرض كفاتورة مبيعات
                            </Link>
                        </Button>
                    )}
                    <Button onClick={handlePrint} className="gap-2 rounded-xl">
                        <Printer className="h-4 w-4"/> طباعة إذن الصرف
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
                            <h2 className="text-2xl font-black text-orange-600 flex items-center gap-2">
                                <ArrowUpFromLine className="h-6 w-6"/> {isDirectSale ? 'إذن تسليم مبيعات' : 'إذن صرف مواد للموقع'}
                            </h2>
                            <p className="font-mono text-sm font-bold">{issue.adjustmentNumber}</p>
                        </div>
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10 p-6 bg-orange-50/30 rounded-2xl border border-orange-100">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Building2 className="h-4 w-4 text-orange-600" />
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">الجهة المستلمة:</p>
                                    <p className="font-bold text-lg">{isDirectSale ? 'تسليم مباشر لعميل معرض' : 'مشروع إنشائي - تحميل على المقايسة'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">تاريخ الصرف:</p>
                                    <p className="font-bold">{issueDate ? format(issueDate, 'eeee, dd MMMM yyyy', { locale: ar }) : '-'}</p>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">ملاحظات الإذن:</p>
                                    <p className="font-medium text-sm italic">{issue.notes || 'لا توجد ملاحظات إضافية'}</p>
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
                                    <TableHead>الصنف المنصرف</TableHead>
                                    <TableHead className="text-center">الكمية</TableHead>
                                    <TableHead className="text-left px-6">تكلفة الوحدة</TableHead>
                                    <TableHead className="text-left px-6">إجمالي التكلفة</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {issue.items?.map((item: any, idx: number) => (
                                    <TableRow key={idx}>
                                        <TableCell className="text-center font-mono text-xs">{idx + 1}</TableCell>
                                        <TableCell>
                                            <div className="font-bold">{item.itemName}</div>
                                            {item.boqItemId && <p className="text-[10px] text-muted-foreground">مرتبط ببند المقايسة المعتمد</p>}
                                        </TableCell>
                                        <TableCell className="text-center font-mono font-black text-lg text-orange-600">{item.quantity}</TableCell>
                                        <TableCell className="text-left font-mono">{formatCurrency(item.unitCost || 0)}</TableCell>
                                        <TableCell className="text-left font-mono font-bold px-6">{formatCurrency(item.totalCost || 0)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter>
                                <TableRow className="bg-orange-50/50 h-16">
                                    <TableCell colSpan={4} className="text-right px-8 font-black text-lg text-orange-800">إجمالي التكلفة المنصرفة:</TableCell>
                                    <TableCell className="text-left font-mono text-xl font-black text-orange-700 px-6">
                                        {formatCurrency(issue.items?.reduce((sum, i) => sum + i.totalCost, 0) || 0)}
                                    </TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>

                    {/* Signatures */}
                    <div className="grid grid-cols-3 gap-8 mt-32 text-center text-xs">
                        <div className="space-y-12">
                            <p className="font-black border-b-2 border-foreground pb-2">أمين المخزن (المسلم)</p>
                            <div className="pt-2 text-muted-foreground">التوقيع</div>
                        </div>
                        <div className="space-y-12">
                            <p className="font-black border-b-2 border-foreground pb-2">المسؤول عن الاستلام</p>
                            <div className="pt-2 text-muted-foreground">التوقيع</div>
                        </div>
                        <div className="space-y-12">
                            <p className="font-black border-b-2 border-foreground pb-2">الإدارة المالية</p>
                            <div className="pt-2 text-muted-foreground">المراجعة والاعتماد</div>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
}
