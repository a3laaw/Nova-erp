'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatCard } from './stat-card';
import { 
    Users, 
    CalendarX, 
    Clock, 
    ShieldAlert, 
    PartyPopper, 
    History, 
    Activity
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * لوحة تحكم الموارد البشرية (HR View):
 * تم إصلاح خطأ الـ Syntax البرمجي وضبط تباين الألوان لضمان ثبات البناء.
 */
export function HrDashboard({ data }: any) {
    const hrStats = useMemo(() => {
        const employeesList = data.employees || [];
        const active = employeesList.filter((e: any) => e.status === 'active').length;
        const leaves = employeesList.filter((e: any) => e.status === 'on-leave').length;
        return { active, leaves };
    }, [data.employees]);

    return (
        <div className="space-y-10 animate-in fade-in duration-1000">
            {/* صف الإحصائيات العلوي */}
            <div className="grid gap-6 md:grid-cols-4">
                <StatCard 
                    title="الموظفون النشطون" 
                    value={hrStats.active} 
                    icon={<Users className="h-5 w-5" />} 
                    colorClass="bg-blue-100 text-blue-700" 
                    isCurrency={false}
                />
                <StatCard 
                    title="إجازات حالية" 
                    value={hrStats.leaves} 
                    icon={<CalendarX className="h-5 w-5" />} 
                    colorClass="bg-orange-100 text-[#FF7A00]" 
                    isCurrency={false}
                />
                <StatCard 
                    title="طلبات استئذان" 
                    value={0} 
                    icon={<Clock className="h-5 w-5" />} 
                    colorClass="bg-purple-100 text-purple-700" 
                    isCurrency={false}
                />
                <Card className="rounded-[2.5rem] bg-red-50 border-2 border-red-100 p-6 flex flex-col justify-between shadow-lg animate-pulse">
                    <p className="text-[10px] font-black uppercase text-red-600 tracking-widest">تنبيه وثائق</p>
                    <div className="flex items-center justify-between text-red-800">
                        <span className="text-2xl font-black text-red-700">2 إقامة</span>
                        <ShieldAlert className="h-6 w-6 text-red-600" />
                    </div>
                </Card>
            </div>

            {/* صف الجداول والنبض */}
            <div className="grid gap-8 lg:grid-cols-12">
                <div className="lg:col-span-8">
                    <Card className="rounded-[3rem] border-none shadow-xl overflow-hidden bg-white h-full">
                        <CardHeader className="bg-muted/10 border-b p-8 px-10">
                            <CardTitle className="text-xl font-black text-[#1e1b4b]">طلبات الإجازات المعلقة</CardTitle>
                        </CardHeader>
                        <CardContent className="p-10 flex flex-col items-center justify-center opacity-30 text-center space-y-4">
                            <History className="h-16 w-16 text-muted-foreground" />
                            <p className="font-black text-xl text-slate-400 italic">لا توجد طلبات معلقة للمراجعة حالياً.</p>
                        </CardContent>
                    </Card>
                </div>
                
                <div className="lg:col-span-4 space-y-6">
                    <Card className="rounded-[2.5rem] border-none shadow-xl bg-gradient-to-br from-indigo-50 to-white p-8 border-white">
                        <h4 className="font-black text-lg text-indigo-900 mb-6 flex items-center gap-2">
                            <PartyPopper className="h-5 w-5 text-indigo-600" /> مناسبات قريبة
                        </h4>
                        <div className="space-y-4">
                            <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border shadow-sm group hover:scale-[1.02] transition-transform">
                                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600 font-black text-xs">24 مار</div>
                                <div className="space-y-0.5">
                                    <p className="font-black text-sm text-slate-800">عيد ميلاد: أحمد علي</p>
                                    <p className="text-[10px] text-muted-foreground font-bold">القسم المعماري</p>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 border-white">
                        <h4 className="font-black text-lg text-slate-800 mb-6 flex items-center gap-2">
                            <Activity className="h-5 w-5 text-[#FF7A00]" /> حالة الانضباط العام
                        </h4>
                        <div className="flex justify-between items-center p-4 bg-muted/20 rounded-2xl border border-dashed border-primary/20">
                            <span className="font-bold text-sm text-slate-600">نسبة الحضور اليوم:</span>
                            <Badge className="bg-green-600 text-white font-mono font-black">92%</Badge>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}