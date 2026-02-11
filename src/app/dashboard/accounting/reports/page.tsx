'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProjectsPnlReport } from '@/components/accounting/reports/projects-pnl';
import { ResourceAnalysisReport } from '@/components/accounting/reports/resource-analysis';
import { DepartmentPerformanceReport } from '@/components/accounting/reports/department-performance';
import { OverheadReport } from '@/components/accounting/reports/overhead-report';

export default function AnalyticalReportsPage() {
  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle>التقارير التحليلية</CardTitle>
        <CardDescription>
          تحليل ربحية المشاريع، إنتاجية المهندسين، وأداء الأقسام بناءً على مراكز التكلفة والربحية التلقائية.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="projects" dir="rtl">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="projects">ربحية المشاريع</TabsTrigger>
            <TabsTrigger value="resources">إنتاجية المهندسين</TabsTrigger>
            <TabsTrigger value="departments">أداء الأقسام</TabsTrigger>
            <TabsTrigger value="overhead">المصاريف العامة</TabsTrigger>
          </TabsList>
          <TabsContent value="projects" className="mt-4">
            <ProjectsPnlReport />
          </TabsContent>
          <TabsContent value="resources" className="mt-4">
            <ResourceAnalysisReport />
          </TabsContent>
          <TabsContent value="departments" className="mt-4">
            <DepartmentPerformanceReport />
          </TabsContent>
          <TabsContent value="overhead" className="mt-4">
            <OverheadReport />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
