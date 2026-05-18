'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { FileBarChart, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { reportList } from './report-data'; // افتراض وجود ملف بيانات للتقارير

export default function HrReportsDashboard() {
  return (
    <div className="space-y-10" dir="rtl">
        {/* 🛡️ الهيدر الرئيسي السيادي المحدث بالهوية البرتقالية 🛡️ */}
        <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-gradient-to-r from-[#FF7A00] to-[#FFB000] text-white relative">
            <div className="absolute top-0 right-0 w-80 h-full bg-white/10 -skew-x-12 transform translate-x-32 pointer-events-none" />
            <CardHeader className="pb-10 pt-10 px-10 relative z-10">
                <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <CardTitle className="text-3xl font-black text-white tracking-tighter">لوحة تقارير الموارد البشرية</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                                <Sparkles className="h-4 w-4 text-amber-200 animate-pulse" />
                                <CardDescription className="text-white/90 font-bold text-sm">تحليلات شاملة للحضور، التكاليف، والأرصدة لضمان كفاءة القوى العاملة.</CardDescription>
                            </div>
                        </div>
                        <div className="p-5 bg-white/20 rounded-[2rem] backdrop-blur-xl border border-white/40 shadow-2xl">
                            <FileBarChart className="h-10 w-10 text-white" />
                        </div>
                    </div>
                </div>
            </CardHeader>
        </Card>

        <Card className="border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white/95">
            <CardContent className="pt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 p-10">
                {/* تقارير الموارد البشرية التفصيلية هنا... */}
            </CardContent>
        </Card>
    </div>
  );
}
