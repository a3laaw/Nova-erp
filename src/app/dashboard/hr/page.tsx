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
import Link from 'next/link';
import { GratuityCalculator } from '@/components/hr/gratuity-calculator';

export default function HRPage() {
  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle>إدارة الموارد البشرية</CardTitle>
        <CardDescription>
          إدارة شؤون الموظفين، الإجازات، ومستحقات نهاية الخدمة.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="employees" dir="rtl">
          <TabsList>
            <TabsTrigger value="employees" asChild>
                <Link href="/dashboard/hr/employees">الموظفين</Link>
            </TabsTrigger>
            <TabsTrigger value="leave-requests" asChild>
                <Link href="/dashboard/hr/leave-requests">طلبات الإجازة</Link>
            </TabsTrigger>
            <TabsTrigger value="attendance" asChild>
                <Link href="/dashboard/hr/attendance">الحضور والرواتب</Link>
            </TabsTrigger>
            <TabsTrigger value="leave-reports" asChild>
                <Link href="/dashboard/hr/leave-reports">تقارير الإجازات</Link>
            </TabsTrigger>
             <TabsTrigger value="reports" asChild>
                <Link href="/dashboard/hr/reports">التقارير الشاملة</Link>
            </TabsTrigger>
            <TabsTrigger value="gratuity">مكافآت نهاية الخدمة</TabsTrigger>
          </TabsList>
          <TabsContent value="employees" className="mt-4">
            {/* This content is now handled by its own page */}
          </TabsContent>
           <TabsContent value="reports" className="mt-4">
             {/* This content will be rendered on its own page now */}
          </TabsContent>
          <TabsContent value="leave-requests" className="mt-4">
             {/* This content will be rendered on its own page now */}
          </TabsContent>
           <TabsContent value="leave-reports" className="mt-4">
             {/* This content will be rendered on its own page now */}
          </TabsContent>
           <TabsContent value="attendance" className="mt-4">
             {/* This content will be rendered on its own page now */}
          </TabsContent>
          <TabsContent value="gratuity" className="mt-4">
            <GratuityCalculator />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
