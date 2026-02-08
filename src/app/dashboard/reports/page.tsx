'use client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { WorkflowReportsDashboard } from '@/components/reports/workflow-reports-dashboard';


export default function ReportsPage() {
    return (
        <Card dir="rtl">
            <CardHeader>
                <CardTitle>تقارير سير العمل التحليلية</CardTitle>
                <CardDescription>
                لوحة معلومات ذكية تعرض لك أهم مؤشرات الأداء والمخاطر والفرص في سير عمل المشاريع.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <WorkflowReportsDashboard />
            </CardContent>
        </Card>
    )
}
