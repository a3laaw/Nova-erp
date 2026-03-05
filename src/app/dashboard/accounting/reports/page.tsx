
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProjectsPnlReport } from '@/components/accounting/reports/projects-pnl';
import { ResourceAnalysisReport } from '@/components/accounting/reports/resource-analysis';
import { DepartmentPerformanceReport } from '@/components/accounting/reports/department-performance';
import { OverheadReport } from '@/components/accounting/reports/overhead-report';
import { PieChart } from 'lucide-react';

export default function AnalyticalReportsPage() {
  return (
    <div className="space-y-6" dir="rtl">
        <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-gradient-to-l from-white to-indigo-50 dark:from-card dark:to-card">
            <CardHeader className="pb-8 px-8 border-b">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600/10 rounded-2xl text-indigo-600 shadow-inner">
                        <PieChart className="h-8 w-8" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-black">التقارير التحليلية والربحية</CardTitle>
                        <CardDescription className="text-base font-medium">
                            تحليل ربحية المشاريع، إنتاجية المهندسين، وأداء الأقسام بناءً على مراكز التكلفة.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
        </Card>

        <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
            <CardContent className="pt-8">
                <Tabs defaultValue="projects" dir="rtl">
                    <TabsList className="grid w-full grid-cols-4 bg-muted/50 rounded-xl h-auto p-1 mb-8">
                        <TabsTrigger value="projects" className="py-3 rounded-lg font-bold">ربحية المشاريع</TabsTrigger>
                        <TabsTrigger value="resources" className="py-3 rounded-lg font-bold">إنتاجية المهندسين</TabsTrigger>
                        <TabsTrigger value="departments" className="py-3 rounded-lg font-bold">أداء الأقسام</TabsTrigger>
                        <TabsTrigger value="overhead" className="py-3 rounded-lg font-bold">المصاريف العامة</TabsTrigger>
                    </TabsList>
                    <TabsContent value="projects" className="mt-0 animate-in fade-in">
                        <ProjectsPnlReport />
                    </TabsContent>
                    <TabsContent value="resources" className="mt-0 animate-in fade-in">
                        <ResourceAnalysisReport />
                    </TabsContent>
                    <TabsContent value="departments" className="mt-0 animate-in fade-in">
                        <DepartmentPerformanceReport />
                    </TabsContent>
                    <TabsContent value="overhead" className="mt-0 animate-in fade-in">
                        <OverheadReport />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    </div>
  );
}
