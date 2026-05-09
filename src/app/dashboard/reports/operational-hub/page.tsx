
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UnifiedOperationalRadar } from '@/components/reports/unified-operational-radar';
import { FinancialAchievementPipeline } from '@/components/reports/financial-achievement-pipeline';
import { ExecutiveKpiScorecard } from '@/components/reports/executive-kpi-scorecard';
import { Activity, BarChart3, Coins, PieChart, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppTheme } from '@/context/theme-context';

/**
 * مركز الذكاء العملياتي (Operational Intelligence Hub):
 * مجمع التقارير السيادي المدمج لتقليل التشتت الإداري.
 * يدمج 5 تقارير سابقة في 3 محركات تحليلية كبرى مع فلاتر ديناميكية.
 */
export default function OperationalIntelligenceHub() {
  const { theme } = useAppTheme();
  const isGlass = theme === 'glass';

  return (
    <div className="space-y-6" dir="rtl">
        <Card className={cn(
            "rounded-[2.5rem] border-none shadow-sm overflow-hidden",
            isGlass ? "glass-effect" : "bg-gradient-to-l from-white to-indigo-50 shadow-sm"
        )}>
            <CardHeader className="pb-8 px-8 border-b">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600/10 rounded-2xl text-indigo-600 shadow-inner">
                        <Activity className="h-8 w-8" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-black text-[#1e1b4b]">مركز الذكاء العملياتي (Sovereign Intelligence)</CardTitle>
                        <CardDescription className="text-base font-medium">
                            رؤية شاملة تربط الإنجاز الفني بالتدفق المالي وكفاءة الأقسام في واجهة واحدة.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
        </Card>

        <Tabs defaultValue="radar" dir="rtl">
            <div className={cn(isGlass ? "tabs-frame-secondary" : "mb-8 bg-white rounded-3xl shadow-sm p-4")}>
                <TabsList className={cn(
                    "grid w-full grid-cols-1 md:grid-cols-3 bg-transparent h-auto p-0 gap-4",
                    isGlass ? "" : ""
                )}>
                    <TabsTrigger value="radar" className={cn("py-4 rounded-xl font-black h-14 gap-3", isGlass && "tabs-trigger-card")}>
                        <ShieldCheck className="h-5 w-5"/> رادار "نبض العمل والميدان"
                    </TabsTrigger>
                    <TabsTrigger value="finance" className={cn("py-4 rounded-xl font-black h-14 gap-3", isGlass && "tabs-trigger-card")}>
                        <Coins className="h-5 w-5"/> ميزان "التدفق والتحصيل"
                    </TabsTrigger>
                    <TabsTrigger value="kpi" className={cn("py-4 rounded-xl font-black h-14 gap-3", isGlass && "tabs-trigger-card")}>
                        <BarChart3 className="h-5 w-5"/> لوحة "كفاءة القطاعات - KPIs"
                    </TabsTrigger>
                </TabsList>
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                <TabsContent value="radar" className="mt-0">
                    <UnifiedOperationalRadar />
                </TabsContent>
                <TabsContent value="finance" className="mt-0">
                    <FinancialAchievementPipeline />
                </TabsContent>
                <TabsContent value="kpi" className="mt-0">
                    <ExecutiveKpiScorecard />
                </TabsContent>
            </div>
        </Tabs>
    </div>
  );
}
