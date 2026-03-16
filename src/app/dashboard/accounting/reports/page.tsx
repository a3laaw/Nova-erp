'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProjectsPnlReport } from '@/components/accounting/reports/projects-pnl';
import { ResourceAnalysisReport } from '@/components/accounting/reports/resource-analysis';
import { DepartmentPerformanceReport } from '@/components/accounting/reports/department-performance';
import { OverheadReport } from '@/components/accounting/reports/overhead-report';
import { PieChart } from 'lucide-react';
import { useAppTheme } from '@/context/theme-context';
import { cn } from '@/lib/utils';

export default function AnalyticalReportsPage() {
  const { theme } = useAppTheme();
  const isGlass = theme === 'glass';

  return (
    <div className="space-y-6" dir="rtl">
        <Card className={cn(
            "rounded-[2.5rem] border-none shadow-sm overflow-hidden",
            isGlass ? "glass-effect" : "bg-gradient-to-l from-white to-indigo-50 shadow-sm"
        )}>
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

        <Tabs defaultValue="projects" dir="rtl">
            <div className={cn(isGlass ? "tabs-frame-secondary" : "mb-8 bg-white rounded-3xl shadow-sm p-4")}>
                <TabsList className={cn(
                    "grid w-full grid-cols-2 md:grid-cols-4 bg-transparent h-auto p-0 gap-4",
                    isGlass ? "" : ""
                )}>
                    <TabsTrigger value="projects" className={cn("py-3 rounded-xl font-bold h-12", isGlass && "tabs-trigger-card justify-center items-center")}>ربحية المشاريع</TabsTrigger>
                    <TabsTrigger value="resources" className={cn("py-3 rounded-xl font-bold h-12", isGlass && "tabs-trigger-card justify-center items-center")}>إنتاجية المهندسين</TabsTrigger>
                    <TabsTrigger value="departments" className={cn("py-3 rounded-xl font-bold h-12", isGlass && "tabs-trigger-card justify-center items-center")}>أداء الأقسام</TabsTrigger>
                    <TabsTrigger value="overhead" className={cn("py-3 rounded-xl font-bold h-12", isGlass && "tabs-trigger-card justify-center items-center")}>المصاريف العامة</TabsTrigger>
                </TabsList>
            </div>

            <Card className={cn(
                "border-none shadow-sm rounded-3xl overflow-hidden",
                isGlass ? "glass-effect" : "bg-white"
            )}>
                <CardContent className="pt-8">
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
                </CardContent>
            </Card>
        </Tabs>
    </div>
  );
}