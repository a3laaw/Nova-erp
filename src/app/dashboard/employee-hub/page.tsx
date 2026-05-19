'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
    Sparkles, 
    Heart, 
    Lightbulb, 
    Rocket, 
    Award,
    TrendingUp,
    Activity,
    MessageSquare,
    Zap,
    Users
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
 * موديول "الأنسنة والتحفيز" - يجمع بين العمليات المهنية والتفاعل الاجتماعي.
 */
export default function EmployeeHubPage() {
    const { user } = useAuth();
    const [isKudosOpen, setIsKudosOpen] = useState(false);

    return (
        <div className="space-y-10 pb-20" dir="rtl">
            {/* 🛡️ الهيدر الرئيسي السيادي المحدث 🛡️ */}
            <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-gradient-to-r from-[#FF7A00] to-[#FFB000] text-white relative">
                <div className="absolute top-0 right-0 w-96 h-full bg-white/10 -skew-x-12 transform translate-x-40 pointer-events-none" />
                <CardHeader className="pb-10 pt-10 px-12 relative z-10">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                        <div className="flex items-center gap-8">
                            <div className="p-6 bg-white/20 rounded-[2.5rem] backdrop-blur-2xl border border-white/40 shadow-2xl animate-in zoom-in duration-700">
                                <Sparkles className="h-12 w-12 text-white" />
                            </div>
                            <div className="text-right">
                                <CardTitle className="text-4xl font-black text-white tracking-tighter">الحائط التفاعلي للموظف</CardTitle>
                                <div className="flex items-center gap-3 mt-2">
                                    <Badge className="bg-white/20 text-white border-white/40 font-black text-[10px] px-3">مركز التقدير الاجتماعي</Badge>
                                    <CardDescription className="text-white/90 font-bold text-lg">شارك أفكارك، اشكر زمالائك، ونافس على صدارة المتميزين.</CardDescription>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            <Button 
                                onClick={() => setIsKudosOpen(true)}
                                className="h-14 px-10 rounded-2xl font-black text-xl gap-3 bg-white text-[#FF7A00] shadow-2xl hover:bg-slate-50 border-none transition-all active:scale-95"
                            >
                                <Heart className="h-6 w-6 fill-[#FF7A00]" />
                                إرسال شكر لزميل
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* العمود الجانبي: المتصدرين والإحصائيات */}
                <div className="lg:col-span-4 space-y-8 sticky top-24">
                    <Leaderboard />
                    
                    <Card className="rounded-[2.5rem] border-none shadow-xl bg-white/60 backdrop-blur-xl p-8 space-y-6">
                        <h3 className="font-black text-xl text-[#1e1b4b] flex items-center gap-3">
                            <Zap className="text-orange-500 h-6 w-6" /> رصيدك النقدي
                        </h3>
                        <div className="p-6 bg-primary/5 rounded-3xl border-2 border-dashed border-primary/20 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black text-primary uppercase tracking-widest">إجمالي النقاط المكتسبة</p>
                                <p className="text-4xl font-black font-mono text-primary">{user?.totalPoints || 0}</p>
                            </div>
                            <div className="p-3 bg-primary/10 rounded-2xl text-primary font-black shadow-inner">🏆</div>
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 leading-relaxed italic">يمكنك استبدال نقاطك بمكافآت عينية أو إجازات إضافية عبر قسم الموارد البشرية.</p>
                    </Card>
                </div>

                {/* العمود الرئيسي: الحائط والتدفق الحي */}
                <div className="lg:col-span-8 space-y-8">
                    <MoodTracker />
                    
                    <div className="flex items-center justify-between px-4">
                        <h3 className="text-2xl font-black text-[#1e1b4b] flex items-center gap-3">
                            <Activity className="text-primary h-6 w-6 animate-pulse" />
                            تدفق النشاط الحي
                        </h3>
                        <div className="flex gap-2">
                             <Badge variant="outline" className="bg-white font-bold h-7 px-4">الأحدث أولاً</Badge>
                        </div>
                    </div>

                    <InteractionsFeed />
                </div>
            </div>

            <KudosDialog isOpen={isKudosOpen} onClose={() => setIsKudosOpen(false)} />
        </div>
    );
}
