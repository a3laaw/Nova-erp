'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AttendanceUploader } from '@/components/hr/attendance-uploader';
import { PayrollGenerator } from '@/components/hr/payroll-generator';
import { Users2, Sheet, FileSpreadsheet, Banknote, ShieldCheck, Sparkles, History } from 'lucide-react';
import { PayslipsList } from '@/components/hr/payslips-list';
import { useAppTheme } from '@/context/theme-context';
import { cn } from '@/lib/utils';

export default function PayrollPage() {
    const { theme } = useAppTheme();
    const isGlass = theme === 'glass';

    return (
        <div className="space-y-8" dir="rtl">
            <Card className={cn(
                "border-none rounded-[2.5rem] overflow-hidden",
                isGlass ? "glass-effect" : "bg-gradient-to-l from-white to-purple-50 shadow-sm"
            )}>
                <CardHeader className="pb-8 px-8 border-b">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner">
                            <Banknote className="h-8 w-8" />
                        </div>
                        <div>
                            <CardTitle className="text-3xl font-black">إدارة الرواتب والأجور</CardTitle>
                            <CardDescription className="text-base font-medium">معالجة حضور الموظفين، التدقيق المالي، واعتماد كشوف الرواتب الشهرية.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Tabs defaultValue="attendance" dir="rtl" className="space-y-0">
                <div className={cn(isGlass ? "tabs-frame-primary" : "mb-8")}>
                    <TabsList className={cn(
                        "w-full h-auto bg-transparent p-0 gap-6",
                        isGlass ? "tabs-list-cards" : "grid grid-cols-1 md:grid-cols-3"
                    )}>
                        <TabsTrigger value="attendance" className={cn("text-right", isGlass ? "tabs-trigger-card" : "")}>
                            <div className="tab-icon-box"><Users2 className="h-6 w-6" /></div>
                            <h3 className="text-lg font-black">رفع الحضور</h3>
                            <p className="text-[10px] font-bold text-muted-foreground">استيراد سجلات البصمة ومطابقتها مع التراخيص.</p>
                        </TabsTrigger>
                        
                        <TabsTrigger value="payroll" className={cn("text-right", isGlass ? "tabs-trigger-card" : "")}>
                            <div className="tab-icon-box"><ShieldCheck className="h-6 w-6" /></div>
                            <h3 className="text-lg font-black">معالجة الرواتب</h3>
                            <p className="text-[10px] font-bold text-muted-foreground">احتساب البدلات والخصومات وإغلاق الفترة مالياً.</p>
                        </TabsTrigger>

                        <TabsTrigger value="payslips" className={cn("text-right", isGlass ? "tabs-trigger-card" : "")}>
                            <div className="tab-icon-box"><FileSpreadsheet className="h-6 w-6" /></div>
                            <h3 className="text-lg font-black">كشوفات الصرف</h3>
                            <p className="text-[10px] font-bold text-muted-foreground">عرض وتصدير قسائم الرواتب النهائية المعتمدة.</p>
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <TabsContent value="attendance" className="m-0"><AttendanceUploader /></TabsContent>
                    <TabsContent value="payroll" className="m-0"><PayrollGenerator /></TabsContent>
                    <TabsContent value="payslips" className="m-0"><PayslipsList /></TabsContent>
                </div>
            </Tabs>
        </div>
    );
}