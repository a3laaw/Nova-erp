
'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { PaymentApplication } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Printer, ArrowRight, Coins, Building2, User, Calendar, FileText } from 'lucide-react';
import { formatCurrency, cn, numberToArabicWords } from '@/lib/utils';
import { useBranding } from '@/context/branding-context';
import { toFirestoreDate } from '@/services/date-converter';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Logo } from '@/components/layout/logo';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PrintableDocument } from '@/components/layout/printable-document';
import { Badge } from '@/components/ui/badge';

export default function PaymentApplicationDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { firestore } = useFirebase();
    const { branding, loading: brandingLoading } = useBranding();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const appRef = useMemo(() => (firestore && id ? doc(firestore, 'payment_applications', id) : null), [firestore, id]);
    const { data: app, loading: appLoading } = useDocument<PaymentApplication>(firestore, appRef?.path || null);

    const handlePrint = () => window.print();

    if (appLoading || brandingLoading) {
        return (
            <div className="p-8 max-w-4xl mx-auto space-y-8" dir="rtl">
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-96 w-full rounded-xl" />
            </div>
        );
    }

    if (!app) return <div className="text-center p-20">لم يتم العثور على بيانات المستخلص.</div>;

    const appDate = toFirestoreDate(app.date);

    return (
        <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6" dir="rtl">
            <div className="flex justify-between items-center no-print bg-background/80 backdrop-blur-sm sticky top-0 z-10 py-4 border-b">
                <Button variant="ghost" onClick={() => router.back()} className="gap-2">
                    <ArrowRight className="h-4 w-4"/> عودة
                </Button>
                <Button onClick={handlePrint} className="gap-2 shadow-lg shadow-primary/20 rounded-xl font-bold">
                    <Printer className="h-4 w-4"/> طباعة المستخلص
                </Button>
            </div>

            <PrintableDocument>
                <div className="space-y-8">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-10 border-b-4 border-primary pb-6">
                        <div className="flex items-center gap-4">
                            <Logo className="h-20 w-20 !p-2 border" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                            <div>
                                <h1 className="text-2xl font-black">{branding?.company_name || 'Nova ERP'}</h1>
                                <p className="text-xs text-muted-foreground mt-1 max-w-xs">{branding?.address}</p>
                            </div>
                        </div>
                        <div className="text-left space-y-1">
                            <h2 className="text-3xl font-black text-primary tracking-tighter">مستخلص أعمال</h2>
                            <p className="text-lg font-bold text-muted-foreground tracking-widest font-mono uppercase">Payment Application</p>
                            <div className="pt-2">
                                <p className="font-mono text-xl font-black bg-muted px-3 py-1 rounded-lg inline-block border">
                                    {app.applicationNumber}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Project/Client Info */}
                    <div className="grid grid-cols-2 gap-8 p-6 bg-muted/20 rounded-2xl border">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <User className="h-4 w-4 text-primary" />
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">السيد المالك / Client:</p>
                                    <p className="font-bold text-lg">{app.clientName}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Building2 className="h-4 w-4 text-primary" />
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">المشروع / Project:</p>
                                    <p className="font-bold text-lg">{app.projectName}</p>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4 text-left">
                            <div className="flex justify-between items-baseline border-b border-dashed pb-2">
                                <span className="text-xs font-bold text-muted-foreground">تاريخ المطالبة:</span>
                                <span className="font-bold">{appDate ? format(appDate, 'dd/MM/yyyy', { locale: ar }) : '-'}</span>
                            </div>
                            <div className="flex justify-between items-baseline border-b border-dashed pb-2">
                                <span className="text-xs font-bold text-muted-foreground">حالة المستخلص:</span>
                                <Badge variant="outline" className="font-bold">{app.status === 'draft' ? 'مسودة مراجعة' : 'معتمد'}</Badge>
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="border-2 rounded-[2rem] overflow-hidden shadow-sm">
                        <Table>
                            <TableHeader className="bg-muted/80">
                                <TableRow className="h-12 border-b-2">
                                    <TableHead className="w-12 text-center font-bold">#</TableHead>
                                    <TableHead className="font-bold text-foreground text-right px-4">بيان الأعمال المنفذة</TableHead>
                                    <TableHead className="w-24 text-center font-bold text-foreground">الوحدة</TableHead>
                                    <TableHead className="w-24 text-center font-bold text-foreground">الكمية</TableHead>
                                    <TableHead className="w-32 text-center font-bold text-foreground">سعر الوحدة</TableHead>
                                    <TableHead className="w-40 text-left font-bold text-foreground px-8">الإجمالي</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {app.items?.map((item: any, idx: number) => (
                                    <TableRow key={idx} className="h-14 border-b last:border-0 hover:bg-transparent">
                                        <TableCell className="text-center font-mono text-xs font-bold text-muted-foreground bg-muted/5 border-l">{idx + 1}</TableCell>
                                        <TableCell className="px-4 font-bold">{item.description}</TableCell>
                                        <TableCell className="text-center">{item.unit}</TableCell>
                                        <TableCell className="text-center font-mono font-black text-lg">{item.currentQuantity}</TableCell>
                                        <TableCell className="text-center font-mono font-bold text-primary">{formatCurrency(item.unitPrice)}</TableCell>
                                        <TableCell className="text-left font-mono font-black text-lg px-8 bg-primary/[0.02] border-r">
                                            {formatCurrency(item.totalAmount)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter className="bg-primary/5">
                                <TableRow className="h-20 border-t-4 border-primary/20">
                                    <TableCell colSpan={5} className="text-right px-12 font-black text-xl">صافي المطالبة المالية الحالية:</TableCell>
                                    <TableCell className="text-left font-mono text-3xl font-black text-primary px-8 border-r bg-primary/5">
                                        {formatCurrency(app.totalAmount)}
                                    </TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>

                    <div className="p-4 bg-muted/10 rounded-xl border border-dashed text-center">
                        <p className="text-sm font-bold text-primary">{numberToArabicWords(app.totalAmount)}</p>
                    </div>

                    {/* Footer Signatures */}
                    <div className="grid grid-cols-3 gap-8 mt-32 text-center text-xs">
                        <div className="space-y-12">
                            <p className="font-black border-b-2 border-foreground pb-2">المهندس المسؤول</p>
                            <div className="pt-2 text-muted-foreground">إعداد ومراجعة</div>
                        </div>
                        <div className="space-y-12">
                            <p className="font-black border-b-2 border-foreground pb-2">الإدارة المالية</p>
                            <div className="pt-2 text-muted-foreground">التدقيق والترحيل</div>
                        </div>
                        <div className="space-y-12">
                            <p className="font-black border-b-2 border-foreground pb-2">المالك / الموكل</p>
                            <div className="pt-2 text-muted-foreground">الاعتماد للصرف</div>
                        </div>
                    </div>
                </div>
            </PrintableDocument>
        </div>
    );
}
