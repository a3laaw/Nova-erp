'use client';

import { useMemo, useState } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { orderBy, limit, doc, updateDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import type { HubPost } from '@/lib/types';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
    Heart, 
    Lightbulb, 
    PartyPopper, 
    MessageCircle, 
    CheckCircle2,
    Calendar,
    ThumbsUp,
    Loader2,
    Sparkles,
    Activity
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { useAuth } from '@/context/auth-context';
import { cn, getTenantPath, formatCurrency } from '@/lib/utils';
import { Skeleton } from '../ui/skeleton';

export function InteractionsFeed() {
    const { firestore } = useFirebase();
    const { user } = useAuth();
    
    const { data: posts, loading } = useSubscription<HubPost>(
        firestore, 
        user?.currentCompanyId ? 'hub_posts' : null, 
        [orderBy('createdAt', 'desc'), limit(30)]
    );

    if (loading) return (
        <div className="space-y-6">
            <Skeleton className="h-64 w-full rounded-[2.8rem]" />
            <Skeleton className="h-64 w-full rounded-[2.8rem]" />
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {posts.length === 0 ? (
                <div className="h-96 flex flex-col items-center justify-center opacity-30 grayscale rounded-[3rem] border-4 border-dashed bg-white/40">
                    <div className="p-8 bg-muted rounded-full mb-6">
                        <Activity className="h-16 w-16 text-muted-foreground" />
                    </div>
                    <p className="text-2xl font-black text-[#1e1b4b]">الحائط بانتظار إنجازاتكم</p>
                    <p className="text-sm font-bold mt-2 text-slate-500">سيتم عرض التفاعلات وأخبار الشركة هنا فور حدوثها.</p>
                </div>
            ) : (
                posts.map(post => <PostCard key={post.id} post={post} />)
            )}
        </div>
    );
}

function PostCard({ post }: { post: HubPost }) {
    const { firestore } = useFirebase();
    const { user } = useAuth();
    const [isVoting, setIsUpdating] = useState(false);

    const hasVoted = useMemo(() => post.voters?.includes(user?.id || ''), [post.voters, user?.id]);

    const handleVote = async () => {
        if (!firestore || !user?.id || isVoting) return;
        setIsUpdating(true);
        try {
            const postPath = getTenantPath(`hub_posts/${post.id}`, user.currentCompanyId);
            const postRef = doc(firestore, postPath);
            
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
        system_achievement: { icon: CheckCircle2, color: 'bg-green-100 text-green-700 border-green-200', label: 'إنجاز نظام' },
        employee_idea: { icon: Lightbulb, color: 'bg-amber-100 text-amber-700 border-amber-200', label: 'فكرة تطوير' },
        kudos: { icon: Heart, color: 'bg-red-100 text-red-700 border-red-200', label: 'بطاقة شكر' },
        birthday: { icon: PartyPopper, color: 'bg-pink-100 text-pink-700 border-pink-200', label: 'مناسبة سعيدة' },
    };

    const config = typeConfig[post.postType] || typeConfig.system_achievement;
    const Icon = config.icon;

    return (
        <Card className="rounded-[2.8rem] border-none shadow-xl bg-white transition-all group overflow-hidden hover:-translate-y-1 hover:shadow-2xl">
            <CardHeader className="p-8 pb-4">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-5">
                        <Avatar className="h-14 w-14 border-4 border-white shadow-xl group-hover:scale-105 transition-transform">
                            <AvatarImage src={post.userAvatar} />
                            <AvatarFallback className="bg-primary/10 text-primary font-black text-lg">{post.userName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="text-right">
                            <p className="font-black text-[#1e1b4b] text-lg leading-tight">{post.userName}</p>
                            <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1 mt-1">
                                <Calendar className="h-3 w-3" />
                                {formatDistanceToNow(toFirestoreDate(post.createdAt)!, { addSuffix: true, locale: ar })}
                            </p>
                        </div>
                    </div>
                    <Badge variant="outline" className={cn("px-5 py-1.5 rounded-full font-black text-[10px] uppercase tracking-widest border-2", config.color)}>
                        <Icon className="h-3.5 w-3.5 ml-2" />
                        {config.label}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="px-10 pb-6">
                <div className="p-8 bg-slate-50/50 rounded-[2.2rem] border-2 border-dashed border-slate-100 shadow-inner group-hover:bg-white transition-colors duration-500">
                    <p className="text-xl font-bold text-slate-800 leading-[1.8] whitespace-pre-wrap">{post.content}</p>
                    {post.moodIcon && <span className="text-5xl block mt-6 drop-shadow-md">{post.moodIcon}</span>}
                </div>
            </CardContent>
            <CardFooter className="px-10 pb-8 pt-0 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleVote}
                        disabled={isVoting || post.postType === 'system_achievement'}
                        className={cn(
                            "rounded-2xl px-6 h-12 font-black gap-3 transition-all",
                            hasVoted 
                                ? "bg-primary text-white shadow-xl shadow-primary/20 scale-105" 
                                : "bg-primary/5 text-primary hover:bg-primary/10 border-2 border-transparent"
                        )}
                    >
                        {isVoting ? <Loader2 className="h-5 w-5 animate-spin"/> : <ThumbsUp className={cn("h-5 w-5", hasVoted && "fill-white")} />}
                        <span className="text-lg font-mono">{post.votesCount || 0}</span>
                    </Button>
                    
                    <Badge variant="outline" className="h-12 rounded-2xl px-5 border-2 font-black text-xs text-slate-400 bg-white shadow-sm flex items-center gap-2">
                        <MessageCircle className="h-4 w-4" /> 0 تعليقات
                    </Badge>
                </div>
                
                <div className="flex items-center gap-3 bg-gradient-to-l from-orange-50 to-white px-6 py-2.5 rounded-2xl border-2 border-orange-100 shadow-sm">
                    <div className="p-2 bg-orange-100 rounded-xl">
                        <Sparkles className="h-4 w-4 text-[#FF7A00] animate-pulse" />
                    </div>
                    <div className="text-right">
                        <p className="text-[9px] font-black text-orange-600 uppercase tracking-widest leading-none mb-1">المكافأة</p>
                        <p className="text-xl font-black text-[#FF7A00] font-mono leading-none">+{post.pointsAwarded}</p>
                    </div>
                </div>
            </CardFooter>
        </Card>
    );
}
