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
    Trophy
} from 'lucide-react';
import { MoodTracker } from '@/components/hub/mood-tracker';
import { InteractionsFeed } from '@/components/hub/interactions-feed';
import { Leaderboard } from '@/components/hub/leaderboard';
import { KudosDialog } from '@/components/hub/kudos-dialog';
import { useAuth } from '@/context/auth-context';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * الحائط التفاعلي للموظف (Interactive Employee Hub) - النسخة المطورة V2.0:
 * تم إعادة التصميم ليعبر عن الفخامة والاحترافية مع دمج نظام النقاط والرتب.
 */
export default function EmployeeHubPage() {
    const { user } = useAuth();
    const [isKudosOpen, setIsKudosOpen] = useState(false);

    return (
        <div className="space-y-8 pb-20 max-w-[1400px] mx-auto" dir="rtl">
            {/* 🛡️ الهيدر المطور بلمسة ذهبية 🛡️ */}
            <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-gradient-to-r from-[#FF7A00] to-[#FFB000] text-white relative">
                <div className="absolute top-0 right-0 w-96 h-full bg-white/10 -skew-x-12 transform translate-x-40 pointer-events-none" />
                <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-white/5 rounded-full blur-3xl" />
                <CardHeader className="pb-10 pt-10 px-12 relative z-10">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                        <div className="flex items-center gap-6">
                            <div className="p-5 bg-white/20 rounded-[2rem] backdrop-blur-xl border border-white/30 shadow-2xl animate-in zoom-in duration-700">
                                <Sparkles className="h-10 w-10 text-white animate-pulse" />
                            </div>
                            <div className="text-right">
                                <CardTitle className="text-4xl font-black text-white tracking-tighter">حائط الإنجاز والتفاعل</CardTitle>
                                <div className="flex items-center gap-3 mt-2">
                                    <Badge className="bg-white/20 text-white border-white/40 font-black text-[10px] px-3 py-0.5">مجتمع نوفا المهني</Badge>
                                    <CardDescription className="text-white/90 font-bold text-lg">شارك أفكارك، اشكر زمالائك، ونافس على الصدارة.</CardDescription>
                                </div>
                            </div>
                        </div>
                        
                        <Button 
                            onClick={() => setIsKudosOpen(true)}
                            className="h-14 px-10 rounded-2xl font-black text-xl gap-3 bg-white text-[#FF7A00] shadow-2xl hover:bg-slate-50 border-none transition-all active:scale-95 group"
                        >
                            <Heart className="h-6 w-6 fill-[#FF7A00] group-hover:scale-125 transition-transform" />
                            إرسال بطاقة شكر
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* العمود الجانبي: لوحة الصدارة والرصيد */}
                <div className="lg:col-span-4 space-y-8 sticky top-24">
                    <Leaderboard />
                    
                    <Card className="rounded-[2.5rem] border-none shadow-xl bg-white/60 backdrop-blur-xl p-8 space-y-6 border border-white/80">
                        <div className="flex items-center justify-between">
                            <h3 className="font-black text-xl text-[#1e1b4b] flex items-center gap-3">
                                <Zap className="text-orange-500 h-6 w-6" /> رصيد نقاطك
                            </h3>
                            <div className="p-2 bg-orange-50 rounded-xl text-orange-600"><Trophy className="h-4 w-4"/></div>
                        </div>
                        <div className="p-8 bg-gradient-to-br from-orange-50 to-white rounded-[2rem] border-2 border-dashed border-orange-200 flex items-center justify-between shadow-inner">
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">إجمالي النقاط المكتسبة</p>
                                <p className="text-5xl font-black font-mono text-[#FF7A00] tracking-tighter">
                                    {user?.totalPoints || 0}
                                </p>
                            </div>
                            <div className="p-4 bg-white rounded-2xl shadow-lg border border-orange-50">
                                <Sparkles className="h-8 w-8 text-[#FF7A00] animate-pulse" />
                            </div>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 leading-relaxed italic text-center">
                            يمكنك استبدال نقاطك بمكافآت عينية أو إجازات إضافية عبر قسم الموارد البشرية.
                        </p>
                    </Card>
                </div>

                {/* العمود الرئيسي: الحالة والتدفق */}
                <div className="lg:col-span-8 space-y-8">
                    <MoodTracker />
                    
                    <div className="flex items-center justify-between px-4">
                        <div className="flex items-center gap-3">
                            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                            <h3 className="text-2xl font-black text-[#1e1b4b]">تدفق النشاط الحي</h3>
                        </div>
                        <div className="flex gap-2">
                             <Badge variant="outline" className="bg-white font-bold h-8 px-4 rounded-full border-2 border-slate-100">الأحدث أولاً</Badge>
                        </div>
                    </div>

                    <InteractionsFeed />
                </div>
            </div>

            <KudosDialog isOpen={isKudosOpen} onClose={() => setIsKudosOpen(false)} />
        </div>
    );
}
