
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
import { AttendanceUploader } from '@/components/hr/attendance-uploader';
import { PayrollGenerator } from '@/components/hr/payroll-generator';

export default function AttendancePage() {
  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle>الحضور والرواتب</CardTitle>
        <CardDescription>
          إدارة سجلات الحضور الشهرية للموظفين وإنشاء كشوف الرواتب.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="attendance" dir="rtl">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="attendance">إدارة الحضور</TabsTrigger>
            <TabsTrigger value="payroll">كشوف الرواتب</TabsTrigger>
          </TabsList>
          <TabsContent value="attendance" className="mt-4">
            <AttendanceUploader />
          </TabsContent>
          <TabsContent value="payroll" className="mt-4">
            <PayrollGenerator />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
