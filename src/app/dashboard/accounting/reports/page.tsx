'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProjectsPnlReport } from '@/components/accounting/reports/projects-pnl';
import { ResourceAnalysisReport } from '@/components/accounting/reports/resource-analysis';
import { DepartmentPerformanceReport } from '@/components/accounting/reports/department-performance';
import { OverheadReport } from '@/components/accounting/reports/overhead-report';
import { PieChart, TrendingUp, Users, Building2, BarChart3 } from 'lucide-react';
import { useAppTheme } from '@/context/theme-context';
import { cn } from '@/lib/utils';

/**
 * لوحة التقارير التحليلية والربحية (مركز السيادة المالية):
 * تقوم بتجميع كافة أبعاد مراكز التكلفة والربحية الموزعة في القيود والسندات.
 */
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
                        <BarChart3 className="h-8 w-8" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-black">التقارير التحليلية والربحية (النتائج المثبتة)</CardTitle>
                        <CardDescription className="text-base font-medium">
                            تحليل أداء مراكز الربحية (المشاريع)، إنتاجية المهندسين، وكفاءة الأقسام التشغيلية.
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
                    <TabsTrigger value="projects" className={cn("py-3 rounded-xl font-black h-12 gap-2", isGlass && "tabs-trigger-card justify-center items-center")}>
                        <TrendingUp className="h-4 w-4"/> ربحية المشاريع
                    </TabsTrigger>
                    <TabsTrigger value="resources" className={cn("py-3 rounded-xl font-black h-12 gap-2", isGlass && "tabs-trigger-card justify-center items-center")}>
                        <Users className="h-4 w-4"/> إنتاجية المهندسين
                    </TabsTrigger>
                    <TabsTrigger value="departments" className={cn("py-3 rounded-xl font-black h-12 gap-2", isGlass && "tabs-trigger-card justify-center items-center")}>
                        <Building2 className="h-4 w-4"/> أداء الأقسام
                    </TabsTrigger>
                    <TabsTrigger value="overhead" className={cn("py-3 rounded-xl font-black h-12 gap-2", isGlass && "tabs-trigger-card justify-center items-center")}>
                        <PieChart className="h-4 w-4"/> المصاريف العامة
                    </TabsTrigger>
                </TabsList>
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <TabsContent value="projects" className="mt-0"><ProjectsPnlReport /></TabsContent>
                <TabsContent value="resources" className="mt-0"><ResourceAnalysisReport /></TabsContent>
                <TabsContent value="departments" className="mt-0"><DepartmentPerformanceReport /></TabsContent>
                <TabsContent value="overhead" className="mt-0"><OverheadReport /></TabsContent>
            </div>
        </Tabs>
    </div>
  );
}
