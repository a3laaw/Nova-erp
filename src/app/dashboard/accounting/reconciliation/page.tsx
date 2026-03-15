'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StandardReconciliationView } from '@/components/accounting/reconciliation/standard-reconciliation';
import { IntermediaryReconciliationView } from '@/components/accounting/reconciliation/intermediary-reconciliation';
import { useAppTheme } from '@/context/theme-context';
import { cn } from '@/lib/utils';
import { Scale, Landmark, Share2 } from 'lucide-react';

export default function ReconciliationPage() {
    const { theme } = useAppTheme();
    const isGlass = theme === 'glass';

    return (
        <div className="space-y-8" dir="rtl">
            <Card className={cn(
                "border-none rounded-[2.5rem] overflow-hidden",
                isGlass ? "glass-effect" : "bg-gradient-to-l from-white to-blue-50 shadow-sm"
            )}>
                <CardHeader className="pb-8 px-8 border-b">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600/10 rounded-2xl text-blue-600 shadow-inner">
                            <Scale className="h-8 w-8" />
                        </div>
                        <div>
                            <CardTitle className="text-3xl font-black">مركز التسويات البنكية</CardTitle>
                            <CardDescription className="text-base font-medium">مطابقة كشوف الحسابات البنكية مع قيود النظام وسحب عمولات الوسطاء.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Tabs defaultValue="standard" dir="rtl" className="space-y-10">
                <TabsList className={cn(
                    "w-full h-auto bg-transparent p-0 gap-6",
                    isGlass ? "tabs-list-cards lg:grid-cols-2" : "grid grid-cols-1 md:grid-cols-2"
                )}>
                    <TabsTrigger value="standard" className={cn("text-right", isGlass ? "tabs-trigger-card" : "")}>
                        <div className="tab-icon-box"><Landmark className="h-6 w-6" /></div>
                        <h3 className="text-lg font-black">التسوية القياسية</h3>
                        <p className="text-[10px] font-bold text-muted-foreground">مطابقة حركة مقابل حركة لكشوف الحسابات التقليدية.</p>
                    </TabsTrigger>
                    
                    <TabsTrigger value="intermediary" className={cn("text-right", isGlass ? "tabs-trigger-card" : "")}>
                        <div className="tab-icon-box"><Share2 className="h-6 w-6" /></div>
                        <h3 className="text-lg font-black">شركات الوساطة</h3>
                        <p className="text-[10px] font-bold text-muted-foreground">معالجة الدفعات المجمعة من بوابات الدفع (K-Net, Link).</p>
                    </TabsTrigger>
                </TabsList>

                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <TabsContent value="standard" className="m-0"><StandardReconciliationView /></TabsContent>
                    <TabsContent value="intermediary" className="m-0"><IntermediaryReconciliationView /></TabsContent>
                </div>
            </Tabs>
        </div>
    );
}