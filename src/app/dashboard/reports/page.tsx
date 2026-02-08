'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { WorkflowReportsDashboard } from '@/components/reports/workflow-reports-dashboard';


export default function ReportsPage() {
    return (
        <Card dir="rtl">
            <CardHeader>
                <CardTitle>التقارير التحليلية</CardTitle>
                <CardDescription>
                عرض تحليلي لبيانات النظام لمساعدتك على اتخاذ قرارات أفضل.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="workflow" dir="rtl">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="workflow">تقارير سير العمل</TabsTrigger>
                        <TabsTrigger value="financial" disabled>التقارير المالية</TabsTrigger>
                    </TabsList>
                    <TabsContent value="workflow" className="mt-4">
                        <WorkflowReportsDashboard />
                    </TabsContent>
                    <TabsContent value="financial" className="mt-4">
                        {/* Financial reports components will go here */}
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    )
}
