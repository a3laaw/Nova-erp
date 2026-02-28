
'use client';

import { useState, useMemo } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import type { ConstructionProject } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ProjectScheduleTab } from '@/components/construction/project-schedule-tab';
import { Search, LayoutGrid, CalendarDays, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const statusColors: Record<string, string> = {
    'مخطط': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'قيد التنفيذ': 'bg-blue-100 text-blue-800 border-blue-200',
    'مكتمل': 'bg-green-100 text-green-800 border-green-200',
    'معلق': 'bg-gray-100 text-gray-800 border-gray-200',
    'ملغى': 'bg-red-100 text-red-800 border-red-200',
};

export default function AllProjectsSchedulesPage() {
    const { firestore } = useFirebase();
    const [searchQuery, setSearchQuery] = useState('');

    const projectsQuery = useMemo(() => [
        where('status', 'in', ['مخطط', 'قيد التنفيذ', 'معلق']),
        orderBy('createdAt', 'desc')
    ], []);

    const { data: projects, loading } = useSubscription<ConstructionProject>(firestore, 'projects', projectsQuery);

    const filteredProjects = useMemo(() => {
        if (!searchQuery) return projects;
        const lower = searchQuery.toLowerCase();
        return projects.filter(p => 
            p.projectName.toLowerCase().includes(lower) || 
            p.clientName?.toLowerCase().includes(lower)
        );
    }, [projects, searchQuery]);

    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-3xl border-none shadow-sm bg-gradient-to-l from-white to-blue-50 dark:from-card dark:to-card">
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="space-y-1">
                            <CardTitle className="text-2xl font-black flex items-center gap-3">
                                <LayoutGrid className="text-primary h-7 w-7" />
                                مراجعة الجداول الزمنية لكافة المشاريع
                            </CardTitle>
                            <CardDescription>عرض مخططات Gantt لجميع المشاريع النشطة لمتابعة تقدم سير العمل الإجمالي.</CardDescription>
                        </div>
                        <div className="w-full max-w-md relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="ابحث باسم المشروع أو العميل..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="h-11 rounded-xl border-2 pl-10"
                            />
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {loading ? (
                <div className="space-y-8">
                    <Skeleton className="h-[400px] w-full rounded-3xl" />
                    <Skeleton className="h-[400px] w-full rounded-3xl" />
                </div>
            ) : filteredProjects.length === 0 ? (
                <div className="h-96 flex flex-col items-center justify-center border-2 border-dashed rounded-[3rem] bg-muted/10">
                    <CalendarDays className="h-16 w-16 mb-4 text-muted-foreground opacity-20" />
                    <p className="text-xl font-bold text-muted-foreground">لا توجد مشاريع نشطة لعرض جداولها الزمنية.</p>
                </div>
            ) : (
                <div className="space-y-10 pb-20">
                    {filteredProjects.map((project) => (
                        <div key={project.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center justify-between mb-3 px-4">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-xl font-black text-foreground">{project.projectName}</h3>
                                    <Badge className={cn("text-[10px] font-bold px-2 py-0 h-5", statusColors[project.status])}>
                                        {project.status}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">العميل: {project.clientName}</span>
                                </div>
                                <Button asChild variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/5 gap-1 rounded-lg">
                                    <Link href={`/dashboard/construction/projects/${project.id}`}>
                                        فتح تفاصيل المشروع
                                        <ArrowUpRight className="h-3 w-3" />
                                    </Link>
                                </Button>
                            </div>
                            <ProjectScheduleTab project={project} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
