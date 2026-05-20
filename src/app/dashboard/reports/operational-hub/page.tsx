'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UnifiedOperationalRadar } from '@/components/reports/unified-operational-radar';
import { FinancialAchievementPipeline } from '@/components/reports/financial-achievement-pipeline';
import { ExecutiveKpiScorecard } from '@/components/reports/executive-kpi-scorecard';
import { GrowthOpportunitiesReport } from '@/components/reports/growth-opportunities-report';
import { Activity, Sparkles } from 'lucide-react';

export default function OperationalIntelligenceHub() {
    return (
        <div className="space-y-10" dir="rtl">
            {/* 🛡️ الهيدر الرئيسي المحدث بالهوية البرتقالية 🛡️ */}
            <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-gradient-to-r from-[#FF7A00] to-[#FFB000] text-white relative">
                <div className="absolute top-0 right-0 w-80 h-full bg-white/10 -skew-x-12 transform translate-x-32 pointer-events-none" />
                <CardHeader className="pb-10 pt-10 px-10 relative z-10">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                        <div className="flex items-center gap-6">
                            <div className="text-right">
                                <CardTitle className="text-3xl font-black text-white tracking-tighter">مركز تقارير الأداء الفني</CardTitle>
                                <div className="flex items-center gap-2 mt-1">
                                    <Sparkles className="h-4 w-4 text-amber-200 animate-pulse" />
                                    <CardDescription className="text-white/90 font-bold text-sm">رؤية شاملة تربط الإنجاز الميداني بالموقف المالي وفرص التوسع للمنشأة.</CardDescription>
                                </div>
                            </div>
                            <div className="p-5 bg-white/20 rounded-[2rem] backdrop-blur-xl border border-white/40 shadow-2xl">
                                <Activity className="h-10 w-10 text-white" />
                            </div>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Tabs defaultValue="radar" dir="rtl">
                <div className="flex justify-center mb-10">
                    <TabsList className="w-full max-w-4xl h-16 bg-white/40 backdrop-blur-md p-1.5 rounded-2xl border border-white/60 shadow-xl">
                        <TabsTrigger value="radar" className="rounded-xl flex-1 font-black gap-2 h-full transition-all">رادار المتابعة</TabsTrigger>
                        <TabsTrigger value="finance" className="rounded-xl flex-1 font-black gap-2 h-full transition-all">ميزان التحصيل</TabsTrigger>
                        <TabsTrigger value="growth" className="rounded-xl flex-1 font-black gap-2 h-full transition-all">فرص النمو</TabsTrigger>
                        <TabsTrigger value="kpi" className="rounded-xl flex-1 font-black gap-2 h-full transition-all">مؤشرات الأداء</TabsTrigger>
                    </TabsList>
                </div>

                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <TabsContent value="radar" className="mt-0"><UnifiedOperationalRadar /></TabsContent>
                    <TabsContent value="finance" className="mt-0"><FinancialAchievementPipeline /></TabsContent>
                    <TabsContent value="growth" className="mt-0"><GrowthOpportunitiesReport /></TabsContent>
                    <TabsContent value="kpi" className="mt-0"><ExecutiveKpiScorecard /></TabsContent>
                </div>
            </Tabs>
        </div>
    );
}
