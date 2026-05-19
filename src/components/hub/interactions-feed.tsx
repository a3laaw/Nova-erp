'use client';

import { useMemo, useState } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { orderBy, limit, doc, updateDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import type { HubPost } from '@/lib/types';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
    Heart, 
    Lightbulb, 
    PartyPopper, 
    MessageCircle, 
    CheckCircle2,
    ThumbsUp,
    Loader2,
    Sparkles,
    Activity,
    Clock 
} from 'lucide-react';
import { formatDistanceToNow, isValid } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { useAuth } from '@/context/auth-context';
import { cn, getTenantPath } from '@/lib/utils';
import { Skeleton } from '../ui/skeleton';
import { Separator } from '../ui/separator';

/**
 * تدفق النشاط الحي (The Living Stream):
 * تم تحصين معالجة التواريخ لتجنب أخطاء Invalid time value وتأمين استيرادات المكونات.
 */
export function InteractionsFeed() {
    const { firestore } = useFirebase();
    const { user } = useAuth();
    
    const { data: posts, loading } = useSubscription<HubPost>(
        firestore, 
        user?.currentCompanyId ? 'hub_posts' : null, 
        [orderBy('createdAt', 'desc'), limit(30)]
    );

    if (loading) return (
        <div className="space-y-8">
            <Skeleton className="h-72 w-full rounded-[3rem]" />
            <Skeleton className="h-72 w-full rounded-[3rem]" />
        </div>
    );

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            {posts.length === 0 ? (
                <div className="h-[500px] flex flex-col items-center justify-center opacity-30 grayscale rounded-[4rem] border-4 border-dashed bg-white/40 shadow-inner">
                    <div className="p-10 bg-muted rounded-[2.5rem] mb-8 shadow-inner animate-pulse">
                        <Activity className="h-20 w-20 text-muted-foreground" />
                    </div>
                    <p className="text-3xl font-black text-[#1e1b4b] tracking-tighter">الحائط بانتظار إنجازاتكم اليوم</p>
                    <p className="text-lg font-bold mt-3 text-slate-500">سيتم عرض التفاعلات وأخبار الشركة هنا فور حدوثها.</p>
                </div>
            ) : (
                posts.map((post, idx) => <PostCard key={post.id} post={post} index={idx} />)
            )}
        </div>
    );
}

function PostCard({ post, index }: { post: HubPost, index: number }) {
    const { firestore } = useFirebase();
    const { user } = useAuth();
    const [isVoting, setIsUpdating] = useState(false);

    const hasVoted = useMemo(() => post.voters?.includes(user?.id || ''), [post.voters, user?.id]);

    const handleVote = async () => {
        if (!firestore || !user?.id || isVoting) return;
        setIsUpdating(true);
        try {
            const tenantId = user.currentCompanyId!;
            const postRef = doc(firestore, getTenantPath(`hub_posts/${post.id}`, tenantId));
            
            if (hasVoted) {
                await updateDoc(postRef, {
                    votesCount: increment(-1),
                    voters: arrayRemove(user.id)
                });
            } else {
                await updateDoc(postRef, {
                    votesCount: increment(1),
                    voters: arrayUnion(user.id)
                });
            }
        } finally { setIsUpdating(false); }
    };

    const typeConfig: Record<string, any> = {
        system_achievement: { icon: CheckCircle2, color: 'bg-green-100 text-green-700 border-green-200', label: 'إنجاز نظام', accent: 'border-r-green-500' },
        employee_idea: { icon: Lightbulb, color: 'bg-amber-100 text-amber-700 border-amber-200', label: 'فكرة تطوير', accent: 'border-r-amber-500' },
        kudos: { icon: Heart, color: 'bg-red-50 text-red-700 border-red-200', label: 'بطاقة شكر', accent: 'border-r-red-500' },
        birthday: { icon: PartyPopper, color: 'bg-pink-100 text-pink-700 border-pink-200', label: 'مناسبة سعيدة', accent: 'border-r-pink-500' },
    };

    const config = typeConfig[post.postType] || typeConfig.system_achievement;
    const Icon = config.icon;
    
    const formattedDate = useMemo(() => {
        const date = toFirestoreDate(post.createdAt);
        if (date && isValid(date)) {
            return formatDistanceToNow(date, { addSuffix: true, locale: ar });
        }
        return 'الآن';
    }, [post.createdAt]);

    return (
        <Card className={cn(
            "rounded-[3.5rem] border-none shadow-xl bg-white transition-all duration-700 group overflow-hidden hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] relative",
            "border-r-[12px]", config.accent
        )}>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <CardHeader className="p-10 pb-6">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-6">
                        <div className="relative">
                            <Avatar className="h-16 w-16 border-4 border-white shadow-2xl group-hover:scale-110 transition-transform duration-700">
                                <AvatarImage src={post.userAvatar} className="object-cover" />
                                <AvatarFallback className="bg-gradient-to-br from-[#FFB000] to-[#FF7A00] text-white font-black text-xl">{post.userName.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-1 -right-1 p-1.5 bg-green-500 rounded-full border-2 border-white shadow-lg" />
                        </div>
                        <div className="text-right space-y-1">
                            <p className="font-black text-[#1e1b4b] text-xl leading-tight tracking-tight group-hover:text-primary transition-colors">{post.userName}</p>
                            <p className="text-[10px] font-black text-slate-400 flex items-center gap-2 uppercase tracking-widest">
                                <Clock className="h-3 w-3 text-[#FF7A00] opacity-40" />
                                {formattedDate}
                            </p>
                        </div>
                    </div>
                    <Badge variant="outline" className={cn("px-6 py-2 rounded-full font-black text-[10px] uppercase tracking-[0.2em] border-2 shadow-sm transition-all group-hover:scale-105", config.color)}>
                        <Icon className="h-3.5 w-3.5 ml-2 animate-bounce-slow" />
                        {config.label}
                    </Badge>
                </div>
            </CardHeader>
            
            <CardContent className="px-12 pb-8">
                <div className="p-10 bg-slate-50/40 rounded-[2.5rem] border-2 border-dashed border-slate-100 shadow-inner group-hover:bg-white group-hover:border-primary/10 transition-all duration-700 relative">
                    <div className="absolute top-4 left-6 opacity-[0.03] text-primary font-black text-7xl select-none">“</div>
                    <p className="text-2xl font-bold text-slate-800 leading-[1.7] whitespace-pre-wrap relative z-10">{post.content}</p>
                    {post.moodIcon && <div className="mt-8 flex items-center gap-4"><span className="text-6xl drop-shadow-xl animate-float">{post.moodIcon}</span><div className="h-1 w-20 bg-slate-900/5 rounded-full" /></div>}
                </div>
            </CardContent>

            <Separator className="mx-12 opacity-40" />

            <CardFooter className="px-12 py-8 flex justify-between items-center bg-white/40">
                <div className="flex items-center gap-5">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleVote}
                        disabled={isVoting || post.postType === 'system_achievement'}
                        className={cn(
                            "rounded-2xl px-8 h-14 font-black gap-4 transition-all duration-500 shadow-sm",
                            hasVoted 
                                ? "bg-[#FF7A00] text-white shadow-2xl shadow-orange-500/40 scale-105" 
                                : "bg-white border-2 border-slate-100 text-slate-400 hover:text-[#FF7A00] hover:border-orange-500/30 hover:bg-orange-500/5"
                        )}
                    >
                        {isVoting ? <Loader2 className="h-5 w-5 animate-spin"/> : <ThumbsUp className={cn("h-6 w-6", hasVoted && "fill-white")} />}
                        <span className="text-xl font-mono tracking-tighter">{post.votesCount || 0}</span>
                    </Button>
                    
                    <button className="flex items-center gap-3 text-slate-300 hover:text-[#FF7A00] transition-colors px-4 py-2 rounded-xl">
                        <MessageCircle className="h-5 w-5" />
                        <span className="text-xs font-black uppercase tracking-widest">Discussion</span>
                    </button>
                </div>
                
                <div className="flex items-center gap-4 bg-gradient-to-l from-orange-50 to-white px-8 py-3 rounded-3xl border-2 border-orange-100 shadow-xl shadow-orange-500/5 group/reward hover:scale-105 transition-transform duration-500">
                    <div className="p-3 bg-orange-100 rounded-2xl group-hover/reward:rotate-12 transition-transform">
                        <Sparkles className="h-5 w-5 text-[#FF7A00] animate-pulse" />
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest leading-none mb-1">XP Bonus</p>
                        <p className="text-2xl font-black text-[#FF7A00] font-mono leading-none tracking-tighter">+{post.pointsAwarded}</p>
                    </div>
                </div>
            </CardFooter>
        </Card>
    );
}
