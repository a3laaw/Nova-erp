'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
    Sparkles, 
    Heart, 
    TrendingUp,
    Activity,
    Zap,
    Trophy,
    Clock
} from 'lucide-react';
import { MoodTracker } from '@/components/hub/mood-tracker';
import { InteractionsFeed } from '@/components/hub/interactions-feed';
import { Leaderboard } from '@/components/hub/leaderboard';
import { KudosDialog } from '@/components/hub/kudos-dialog';
import { useAuth } from '@/context/auth-context';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * الحائط التفاعلي للموظف (Interactive Employee Hub):
 * تم تحويل زر الشكر ليكون لؤلؤياً عائماً (Pearl Floating) بوضوح نصي مطلق وحركة هادئة.
 */
export default function EmployeeHubPage() {
    const { user } = useAuth();
    const [isKudosOpen, setIsKudosOpen] = useState(false);

    return (
        <div className="space-y-8 pb-20 max-w-[1400px] mx-auto animate-in fade-in duration-1000" dir="rtl">
            {/* 🛡️ الهيدر الرئيسي المحدث بالهوية البرتقالية 🛡️ */}
            <Card className="rounded-[3.5rem] border-none shadow-2xl overflow-hidden bg-gradient-to-r from-[#FF7A00] to-[#FFB000] text-white relative group">
                <div className="absolute top-0 right-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none" />
                
                <CardHeader className="pb-12 pt-12 px-12 relative z-10">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-10">
                        <div className="flex items-center gap-8 order-2 lg:order-1">
                            {/* 🌟 زر الشكر اللؤلؤي البارز والعائم (حركة 6 ثوانٍ) 🌟 */}
                            <Button 
                                onClick={() => setIsKudosOpen(true)}
                                className="h-16 px-12 rounded-[2.5rem] font-black text-2xl gap-4 bg-white text-[#1e1b4b] shadow-[0_20px_50px_-10px_rgba(255,122,0,0.3)] hover:scale-105 active:scale-95 border-none transition-all duration-300 hover:bg-slate-50 animate-float-slow"
                            >
                                <Heart className="h-8 w-8 fill-red-500 text-red-500 animate-pulse" />
                                <span className="drop-shadow-sm">شكر زميل</span>
                            </Button>
                        </div>

                        <div className="flex items-center gap-8 order-1 lg:order-2">
                            <div className="text-right space-y-2">
                                <CardTitle className="text-5xl font-black text-white tracking-tighter drop-shadow-2xl">نبض الإنجاز</CardTitle>
                                <div className="flex items-center gap-3 justify-end">
                                    <CardDescription className="text-white font-bold text-xl leading-relaxed">قلب Nova ERP التفاعلي.. حيث تلتقي الأرقام بالإنسان.</CardDescription>
                                    <div className="h-2 w-2 rounded-full bg-white animate-ping" />
                                </div>
                            </div>
                            <div className="relative">
                                <div className="p-6 bg-white/20 rounded-[2.5rem] shadow-[0_0_50px_rgba(255,255,255,0.2)] border-4 border-white/40 transform group-hover:rotate-6 transition-transform duration-500">
                                    <Sparkles className="h-12 w-12 text-white animate-pulse" />
                                </div>
                                <Badge className="absolute -top-3 -right-3 bg-white text-[#FF7A00] font-black px-3 py-1 border-none shadow-xl animate-bounce">LIVE</Badge>
                            </div>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start px-2">
                <div className="lg:col-span-4 space-y-8 sticky top-24">
                    <Leaderboard />
                    
                    <Card className="rounded-[3rem] border-none shadow-2xl bg-white/40 backdrop-blur-3xl p-10 space-y-8 border border-white/60 relative overflow-hidden group">
                        <div className="flex items-center justify-between">
                            <h3 className="font-black text-2xl text-[#1e1b4b] flex items-center gap-3">
                                <Zap className="text-[#FF7A00] h-8 w-8 fill-[#FF7A00]/20" /> رصيد نقاطك
                            </h3>
                            <div className="p-3 bg-orange-50 rounded-2xl text-orange-600 shadow-inner"><Trophy className="h-5 w-5"/></div>
                        </div>
                        <div className="p-10 bg-gradient-to-br from-orange-50 via-white to-white rounded-[2.5rem] border-4 border-white shadow-xl flex items-center justify-between group-hover:scale-[1.02] transition-all duration-500">
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-orange-400 uppercase tracking-[0.3em] mb-2">XP Tokens</p>
                                <p className="text-6xl font-black font-mono text-[#FF7A00] tracking-tighter">
                                    {user?.totalPoints || 0}
                                </p>
                            </div>
                            <div className="p-5 bg-white rounded-3xl shadow-2xl border border-orange-50 animate-float">
                                <Sparkles className="h-10 w-10 text-[#FF7A00] animate-pulse" />
                            </div>
                        </div>
                    </Card>
                </div>

                <div className="lg:col-span-8 space-y-10">
                    <MoodTracker />
                    <InteractionsFeed />
                </div>
            </div>

            <KudosDialog isOpen={isKudosOpen} onClose={() => setIsKudosOpen(false)} />
        </div>
    );
}
