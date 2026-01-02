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
import { EmployeesTable } from '@/components/hr/employees-table';
import Link from 'next/link';

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
            <TabsTrigger value="employees">الموظفين</TabsTrigger>
            <TabsTrigger value="leave-requests" asChild>
                <Link href="/dashboard/hr/leave-requests">طلبات الإجازة</Link>
            </TabsTrigger>
            <TabsTrigger value="gratuity">مكافآت نهاية الخدمة</TabsTrigger>
          </TabsList>
          <TabsContent value="employees" className="mt-4">
            <EmployeesTable />
          </TabsContent>
          <TabsContent value="leave-requests" className="mt-4">
             {/* This content will be rendered on its own page now */}
          </TabsContent>
          <TabsContent value="gratuity" className="mt-4">
             <div className="p-8 text-center border-2 border-dashed rounded-lg">
                <h3 className="mt-4 text-lg font-medium">تقارير نهاية الخدمة قريباً</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                    سيتم هنا حساب وعرض تقارير مكافآت نهاية الخدمة للموظفين المنتهية خدمتهم.
                </p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
