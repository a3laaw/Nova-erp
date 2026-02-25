'use client';
import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument, useSubscription } from '@/firebase';
import type { Boq, BoqItem } from '@/lib/types';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, FileText, Pencil, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { toFirestoreDate } from '@/services/date-converter';
import { formatCurrency, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Logo } from '@/components/layout/logo';
import { useBranding } from '@/context/branding-context';

export default function BoqDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { firestore } = useFirebase();
    const { branding, loading: brandingLoading } = useBranding();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const boqRef = useMemo(() => firestore && id ? doc(firestore, 'boqs', id) : null, [firestore, id]);
    const { data: boq, loading: boqLoading } = useDocument<Boq>(firestore, boqRef?.path || null);

    const itemsQuery = useMemo(() => {
        if (!boqRef) return null;
        return [orderBy('itemNumber')];
    }, [boqRef]);

    const { data: items, loading: itemsLoading } = useSubscription<BoqItem>(
        firestore, 
        boqRef ? `${boqRef.path}/items` : null, 
        itemsQuery || []
    );

    const loading = boqLoading || itemsLoading || brandingLoading;

    if (loading) {
        return (
            <div className="space-y-4 max-w-5xl mx-auto p-8">
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-96 w-full rounded-xl" />
            </div>
        );
    }
    
    if (!boq) {
        return <div className="text-center p-20 text-muted-foreground">لم يتم العثور على جدول الكميات المطلوبة.</div>;
    }
    
    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto p-2 sm:p-6" dir="rtl">
            {/* Action Bar - Hidden in Print */}
            <div className="flex justify-between items-center no-print bg-background/80 backdrop-blur-sm sticky top-0 z-10 py-4 border-b">
                <Button variant="ghost" onClick={() => router.back()} className="gap-2">
                    <ArrowRight className="h-4 w-4"/> 
                    العودة للقائمة
                </Button>
                <div className="flex gap-3">
                    <Button asChild variant="outline" className="gap-2">
                        <Link href={`/dashboard/construction/boq/${id}/edit`}>
                            <Pencil className="h-4 w-4"/> 
                            تعديل البيانات
                        </Link>
                    </Button>
                    <Button onClick={handlePrint} className="gap-2 shadow-lg shadow-primary/20">
                        <Printer className="h-4 w-4"/> 
                        طباعة الجدول
                    </Button>
                </div>
            </div>

            {/* Printable Document Container */}
            <Card className="print:border-none shadow-xl print:shadow-none rounded-3xl overflow-hidden bg-white dark:bg-card">
                <div id="printable-area" className="p-8 sm:p-12 print:p-0">
                    {/* Print Header */}
                    <div className="flex justify-between items-start mb-10 border-b-4 border-primary/20 pb-6">
                        <div className="flex items-center gap-5">
                            <Logo className="h-20 w-20 !p-3 shadow-inner" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                            <div>
                                <h1 className="text-2xl font-black text-foreground">{branding?.company_name || 'شركة المقاولات'}</h1>
                                <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">{branding?.address}</p>
                            </div>
                        </div>
                        <div className="text-left space-y-1">
                            <h2 className="text-3xl font-black text-primary tracking-tighter">جدول كميات</h2>
                            <p className="text-sm font-mono text-muted-foreground">{boq.boqNumber}</p>
                            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                                الحالة: {boq.status}
                            </Badge>
                        </div>
                    </div>

                    {/* Project Info Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10 bg-muted/30 p-6 rounded-2xl border border-muted-foreground/10">
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">اسم المشروع:</span>
                                <span className="text-lg font-extrabold">{boq.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">العميل:</span>
                                <span className="text-md font-semibold">{boq.clientName || '---'}</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-end justify-center">
                            <span className="text-[10px] font-black text-primary uppercase mb-1">إجمالي قيمة الجدول</span>
                            <span className="text-3xl font-black font-mono text-primary">{formatCurrency(boq.totalValue || 0)}</span>
                        </div>
                    </div>

                    {/* BOQ Items Table */}
                    <div className="border-2 rounded-2xl overflow-hidden border-muted-foreground/10">
                        <Table className="w-full border-collapse">
                            <TableHeader className="bg-muted/80">
                                <TableRow className="h-14 border-b-2">
                                    <TableHead className="w-12 text-center font-bold text-xs">م</TableHead>
                                    <TableHead className="text-right font-bold text-foreground">بيان الأعمال التفصيلي</TableHead>
                                    <TableHead className="w-24 text-center font-bold text-foreground">الوحدة</TableHead>
                                    <TableHead className="w-24 text-center font-bold text-foreground">الكمية</TableHead>
                                    <TableHead className="w-32 text-center font-bold text-foreground">سعر الوحدة</TableHead>
                                    <TableHead className="w-40 text-left font-bold text-foreground">الإجمالي</TableHead>
                                    <TableHead className="w-40 text-right font-bold text-foreground">ملاحظات</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((item) => (
                                    <TableRow 
                                        key={item.id} 
                                        className={cn(
                                            "transition-colors border-b hover:bg-transparent",
                                            item.isHeader ? "bg-muted/40 font-bold" : ""
                                        )}
                                    >
                                        <TableCell className="text-center font-mono text-xs font-bold text-muted-foreground bg-muted/10 border-l">
                                            {item.itemNumber}
                                        </TableCell>
                                        <TableCell 
                                            style={{ paddingRight: item.isHeader ? '0.75rem' : `${(item.level || 0) * 1.5 + 0.75}rem` }}
                                            className={cn(
                                                "py-4 leading-relaxed",
                                                item.isHeader ? "text-lg text-primary pr-3" : "text-sm pr-6"
                                            )}
                                        >
                                            {item.description}
                                        </TableCell>
                                        <TableCell className="text-center font-semibold text-muted-foreground">
                                            {item.isHeader ? '-' : item.unit || 'مقطوعية'}
                                        </TableCell>
                                        <TableCell className="text-center font-mono font-bold text-base">
                                            {item.isHeader ? '-' : item.quantity}
                                        </TableCell>
                                        <TableCell className="text-center font-mono font-bold text-primary">
                                            {item.isHeader ? '-' : formatCurrency(item.sellingUnitPrice || 0)}
                                        </TableCell>
                                        <TableCell className="text-left font-mono font-black bg-primary/[0.02] border-r">
                                            {item.isHeader ? '' : formatCurrency((item.quantity || 0) * (item.sellingUnitPrice || 0))}
                                        </TableCell>
                                        <TableCell className="text-right text-[10px] text-muted-foreground border-r italic min-w-[100px]">
                                            {item.notes || ''}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter className="bg-primary/5">
                                <TableRow className="h-20 border-t-4 border-primary/20">
                                    <TableCell colSpan={5} className="text-right px-8">
                                        <div className="text-xl font-black text-foreground">الإجمالي العام لجدول الكميات:</div>
                                        <div className="text-[10px] text-muted-foreground font-normal mt-1 italic">يشمل كافة البنود والخدمات المذكورة أعلاه</div>
                                    </TableCell>
                                    <TableCell className="text-left font-mono text-primary px-3 border-r bg-primary/5">
                                        <div className="text-2xl font-black">{formatCurrency(boq.totalValue || 0)}</div>
                                    </TableCell>
                                    <TableCell className="border-r" />
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>

                    {/* Footer Signature Section - Visible only in Print */}
                    <div className="hidden print:grid grid-cols-3 gap-12 mt-20 text-center text-sm border-t pt-10">
                        <div className="space-y-12">
                            <p className="font-black border-b pb-2 mb-4">إعداد المهندس</p>
                            <div className="pt-2 border-t border-dashed">التوقيع</div>
                        </div>
                        <div className="space-y-12">
                            <p className="font-black border-b pb-2 mb-4">اعتماد المكتب</p>
                            <div className="pt-2 border-t border-dashed">الختم والتاريخ</div>
                        </div>
                        <div className="space-y-12">
                            <p className="font-black border-b pb-2 mb-4">موافقة العميل (المالك)</p>
                            <div className="pt-2 border-t border-dashed">التوقيع</div>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
}
