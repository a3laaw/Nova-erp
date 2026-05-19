'use client';

import { useMemo, useState } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { orderBy, limit } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Star, TrendingUp, Sparkles, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function Leaderboard() {
    const { firestore } = useFirebase();
    const [period, setPeriod] = useState('monthly');

    const { data: users, loading } = useSubscription<UserProfile>(
        firestore, 
        'users', 
        [orderBy('totalPoints', 'desc'), limit(10)]
    );

    return (
        <Card className="rounded-[3rem] border-none shadow-2xl bg-slate-900 text-white overflow-hidden h-full flex flex-col">
            <CardHeader className="p-8 pb-4 border-b border-white/10 bg-slate-950/60">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <CardTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
                            <Trophy className="text-yellow-500 h-6 w-6" />
                            لوحة الصدارة السيادية
                        </CardTitle>
                        <CardDescription className="text-indigo-200/60 font-bold">الموظفون الأكثر تفاعلاً وإنجازاً في المنظومة.</CardDescription>
                    </div>
                </div>
                
                <Tabs value={period} onValueChange={setPeriod} className="mt-6">
                    <TabsList className="bg-white/5 p-1 rounded-xl h-10 border border-white/10">
                        <TabsTrigger value="weekly" className="rounded-lg px-6 font-black text-[10px] data-[state=active]:bg-indigo-600">أسبوعي</TabsTrigger>
                        <TabsTrigger value="monthly" className="rounded-lg px-6 font-black text-[10px] data-[state=active]:bg-indigo-600">شهري</TabsTrigger>
                    </TabsList>
                </Tabs>
            </CardHeader>
            <CardContent className="p-6 flex-1 overflow-y-auto scrollbar-none">
                <div className="space-y-3">
                    {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="h-16 w-full rounded-2xl bg-white/5 animate-pulse" />
                        ))
                    ) : users.length === 0 ? (
                        <p className="text-center py-20 opacity-20 italic">لا توجد نقاط مسجلة بعد.</p>
                    ) : (
                        users.map((u, idx) => (
                            <div key={u.id} className={cn(
                                "flex items-center justify-between p-4 rounded-3xl transition-all border border-transparent",
                                idx === 0 ? "bg-gradient-to-r from-yellow-500/20 to-transparent border-yellow-500/20 scale-[1.02]" : "bg-white/5"
                            )}>
                                <div className="flex items-center gap-4">
                                    <div className="w-8 flex justify-center">
                                        {idx === 0 ? <Crown className="h-6 w-6 text-yellow-500" /> : 
                                         idx === 1 ? <Medal className="h-5 w-5 text-slate-400" /> :
                                         idx === 2 ? <Medal className="h-5 w-5 text-amber-600" /> :
                                         <span className="font-black font-mono text-slate-500">{idx + 1}</span>}
                                    </div>
                                    <Avatar className="h-10 w-10 border-2 border-white/10">
                                        <AvatarImage src={u.avatarUrl} />
                                        <AvatarFallback className="bg-indigo-600 text-xs font-black">{u.fullName?.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div className="text-right">
                                        <p className="font-black text-sm">{u.fullName}</p>
                                        <p className="text-[9px] text-indigo-300 uppercase tracking-widest font-bold">{u.jobTitle}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="text-left">
                                        <p className="font-black font-mono text-lg text-yellow-500">{u.totalPoints || 0}</p>
                                        <p className="text-[8px] font-black text-slate-500 uppercase">نقطة</p>
                                    </div>
                                    {idx === 0 && <Sparkles className="h-4 w-4 text-yellow-500 animate-pulse" />}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
            <div className="p-6 bg-slate-950/40 border-t border-white/5">
                <div className="p-4 bg-indigo-600/10 rounded-2xl border border-indigo-500/20 flex items-center gap-3">
                    <TrendingUp className="text-indigo-400 h-5 w-5" />
                    <p className="text-[10px] font-bold text-indigo-200">يتم تحديث الترتيب تلقائياً عند تنفيذ المهام والحصول على الثناء.</p>
                </div>
            </div>
        </Card>
    );
}
