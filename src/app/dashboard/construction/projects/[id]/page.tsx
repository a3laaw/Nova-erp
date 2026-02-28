
'use client';
import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument } from '@/firebase';
import type { ConstructionProject, Client, Employee } from '@/lib/types';
import { doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowRight, Building, Calendar, DollarSign, User, Percent, ClipboardList, ShoppingCart, BarChart3 } from 'lucide-react';
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

const statusColors: Record<string, string> = {
    'مخطط': 'bg-yellow-100 text-yellow-800',
    'قيد التنفيذ': 'bg-blue-100 text-blue-800',
    'مكتمل': 'bg-green-100 text-green-800',
    'معلق': 'bg-gray-100 text-gray-800',
    'ملغى': 'bg-red-100 text-red-800',
};


const StatCard = ({ title, value, icon }: { title: string, value: string, icon: React.ReactNode }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <div className="text-muted-foreground">{icon}</div>
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
        </CardContent>
    </Card>
);


export default function ProjectDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { firestore } = useFirebase();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const projectRef = useMemo(() => firestore && id ? doc(firestore, 'projects', id) : null, [firestore, id]);
    const { data: project, loading: projectLoading } = useDocument<ConstructionProject>(firestore, projectRef?.path || null);
    
    const clientRef = useMemo(() => firestore && project?.clientId ? doc(firestore, 'clients', project.clientId) : null, [firestore, project?.clientId]);
    const { data: client, loading: clientLoading } = useDocument<Client>(firestore, clientRef?.path || null);

    const engineerRef = useMemo(() => firestore && project?.mainEngineerId ? doc(firestore, 'employees', project.mainEngineerId) : null, [firestore, project?.mainEngineerId]);
    const { data: engineer, loading: engineerLoading } = useDocument<Employee>(firestore, engineerRef?.path || null);

    const loading = projectLoading || clientLoading || engineerLoading;
    
    const formatDate = (date: any, includeTime = false) => {
        const d = toFirestoreDate(date);
        if (!d) return '-';
        return format(d, includeTime ? 'PPP p' : 'PPP', { locale: ar });
    };

    const daysRemaining = useMemo(() => {
        if (!project?.endDate) return null;
        const endDate = toFirestoreDate(project.endDate);
        if (!endDate || !project || project.status !== 'قيد التنفيذ') return null;
        return formatDistanceToNow(endDate, { addSuffix: true, locale: ar });
    }, [project]);

    if (loading) {
        return (
            <div className="space-y-4 max-w-6xl mx-auto p-6" dir="rtl">
                <Skeleton className="h-48 w-full rounded-xl" />
                <Skeleton className="h-64 w-full rounded-xl" />
            </div>
        );
    }
    
    if (!project) {
        return <div className="text-center p-20 text-muted-foreground">لم يتم العثور على المشروع.</div>;
    }
    
    return (
        <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6" dir="rtl">
            <Card className="rounded-2xl border-none shadow-sm bg-gradient-to-l from-white to-sky-50 dark:from-card dark:to-card">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <CardTitle className="text-3xl font-black text-foreground">
                                    {project.projectName}
                                </CardTitle>
                                <Badge className={cn("text-xs px-3", statusColors[project.status])}>{project.status}</Badge>
                            </div>
                            <CardDescription className="text-base font-medium flex items-center gap-2">
                                <Building className="h-4 w-4 text-muted-foreground"/>
                                مشروع {project.projectType} للعميل: 
                                <Link href={`/dashboard/clients/${project.clientId}`} className="text-primary hover:underline font-bold">
                                    {client?.nameAr || '...'}
                                </Link>
                            </CardDescription>
                        </div>
                         <Button variant="ghost" onClick={() => router.back()} className="gap-2 group">
                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1"/> 
                            العودة للمشاريع
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-4 bg-white/50 dark:bg-muted/20 rounded-xl border">
                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">المهندس المسؤول</Label>
                            <p className="font-bold flex items-center gap-2"><User className="h-4 w-4 text-primary"/> {engineer?.fullName || '...'}</p>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">تاريخ البدء</Label>
                            <p className="font-bold flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground"/> {formatDate(project.startDate)}</p>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">التسليم المتوقع</Label>
                            <p className="font-bold flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground"/> {formatDate(project.endDate)}</p>
                        </div>
                         <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">الوقت المتبقي</Label>
                            <p className="font-bold text-primary flex items-center gap-2">{daysRemaining || '---'}</p>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between items-end">
                            <Label className="font-bold">إجمالي نسبة الإنجاز</Label>
                            <span className="font-mono text-xl font-black text-primary">{project.progressPercentage}%</span>
                        </div>
                        <Progress value={project.progressPercentage} className="h-3" />
                    </div>
                </CardContent>
            </Card>

            <Tabs defaultValue="financials" className="w-full">
                <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full h-auto p-1 bg-muted/50 rounded-xl mb-6">
                    <TabsTrigger value="financials" className="gap-2 py-3 rounded-lg"><BarChart3 className="h-4 w-4"/> ملخص التكاليف</TabsTrigger>
                    <TabsTrigger value="boq" className="gap-2 py-3 rounded-lg"><ClipboardList className="h-4 w-4"/> جداول الكميات</TabsTrigger>
                    <TabsTrigger value="procurement" className="gap-2 py-3 rounded-lg"><ShoppingCart className="h-4 w-4"/> المشتريات</TabsTrigger>
                    <TabsTrigger value="subcontracts" className="gap-2 py-3 rounded-lg"><HardHat className="h-4 w-4"/> المقاولون</TabsTrigger>
                    <TabsTrigger value="overview" className="gap-2 py-3 rounded-lg">نظرة عامة</TabsTrigger>
                </TabsList>
                
                <TabsContent value="financials">
                    <ProjectFinancialsTab project={project} />
                </TabsContent>

                <TabsContent value="boq">
                    <ProjectBoqTab project={project} client={client} />
                </TabsContent>

                <TabsContent value="procurement">
                    <ProjectProcurementTab project={project} />
                </TabsContent>

                <TabsContent value="subcontracts">
                    <div className="text-center p-12 border-2 border-dashed rounded-3xl bg-muted/10">
                        <HardHat className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <h3 className="text-xl font-bold">إدارة مقاولي الباطن للموقع</h3>
                        <p className="text-muted-foreground mt-2 mb-6">يمكنك إصدار شهادات إنجاز أعمال للمقاولين وتحميل تكلفتها على المشروع.</p>
                        <Button asChild>
                            <Link href={`/dashboard/construction/subcontractors/certificates/new?projectId=${project.id}`}>
                                <PlusCircle className="ml-2 h-4 w-4"/> إصدار شهادة إنجاز جديدة
                            </Link>
                        </Button>
                    </div>
                </TabsContent>

                <TabsContent value="overview">
                     <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                        <StatCard title="قيمة العقد" value={formatCurrency(project.contractValue)} icon={<DollarSign className="text-green-600"/>}/>
                        <StatCard title="نسبة الإنجاز" value={`${project.progressPercentage}%`} icon={<Percent className="text-blue-600"/>}/>
                     </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
