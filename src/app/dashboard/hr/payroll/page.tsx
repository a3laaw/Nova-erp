'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AttendanceUploader } from '@/components/hr/attendance-uploader';
import { PayrollGenerator } from '@/components/hr/payroll-generator';
import { Users2, Sheet, FileSpreadsheet, Banknote } from 'lucide-react';
import { PayslipsList } from '@/components/hr/payslips-list';

export default function PayrollPage() {
    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-gradient-to-l from-white to-purple-50 dark:from-card dark:to-card">
                <CardHeader className="pb-8 px-8 border-b">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner">
                            <Banknote className="h-8 w-8" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-black">إدارة الرواتب والأجور</CardTitle>
                            <CardDescription className="text-base font-medium">معالجة حضور الموظفين، التدقيق المالي، واعتماد كشوف الرواتب الشهرية.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Tabs defaultValue="attendance" dir="rtl" className="space-y-6">
                <TabsList className="grid w-full grid-cols-3 h-14 rounded-2xl bg-muted/50 p-1.5 shadow-inner">
                    <TabsTrigger value="attendance" className="rounded-xl font-black gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md">
                        <Users2 className="h-4 w-4" />
                        1. رفع الحضور والانصراف
                    </TabsTrigger>
                    <TabsTrigger value="payroll" className="rounded-xl font-black gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md">
                        <Sheet className="h-4 w-4" />
                        2. معالجة الرواتب
                    </TabsTrigger>
                    <TabsTrigger value="payslips" className="rounded-xl font-black gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md">
                        <FileSpreadsheet className="h-4 w-4" />
                        3. عرض الكشوفات
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="attendance" className="mt-0 animate-in fade-in zoom-in-95 duration-300">
                    <AttendanceUploader />
                </TabsContent>

                <TabsContent value="payroll" className="mt-0 animate-in fade-in zoom-in-95 duration-300">
                    <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-white">
                        <CardHeader className="bg-muted/10 border-b pb-6">
                            <CardTitle className="font-black">معالجة كشوف الرواتب</CardTitle>
                            <CardDescription className="text-sm font-medium">توليد كشوف الرواتب الشهرية بناءً على سجلات الحضور والغياب المدققة.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-8">
                            <PayrollGenerator />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="payslips" className="mt-0 animate-in fade-in zoom-in-95 duration-300">
                    <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-white">
                        <CardHeader className="bg-muted/10 border-b pb-6">
                            <CardTitle className="font-black">كشوف الرواتب المعتمدة</CardTitle>
                            <CardDescription className="text-sm font-medium">مراجعة وتأكيد دفع الرواتب وإصدار السجلات المالية.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-8">
                            <PayslipsList />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
