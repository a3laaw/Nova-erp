
'use client';
import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument } from '@/firebase';
import type { ConstructionProject, Client, Employee } from '@/lib/types';
import { doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowRight, Building, Calendar, User, ClipboardList, ShoppingCart, BarChart3, Camera, PlusCircle, Coins, Clock3, ShieldCheck, Package } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { formatCurrency, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';
import { Label } from '@/components/ui/label';
import { ProjectBoqTab } from '@/components/construction/project-boq-tab';
import { ProjectProcurementTab } from '@/components/construction/project-procurement-tab';
import { ProjectFinancialsTab } from '@/components/construction/project-financials-tab';
import { DailyReportsList } from '@/components/construction/daily-reports-list';
import { DailyReportForm } from '@/components/construction/daily-report-form';
import { ProjectApplicationsTab } from '@/components/construction/project-applications-tab';
import { ProjectScheduleTab } from '@/components/construction/project-schedule-tab';
import { Separator } from '@/components/ui/separator';

const statusColors: Record<string, string> = {
    'مخطط': 'bg-yellow-100 text-yellow-800',
    'قيد التنفيذ': 'bg-blue-100 text-blue-800',
    'مكتمل': 'bg-green-100 text-green-800',
    'معلق': 'bg-gray-100 text-gray-800',
    'ملغى': 'bg-red-100 text-red-800',
};

const categoryLabels: Record<string, string> = {
    'Private (Subsidized)': 'سكن خاص (مدعوم)',
    'Private (Non-Subsidized)': 'سكن خاص (تجاري)',
    'Commercial': 'تجاري / استثماري',
    'Government': 'مشروع حكومي',
};

export default function ProjectDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { firestore } = useFirebase();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const [isReporting, setIsReporting] = useState(false);

    const projectRef = useMemo(() => firestore && id ? doc(firestore, 'projects', id) : null, [firestore, id]);
    const { data: project, loading: projectLoading } = useDocument<ConstructionProject>(firestore, projectRef?.path || null);
    
    const clientRef = useMemo(() => firestore && project?.clientId ? doc(firestore, 'clients', project.clientId) : null, [firestore, project?.clientId]);
    const { data: client, loading: clientLoading } = useDocument<Client>(firestore, clientRef?.path || null);

    const engineerRef = useMemo(() => firestore && project?.mainEngineerId ? doc(firestore, 'employees', project.mainEngineerId) : null, [firestore, project?.mainEngineerId]);
    const { data: engineer, loading: engineerLoading } = useDocument<Employee>(firestore, engineerRef?.path || null);

    const loading = projectLoading || clientLoading || engineerLoading;
    
    const formatDate = (date: any) => {
        const d = toFirestoreDate(date);
        return d ? format(d, 'PPP', { locale: ar }) : '-';
    };

    if (loading) return <div className="space-y-4 p-6"><Skeleton className="h-48 w-full" /><Skeleton className="h-64 w-full" /></div>;
    if (!project) return <div className="text-center p-20 text-muted-foreground">لم يتم العثور على المشروع.</div>;

    return (
        <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-card">
                <CardHeader className="bg-muted/10 pb-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <CardTitle className="text-3xl font-black">{project.projectName}</CardTitle>
                                <Badge className={cn("text-xs px-3", statusColors[project.status])}>{project.status}</Badge>
                                <Badge variant="outline" className="border-primary text-primary font-bold">{categoryLabels[project.projectCategory] || project.projectCategory}</Badge>
                            </div>
                            <CardDescription className="text-base font-medium flex items-center gap-2">
                                للعميل: <Link href={`/dashboard/clients/${project.clientId}`} className="text-primary hover:underline font-bold">{client?.nameAr || '...'}</Link>
                            </CardDescription>
                        </div>
                         <Button variant="ghost" onClick={() => router.back()} className="gap-2 group">
                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1"/> العودة للمشاريع
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <div className="flex justify-between items-end">
                                <Label className="font-black text-xs text-muted-foreground uppercase tracking-widest">نسبة الإنجاز الإجمالية</Label>
                                <span className="font-mono text-xl font-black text-primary">{project.progressPercentage}%</span>
                            </div>
                            <Progress value={project.progressPercentage} className="h-3" />
                            <div className="grid grid-cols-2 gap-4 text-sm font-medium pt-4">
                                <div className="space-y-1"><p className="text-[10px] text-muted-foreground uppercase">المهندس المسؤول</p><p className="font-bold flex items-center gap-2"><User className="h-3 w-3 text-primary"/> {engineer?.fullName || '...'}</p></div>
                                <div className="space-y-1"><p className="text-[10px] text-muted-foreground uppercase">تاريخ البدء</p><p className="font-bold flex items-center gap-2"><Calendar className="h-3 w-3"/> {formatDate(project.startDate)}</p></div>
                            </div>
                        </div>

                        {/* --- محرك تتبع حصص المدعوم (Quota Tracker) --- */}
                        {project.projectCategory === 'Private (Subsidized)' && (
                            <div className="p-6 bg-primary/5 rounded-3xl border-2 border-dashed border-primary/20 space-y-4 shadow-inner">
                                <h3 className="font-black text-primary flex items-center gap-2">
                                    <ShieldCheck className="h-5 w-5" /> رصيد التموين الإنشائي
                                </h3>
                                <div className="space-y-3">
                                    {project.subsidyQuotas?.map(q => {
                                        const progress = (q.receivedQuantity / q.allocatedQuantity) * 100;
                                        return (
                                            <div key={q.itemId} className="space-y-1">
                                                <div className="flex justify-between text-[10px] font-bold">
                                                    <span className="flex items-center gap-1"><Package className="h-3 w-3"/> {q.itemName}</span>
                                                    <span>{q.receivedQuantity} / {q.allocatedQuantity}</span>
                                                </div>
                                                <Progress value={progress} className="h-1.5" />
                                            </div>
                                        );
                                    })}
                                    {(!project.subsidyQuotas || project.subsidyQuotas.length === 0) && <p className="text-xs text-muted-foreground italic">لم يتم إدخال أرصدة المدعوم بعد.</p>}
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Tabs defaultValue="financials" className="w-full">
                <TabsList className="grid grid-cols-2 md:grid-cols-7 w-full h-auto p-1 bg-muted/50 rounded-xl mb-6">
                    <TabsTrigger value="financials" className="gap-2 py-3 rounded-lg"><BarChart3 className="h-4 w-4"/> التكاليف</TabsTrigger>
                    <TabsTrigger value="schedule" className="gap-2 py-3 rounded-lg"><Clock3 className="h-4 w-4"/> الجدولة</TabsTrigger>
                    <TabsTrigger value="applications" className="gap-2 py-3 rounded-lg"><Coins className="h-4 w-4"/> المستخلصات</TabsTrigger>
                    <TabsTrigger value="reports" className="gap-2 py-3 rounded-lg"><Camera className="h-4 w-4"/> التنفيذ</TabsTrigger>
                    <TabsTrigger value="boq" className="gap-2 py-3 rounded-lg"><ClipboardList className="h-4 w-4"/> المقايسة</TabsTrigger>
                    <TabsTrigger value="procurement" className="gap-2 py-3 rounded-lg"><ShoppingCart className="h-4 w-4"/> المشتريات</TabsTrigger>
                    <TabsTrigger value="subcontracts" className="gap-2 py-3 rounded-lg">المقاولون</TabsTrigger>
                </TabsList>
                <TabsContent value="financials"><ProjectFinancialsTab project={project} /></TabsContent>
                <TabsContent value="schedule"><ProjectScheduleTab project={project} /></TabsContent>
                <TabsContent value="applications"><ProjectApplicationsTab project={project} /></TabsContent>
                <TabsContent value="reports" className="space-y-6">
                    <div className="flex justify-between items-center bg-muted/30 p-6 rounded-2xl border">
                        <div><CardTitle className="text-xl font-black">سجل تقارير الموقع اليومية</CardTitle><CardDescription>التوثيق الفني والصوري الميداني.</CardDescription></div>
                        <Button onClick={() => setIsReporting(true)} disabled={isReporting} className="h-11 px-6 rounded-xl font-bold gap-2"><PlusCircle className="h-5 w-5" /> إرسال تقرير يومي</Button>
                    </div>
                    {isReporting && <DailyReportForm projectId={project.id!} onSuccess={() => setIsReporting(false)} onCancel={() => setIsReporting(false)} />}
                    <DailyReportsList projectId={project.id!} />
                </TabsContent>
                <TabsContent value="boq"><ProjectBoqTab project={project} client={client} /></TabsContent>
                <TabsContent value="procurement"><ProjectProcurementTab project={project} /></TabsContent>
                <TabsContent value="subcontracts"><div className="p-12 text-center border-2 border-dashed rounded-3xl bg-muted/10">إدارة مقاولي الباطن وشهادات الإنجاز.</div></TabsContent>
            </Tabs>
        </div>
    );
}
