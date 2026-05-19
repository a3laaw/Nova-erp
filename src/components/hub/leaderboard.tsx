'use client';

import { useMemo, useState } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { orderBy, limit } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Star, TrendingUp, Sparkles, Crown, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * لوحة الصدارة المطورة (Luxe Leaderboard):
 * تصميم راقٍ يبرز المتصدرين بهوية ذهبية برتقالية ناعمة.
 */
export function Leaderboard() {
    const { firestore } = useFirebase();
    const [period, setPeriod] = useState('monthly');

    const { data: users, loading } = useSubscription<UserProfile>(
        firestore, 
        'users', 
        [orderBy('totalPoints', 'desc'), limit(10)]
    );

    return (
        <Card className="rounded-[3rem] border-none shadow-2xl bg-white overflow-hidden h-full flex flex-col border border-white/60">
            <CardHeader className="p-8 pb-4 bg-gradient-to-b from-orange-50/50 to-white">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <CardTitle className="text-2xl font-black tracking-tighter flex items-center gap-2 text-[#1e1b4b]">
                            <Trophy className="text-[#FFB000] h-7 w-7" />
                            لوحة الصدارة المتميزة
                        </CardTitle>
                        <CardDescription className="text-slate-500 font-bold">الموظفون الأكثر تفاعلاً وإنجازاً في المنظومة.</CardDescription>
                    </div>
                </div>
                
                <Tabs value={period} onValueChange={setPeriod} className="mt-8">
                    <TabsList className="bg-muted/50 p-1 rounded-xl h-11 border-2 border-white shadow-inner">
                        <TabsTrigger value="weekly" className="rounded-lg flex-1 font-black text-[11px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md">أسبوعي</TabsTrigger>
                        <TabsTrigger value="monthly" className="rounded-lg flex-1 font-black text-[11px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md">شهري</TabsTrigger>
                    </TabsList>
                </Tabs>
            </CardHeader>

            <CardContent className="p-6 flex-1 overflow-y-auto scrollbar-none">
                <div className="space-y-4">
                    {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="h-20 w-full rounded-[2rem] bg-muted/20 animate-pulse" />
                        ))
                    ) : users.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 opacity-20 grayscale">
                            <Trophy className="h-16 w-16 mb-2" />
                            <p className="font-black italic">لا توجد نقاط مسجلة</p>
                        </div>
                    ) : (
                        users.map((u, idx) => (
                            <div key={u.id} className={cn(
                                "flex items-center justify-between p-4 rounded-[2.2rem] transition-all border-2 group",
                                idx === 0 ? "bg-gradient-to-r from-orange-100 to-white border-orange-200 shadow-lg scale-[1.03] ring-8 ring-orange-500/5" : "bg-white border-transparent hover:border-slate-100 hover:bg-slate-50"
                            )}>
                                <div className="flex items-center gap-4">
                                    <div className="w-8 flex justify-center">
                                        {idx === 0 ? <Crown className="h-8 w-8 text-[#FFB000] drop-shadow-md animate-bounce" /> : 
                                         idx === 1 ? <Medal className="h-6 w-6 text-slate-400" /> :
                                         idx === 2 ? <Medal className="h-6 w-6 text-amber-600" /> :
                                         <span className="font-black font-mono text-slate-300 text-lg">{idx + 1}</span>}
                                    </div>
                                    <Avatar className="h-12 w-12 border-2 border-white shadow-md">
                                        <AvatarImage src={u.avatarUrl} />
                                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-black">{u.fullName?.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div className="text-right">
                                        <p className="font-black text-sm text-[#1e1b4b] leading-tight">{u.fullName}</p>
                                        <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold mt-1">{u.jobTitle}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl shadow-inner border border-slate-50">
                                    <div className="text-left">
                                        <p className={cn("font-black font-mono text-xl tracking-tighter", idx === 0 ? "text-orange-600" : "text-slate-600")}>{u.totalPoints || 0}</p>
                                        <p className="text-[8px] font-black text-slate-400 uppercase leading-none">نقاط</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
            
            <div className="p-8 bg-muted/10 border-t border-slate-100">
                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-center gap-3">
                    <TrendingUp className="text-primary h-5 w-5" />
                    <p className="text-[10px] font-bold text-slate-500 leading-relaxed">يتم تحديث الترتيب تلقائياً عند تنفيذ المهام الميدانية والحصول على ثناء الزملاء.</p>
                </div>
            </div>
        </Card>
    );
}
