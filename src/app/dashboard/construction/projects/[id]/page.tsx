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
import { ArrowRight, Building, Calendar, DollarSign, User, Percent } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BoqView } from '@/components/clients/boq/boq-view';
import Link from 'next/link';
import { Label } from '@/components/ui/label';

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
    const { data: project, loading: projectLoading } = useDocument<ConstructionProject>(firestore, projectRef?.path);
    
    const clientRef = useMemo(() => firestore && project?.clientId ? doc(firestore, 'clients', project.clientId) : null, [firestore, project?.clientId]);
    const { data: client, loading: clientLoading } = useDocument<Client>(firestore, clientRef?.path);

    const engineerRef = useMemo(() => firestore && project?.mainEngineerId ? doc(firestore, 'employees', project.mainEngineerId) : null, [firestore, project?.mainEngineerId]);
    const { data: engineer, loading: engineerLoading } = useDocument<Employee>(firestore, engineerRef?.path);

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
            <div className="space-y-4">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }
    
    if (!project) {
        return <p className="text-center">لم يتم العثور على المشروع.</p>;
    }
    
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-2xl font-bold flex items-center gap-3">
                                {project.projectName}
                                <Badge variant="outline" className={statusColors[project.status] || ''}>{project.status}</Badge>
                            </CardTitle>
                            <CardDescription>
                                مشروع {project.projectType} للعميل: <Link href={`/dashboard/clients/${project.clientId}`} className="text-primary hover:underline">{client?.nameAr || '...'}</Link>
                            </CardDescription>
                        </div>
                         <Button variant="outline" onClick={() => router.back()}><ArrowRight className="ml-2 h-4"/> العودة للقائمة</Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2"><User className="text-muted-foreground"/> <span>المهندس: {engineer?.fullName || '...'}</span></div>
                        <div className="flex items-center gap-2"><Calendar className="text-muted-foreground"/> <span>يبدأ: {formatDate(project.startDate)}</span></div>
                        <div className="flex items-center gap-2"><Calendar className="text-muted-foreground"/> <span>ينتهي: {formatDate(project.endDate)}</span></div>
                         {daysRemaining && <div className="flex items-center gap-2 text-primary font-semibold"><Calendar className="text-muted-foreground"/> <span>متبقٍ: {daysRemaining}</span></div>}
                    </div>
                    <div>
                        <Label>نسبة الإنجاز</Label>
                        <Progress value={project.progressPercentage} className="mt-2" />
                    </div>
                </CardContent>
            </Card>

            <Tabs defaultValue="overview">
                <TabsList>
                    <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
                    <TabsTrigger value="boq" disabled={!project.linkedTransactionId}>جدول الكميات (BOQ)</TabsTrigger>
                    <TabsTrigger value="subcontracts" disabled>المقاولون</TabsTrigger>
                    <TabsTrigger value="procurement" disabled>المشتريات</TabsTrigger>
                    <TabsTrigger value="financials" disabled>المالية</TabsTrigger>
                    <TabsTrigger value="files" disabled>الملفات</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="mt-4">
                     <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <StatCard title="قيمة العقد" value={formatCurrency(project.contractValue)} icon={<DollarSign/>}/>
                        <StatCard title="نسبة الإنجاز" value={`${project.progressPercentage}%`} icon={<Percent/>}/>
                     </div>
                </TabsContent>
                <TabsContent value="boq" className="mt-4">
                    {project.linkedTransactionId ? (
                        <BoqView transactionId={`${project.clientId}/${project.linkedTransactionId}`} />
                    ) : (
                        <Card>
                            <CardContent className="p-8 text-center text-muted-foreground">
                                <p>يجب ربط هذا المشروع بمعاملة استشارية أولاً لعرض جدول الكميات.</p>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}