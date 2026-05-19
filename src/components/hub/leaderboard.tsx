'use client';

import { useMemo, useState } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { orderBy, limit } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Star, TrendingUp, Sparkles, Crown, ChevronLeft, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * لوحة الصدارة الملكية (The Gilded Leaderboard):
 * تصميم فائق الجودة يبرز المتصدرين بهوية ذهبية متدرجة ومؤثرات حركية.
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
        <Card className="rounded-[3.5rem] border-none shadow-2xl bg-white/80 backdrop-blur-3xl overflow-hidden h-full flex flex-col border-4 border-white">
            <CardHeader className="p-10 pb-6 bg-gradient-to-b from-primary/5 to-transparent">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner"><Trophy className="h-6 w-6" /></div>
                            <CardTitle className="text-3xl font-black tracking-tighter text-[#1e1b4b]">أسياد المنظومة</CardTitle>
                        </div>
                        <CardDescription className="text-slate-500 font-bold pr-1">الموظفون الأكثر تأثيراً وإنجازاً.</CardDescription>
                    </div>
                </div>
                
                <Tabs value={period} onValueChange={setPeriod} className="mt-8">
                    <TabsList className="bg-slate-100/50 p-1.5 rounded-2xl h-12 border-2 border-white shadow-inner w-full">
                        <TabsTrigger value="weekly" className="rounded-xl flex-1 font-black text-[11px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg transition-all">أسبوعي</TabsTrigger>
                        <TabsTrigger value="monthly" className="rounded-xl flex-1 font-black text-[11px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg transition-all">شهري</TabsTrigger>
                    </TabsList>
                </Tabs>
            </CardHeader>

            <CardContent className="p-8 flex-1 overflow-y-auto scrollbar-none">
                <div className="space-y-5">
                    {loading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-24 w-full rounded-[2.5rem] bg-muted/20 animate-pulse" />
                        ))
                    ) : users.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 opacity-20 grayscale">
                            <Trophy className="h-20 w-20 mb-4" />
                            <p className="font-black text-xl italic">بانتظار المنافسين الأولين</p>
                        </div>
                    ) : (
                        users.map((u, idx) => {
                            const isTop3 = idx < 3;
                            const glowColors = [
                                'shadow-[0_0_30px_rgba(255,183,0,0.2)] border-[#FFB700]/30 bg-gradient-to-r from-amber-50 to-white',
                                'shadow-[0_0_30px_rgba(148,163,184,0.1)] border-slate-200 bg-white',
                                'shadow-[0_0_30px_rgba(180,83,9,0.1)] border-orange-200 bg-white'
                            ];

                            return (
                                <div key={u.id} className={cn(
                                    "flex items-center justify-between p-5 rounded-[2.5rem] transition-all duration-500 border-2 group relative",
                                    isTop3 ? glowColors[idx] : "bg-white/60 border-transparent hover:border-slate-100 hover:bg-white hover:shadow-xl",
                                    idx === 0 && "scale-[1.05] z-10"
                                )}>
                                    <div className="flex items-center gap-5">
                                        <div className="w-10 flex justify-center relative">
                                            {idx === 0 ? <Crown className="h-10 w-10 text-[#FFB700] drop-shadow-[0_2px_10px_rgba(255,183,0,0.5)] animate-bounce" /> : 
                                             idx === 1 ? <Medal className="h-7 w-7 text-slate-400" /> :
                                             idx === 2 ? <Medal className="h-7 w-7 text-amber-600" /> :
                                             <span className="font-black font-mono text-slate-300 text-2xl opacity-40">{idx + 1}</span>}
                                        </div>
                                        <div className="relative">
                                            <Avatar className="h-14 w-14 border-4 border-white shadow-xl group-hover:scale-110 transition-transform duration-500">
                                                <AvatarImage src={u.avatarUrl} className="object-cover" />
                                                <AvatarFallback className="bg-primary/10 text-primary font-black">{u.fullName?.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            {idx === 0 && <div className="absolute -bottom-1 -left-1 h-5 w-5 bg-green-500 border-2 border-white rounded-full animate-pulse" />}
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black text-base text-[#1e1b4b] leading-tight">{u.fullName}</p>
                                            <Badge variant="ghost" className="p-0 h-auto text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">{u.jobTitle}</Badge>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 bg-white/80 backdrop-blur-sm px-5 py-2.5 rounded-2xl shadow-inner border border-slate-100 group-hover:scale-110 transition-transform">
                                        <div className="text-left">
                                            <p className={cn("font-black font-mono text-2xl tracking-tighter", isTop3 ? "text-[#FF7A00]" : "text-slate-600")}>{u.totalPoints || 0}</p>
                                            <p className="text-[8px] font-black text-slate-400 uppercase leading-none tracking-widest">Points</p>
                                        </div>
                                        <Zap className={cn("h-4 w-4", isTop3 ? "text-orange-500 animate-pulse" : "text-slate-200")} />
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </CardContent>
            
            <div className="p-10 bg-muted/10 border-t border-slate-100">
                <div className="p-5 bg-white rounded-[2rem] border-2 border-dashed border-primary/20 flex items-center gap-4 shadow-inner group hover:bg-primary/5 transition-all cursor-help">
                    <div className="p-2 bg-primary/10 rounded-xl"><TrendingUp className="text-primary h-5 w-5 animate-bounce-slow" /></div>
                    <p className="text-[11px] font-bold text-slate-600 leading-relaxed">تتسابق النخبة للحصول على شارة "الموظف الماسي" للشهر القادم. النقاط تُمنح عند إنجاز مراحل العمل الميدانية.</p>
                </div>
            </div>
        </Card>
    );
}