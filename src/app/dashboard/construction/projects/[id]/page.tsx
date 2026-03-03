
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
import { 
    ArrowRight, 
    Calendar, 
    User, 
    ClipboardList, 
    ShoppingCart, 
    BarChart3, 
    Camera, 
    PlusCircle, 
    Coins, 
    Clock3, 
    ShieldCheck, 
    Package,
    Droplets,
    Zap,
    Home,
    Layers,
    FileSignature,
    Ruler
} from 'lucide-react';
import { format } from 'date-fns';
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

const basementLabels: Record<string, string> = {
    none: 'بدون سرداب',
    full: 'سرداب كامل',
    half: 'سرداب نص',
    vault: 'قبو'
};

const workNatureLabels: Record<string, string> = {
    labor_only: 'مصنعية فقط',
    with_materials: 'توريد وتنفيذ'
};

const extensionTypeLabels: Record<string, string> = {
    ordinary: 'تمديد عادي',
    suspended: 'تمديد معلق'
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

    if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-48 w-full rounded-[2.5rem]" /><Skeleton className="h-64 w-full rounded-[2rem]" /></div>;
    if (!project) return <div className="text-center p-20 font-bold">لم يتم العثور على المشروع.</div>;

    return (
        <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-card">
                <CardHeader className="bg-muted/10 pb-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <CardTitle className="text-3xl font-black">{project.projectName}</CardTitle>
                                <Badge className={cn("text-xs px-3", statusColors[project.status])}>{project.status}</Badge>
                                <Badge variant="outline" className="border-primary text-primary font-bold">{categoryLabels[project.projectCategory]}</Badge>
                            </div>
                            <CardDescription className="text-base font-medium">للعميل: <Link href={`/dashboard/clients/${project.clientId}`} className="text-primary hover:underline font-bold">{client?.nameAr || '...'}</Link></CardDescription>
                        </div>
                         <Button variant="ghost" onClick={() => router.back()} className="gap-2 group"><ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1"/> العودة للمشاريع</Button>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <div className="flex justify-between items-end"><Label className="font-black text-xs text-muted-foreground uppercase tracking-widest">نسبة الإنجاز</Label><span className="font-mono text-xl font-black text-primary">{project.progressPercentage}%</span></div>
                                <Progress value={project.progressPercentage} className="h-3" />
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm font-medium pt-2">
                                <div className="space-y-1"><p className="text-[10px] text-muted-foreground uppercase font-bold">المشرف</p><p className="font-bold flex items-center gap-2"><User className="h-3 w-3 text-primary"/> {engineer?.fullName || '...'}</p></div>
                                <div className="space-y-1"><p className="text-[10px] text-muted-foreground uppercase font-bold">البدء</p><p className="font-bold flex items-center gap-2"><Calendar className="h-3 w-3"/> {formatDate(project.startDate)}</p></div>
                            </div>
                            <Separator />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-3">
                                    <div className="flex justify-between items-start">
                                        <p className="text-[10px] font-black text-blue-700 uppercase flex items-center gap-1"><Droplets className="h-3 w-3"/> الصحي والبناء</p>
                                        <Badge variant="outline" className="text-[8px] h-4 py-0 bg-white">{extensionTypeLabels[project.sanitaryExtensionType || 'ordinary']}</Badge>
                                    </div>
                                    <div className="flex flex-col gap-1.5 text-[11px] font-bold">
                                        <div className="flex justify-between items-center bg-white/50 p-1.5 rounded-lg border border-blue-100/50">
                                            <span>حمامات: {project.bathroomsCount || 0}</span>
                                            <span>مطابخ: {project.kitchensCount || 0}</span>
                                        </div>
                                        <div className="flex justify-between px-1"><span>تمديد معلق / عادي:</span><span className="text-blue-800">{project.suspendedExtensionCount} / {project.ordinaryExtensionCount}</span></div>
                                        <div className="flex justify-between px-1"><span>مراحيض معلق / عادي:</span><span className="text-blue-800">{project.suspendedToiletCount} / {project.ordinaryToiletCount}</span></div>
                                        <Separator className="bg-blue-200/30 my-1" />
                                        <div className="flex justify-between items-center">
                                            <Badge variant="outline" className="bg-blue-600 text-white border-none h-4 px-2">{basementLabels[project.basementType]}</Badge>
                                            <span className="font-black text-blue-700">{project.totalArea} م²</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 bg-yellow-50/50 rounded-2xl border border-yellow-100 space-y-3">
                                    <p className="text-[10px] font-black text-yellow-700 uppercase flex items-center gap-1"><Zap className="h-3 w-3"/> الكهرباء</p>
                                    <div className="flex flex-col gap-1.5 text-[11px] font-bold">
                                        <div className="flex justify-between px-1"><span>النقاط المخططة:</span><span className="font-black text-lg text-yellow-800">{project.electricalPointsCount || 0}</span></div>
                                        <div className="p-2 bg-yellow-100/50 rounded-lg text-[9px] font-bold border border-yellow-200">مرجع المخطط: {project.planReferenceNumber || '-'}</div>
                                        <div className="flex justify-between px-1 pt-2 opacity-70"><span>طبيعة التعاقد:</span><span>{workNatureLabels[project.workNature || 'labor_only']}</span></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {project.projectCategory === 'Private (Subsidized)' && (
                            <div className="p-6 bg-primary/5 rounded-[2rem] border-2 border-dashed border-primary/20 space-y-4 shadow-inner">
                                <div className="flex justify-between items-center"><h3 className="font-black text-primary flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> رصيد التموين الإنشائي</h3><Badge variant="secondary" className="text-[10px] font-black uppercase">Quota</Badge></div>
                                <div className="space-y-4">
                                    {project.subsidyQuotas?.map(q => {
                                        const progress = q.allocatedQuantity > 0 ? (q.receivedQuantity / q.allocatedQuantity) * 100 : 0;
                                        return (
                                            <div key={q.itemId} className="space-y-1.5">
                                                <div className="flex justify-between text-[10px] font-black uppercase"><span className="text-foreground/80">{q.itemName}</span><span className="text-primary font-mono">{q.receivedQuantity} / {q.allocatedQuantity}</span></div>
                                                <div className="relative h-2 w-full bg-primary/10 rounded-full overflow-hidden"><div className="absolute top-0 bottom-0 right-0 bg-primary transition-all duration-1000" style={{ width: `${Math.min(100, progress)}%` }} /></div>
                                            </div>
                                        );
                                    })}
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
                    <div className="flex justify-between items-center bg-muted/30 p-6 rounded-2xl border"><div><CardTitle className="text-xl font-black">تقارير الموقع</CardTitle></div><Button onClick={() => setIsReporting(true)} disabled={isReporting} className="h-11 rounded-xl font-bold gap-2"><PlusCircle className="h-5 w-5" /> إرسال تقرير</Button></div>
                    {isReporting && <DailyReportForm projectId={project.id!} onSuccess={() => setIsReporting(false)} onCancel={() => setIsReporting(false)} />}
                    <DailyReportsList projectId={project.id!} />
                </TabsContent>
                <TabsContent value="boq"><ProjectBoqTab project={project} client={client} /></TabsContent>
                <TabsContent value="procurement"><ProjectProcurementTab project={project} /></TabsContent>
                <TabsContent value="subcontracts"><div className="p-12 text-center border-2 border-dashed rounded-3xl bg-muted/10"><Home className="h-12 w-12 mx-auto mb-4 opacity-20" /><p className="font-bold text-muted-foreground italic">إدارة مقاولي الباطن للمشروع.</p></div></TabsContent>
            </Tabs>
        </div>
    );
}
