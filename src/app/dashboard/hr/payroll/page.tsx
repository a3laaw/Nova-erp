'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AttendanceUploader } from '@/components/hr/attendance-uploader';
import { PayrollGenerator } from '@/components/hr/payroll-generator';
import { Users2, Sheet, FileSpreadsheet } from 'lucide-react';
import { PayslipsList } from '@/components/hr/payslips-list';

export default function PayrollPage() {
    return (
        <Tabs defaultValue="attendance" dir="rtl">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="attendance">
                    <Users2 className="ml-2 h-4 w-4" />
                    1. رفع الحضور والانصراف
                </TabsTrigger>
                <TabsTrigger value="payroll">
                    <Sheet className="ml-2 h-4 w-4" />
                    2. معالجة الرواتب
                </TabsTrigger>
                 <TabsTrigger value="payslips">
                    <FileSpreadsheet className="ml-2 h-4 w-4" />
                    3. عرض الكشوفات
                </TabsTrigger>
            </TabsList>
            <TabsContent value="attendance" className="mt-4">
                <AttendanceUploader />
            </TabsContent>
            <TabsContent value="payroll" className="mt-4">
                 <Card>
                    <CardHeader>
                        <CardTitle>معالجة كشوف الرواتب</CardTitle>
                        <CardDescription>
                           توليد كشوف الرواتب الشهرية بناءً على سجلات الحضور والغياب للموظفين.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                       <PayrollGenerator />
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="payslips" className="mt-4">
                 <Card>
                    <CardHeader>
                        <CardTitle>كشوف الرواتب المُنشأة</CardTitle>
                        <CardDescription>
                           مراجعة وتأكيد دفع كشوف الرواتب التي تم إنشاؤها.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                       <PayslipsList />
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    );
}
