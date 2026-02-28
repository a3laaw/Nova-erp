
'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { SubcontractorCertificate, Subcontractor } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Printer, ArrowRight, FileCheck, HardHat, Building2, Calendar, Coins } from 'lucide-react';
import { formatCurrency, numberToArabicWords } from '@/lib/utils';
import { useBranding } from '@/context/branding-context';
import { toFirestoreDate } from '@/services/date-converter';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Logo } from '@/components/layout/logo';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PrintableDocument } from '@/components/layout/printable-document';
import { Badge } from '@/components/ui/badge';

export default function SubcontractorCertificateDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { firestore } = useFirebase();
    const { branding, loading: brandingLoading } = useBranding();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const certRef = useMemo(() => (firestore && id ? doc(firestore, 'subcontractor_certificates', id) : null), [firestore, id]);
    const { data: cert, loading: certLoading } = useDocument<SubcontractorCertificate>(firestore, certRef?.path || null);

    const handlePrint = () => window.print();

    if (certLoading || brandingLoading) {
        return (
            <div className="p-8 max-w-4xl mx-auto space-y-8" dir="rtl">
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-96 w-full rounded-xl" />
            </div>
        );
    }

    if (!cert) return <div className="text-center p-20">لم يتم العثور على شهادة الإنجاز.</div>;

    const certDate = toFirestoreDate(cert.date);

    return (
        <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6" dir="rtl">
            <div className="flex justify-between items-center no-print bg-background/80 backdrop-blur-sm sticky top-0 z-10 py-4 border-b">
                <Button variant="ghost" onClick={() => router.back()} className="gap-2">
                    <ArrowRight className="h-4 w-4"/> عودة
                </Button>
                <Button onClick={handlePrint} className="gap-2 shadow-lg shadow-primary/20 rounded-xl font-bold">
                    <Printer className="h-4 w-4"/> طباعة شهادة الإنجاز
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
                            <h2 className="text-3xl font-black text-primary tracking-tighter">شهادة إنجاز أعمال</h2>
                            <p className="text-lg font-bold text-muted-foreground tracking-widest font-mono uppercase">Achievement Certificate</p>
                            <div className="pt-2">
                                <p className="font-mono text-xl font-black bg-muted px-3 py-1 rounded-lg inline-block border">
                                    {cert.certificateNumber}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Parties Info */}
                    <div className="grid grid-cols-2 gap-8 p-6 bg-muted/20 rounded-2xl border">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <HardHat className="h-4 w-4 text-primary" />
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">مقاول الباطن / Subcontractor:</p>
                                    <p className="font-bold text-lg">{cert.subcontractorName}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Building2 className="h-4 w-4 text-primary" />
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">المشروع / Project:</p>
                                    <p className="font-bold text-lg">{cert.projectName}</p>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4 text-left">
                            <div className="flex justify-between items-baseline border-b border-dashed pb-2">
                                <span className="text-xs font-bold text-muted-foreground">تاريخ الشهادة:</span>
                                <span className="font-bold">{certDate ? format(certDate, 'dd/MM/yyyy', { locale: ar }) : '-'}</span>
                            </div>
                            <div className="flex justify-between items-baseline">
                                <span className="text-xs font-bold text-muted-foreground">حالة القيد المالي:</span>
                                <Badge variant="outline" className="font-bold border-green-600 text-green-700 bg-green-50">مثبت في المديونية</Badge>
                            </div>
                        </div>
                    </div>

                    {/* Description of Work */}
                    <div className="space-y-4">
                        <h3 className="text-xl font-black flex items-center gap-2 border-r-4 border-primary pr-3">
                            بيان الأعمال المنجزة والمُعتمدة:
                        </h3>
                        <div className="p-8 border-2 rounded-[2rem] bg-muted/5 min-h-[150px] relative">
                            <div className="absolute top-4 left-4 opacity-5 italic text-primary font-black text-6xl font-mono">Work Done</div>
                            <p className="text-lg leading-relaxed whitespace-pre-wrap font-medium">
                                {cert.description || 'لم يتم إدخال وصف تفصيلي.'}
                            </p>
                        </div>
                    </div>

                    {/* Financial Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center mt-8">
                        <div className="p-6 bg-primary rounded-[2rem] text-primary-foreground shadow-xl shadow-primary/20">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold uppercase opacity-80">صافي المستحق للمقاول:</span>
                                <Coins className="h-6 w-6 opacity-50" />
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-black font-mono">{formatCurrency(cert.amount)}</span>
                            </div>
                            <Separator className="my-4 bg-primary-foreground/20" />
                            <p className="text-sm font-bold">{numberToArabicWords(cert.amount)}</p>
                        </div>

                        <div className="space-y-4 px-4">
                            <p className="text-sm text-muted-foreground leading-loose">
                                تشهد الشركة بأن مقاول الباطن المذكور قد أتم تنفيذ الأعمال الموضحة أعلاه بموقع المشروع، وبناءً عليه يستحق المبلغ المذكور بعد خصم أي استقطاعات سابقة أو سلف إن وجدت.
                            </p>
                        </div>
                    </div>

                    {/* Footer Signatures */}
                    <div className="grid grid-cols-3 gap-8 mt-32 text-center text-xs">
                        <div className="space-y-12">
                            <p className="font-black border-b-2 border-foreground pb-2">المهندس المشرف</p>
                            <div className="pt-2 text-muted-foreground italic">توقيع الاعتماد الفني</div>
                        </div>
                        <div className="space-y-12">
                            <p className="font-black border-b-2 border-foreground pb-2">الإدارة المالية</p>
                            <div className="pt-2 text-muted-foreground italic">التدقيق والترحيل المحاسبي</div>
                        </div>
                        <div className="space-y-12">
                            <p className="font-black border-b-2 border-foreground pb-2">استلام المقاول</p>
                            <div className="pt-2 text-muted-foreground italic">توقيع مقر بالإنجاز</div>
                        </div>
                    </div>
                </div>
            </PrintableDocument>
        </div>
    );
}
