'use client';

import { useMemo, useState } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { orderBy, limit, doc, updateDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import type { HubPost, PointsLedgerEntry } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
    Heart, 
    Lightbulb, 
    PartyPopper, 
    Target, 
    MessageCircle, 
    CheckCircle2,
    Calendar,
    ThumbsUp,
    Share2,
    Loader2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { useAuth } from '@/context/auth-context';
import { cn, getTenantPath } from '@/lib/utils';

export function InteractionsFeed() {
    const { firestore } = useFirebase();
    const { user } = useAuth();
    
    const { data: posts, loading } = useSubscription<HubPost>(
        firestore, 
        'hub_posts', 
        [orderBy('createdAt', 'desc'), limit(30)]
    );

    if (loading) return <div className="space-y-6"><Skeleton className="h-48 w-full rounded-[2.5rem]" /><Skeleton className="h-48 w-full rounded-[2.5rem]" /></div>;

    return (
        <div className="space-y-6">
            {posts.length === 0 ? (
                <div className="h-96 flex flex-col items-center justify-center opacity-20 grayscale">
                    <PartyPopper className="h-24 w-24 mb-4" />
                    <p className="text-2xl font-black">الحائط بانتظار إبداعاتكم</p>
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
        system_achievement: { icon: CheckCircle2, color: 'bg-green-100 text-green-700', label: 'إنجاز نظام' },
        employee_idea: { icon: Lightbulb, color: 'bg-amber-100 text-amber-700', label: 'فكرة تطوير' },
        kudos: { icon: Heart, color: 'bg-red-100 text-red-700', label: 'بطاقة شكر' },
        birthday: { icon: PartyPopper, color: 'bg-pink-100 text-pink-700', label: 'مناسبة سعيدة' },
    };

    const config = typeConfig[post.postType] || typeConfig.system_achievement;
    const Icon = config.icon;

    return (
        <Card className="rounded-[2.5rem] border-none shadow-lg bg-white/80 hover:shadow-xl transition-all group overflow-hidden">
            <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12 border-2 border-white shadow-md">
                            <AvatarImage src={post.userAvatar} />
                            <AvatarFallback className="bg-primary/10 text-primary font-black">{post.userName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="text-right">
                            <p className="font-black text-[#1e1b4b]">{post.userName}</p>
                            <p className="text-[9px] font-bold text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-2 w-2" />
                                {formatDistanceToNow(toFirestoreDate(post.createdAt)!, { addSuffix: true, locale: ar })}
                            </p>
                        </div>
                    </div>
                    <Badge variant="outline" className={cn("px-4 py-1 rounded-full font-black text-[9px] uppercase tracking-widest", config.color)}>
                        <Icon className="h-3 w-3 ml-2" />
                        {config.label}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="px-8 pb-6">
                <div className="p-6 bg-muted/20 rounded-[2rem] border-2 border-dashed border-primary/5 shadow-inner">
                    <p className="text-lg font-bold text-slate-800 leading-loose whitespace-pre-wrap">{post.content}</p>
                    {post.moodIcon && <span className="text-4xl block mt-4">{post.moodIcon}</span>}
                </div>
            </CardContent>
            <CardFooter className="px-8 pb-8 pt-0 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleVote}
                        disabled={isVoting || post.postType === 'system_achievement'}
                        className={cn(
                            "rounded-full px-5 h-10 font-black gap-2 transition-all",
                            hasVoted ? "bg-primary text-white shadow-lg" : "bg-primary/5 text-primary hover:bg-primary/10"
                        )}
                    >
                        {isVoting ? <Loader2 className="h-4 w-4 animate-spin"/> : <ThumbsUp className={cn("h-4 w-4", hasVoted && "fill-white")} />}
                        {post.votesCount || 0}
                    </Button>
                    <Badge variant="outline" className="h-10 rounded-full px-4 border-2 font-black text-xs text-muted-foreground bg-white">
                        <MessageCircle className="h-4 w-4 ml-2" /> 0 تعليقات
                    </Badge>
                </div>
                
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-primary/5 rounded-xl">
                        <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                    </div>
                    <span className="text-[10px] font-black text-primary uppercase tracking-widest">+{post.pointsAwarded} نقطة</span>
                </div>
            </CardFooter>
        </Card>
    );
}

import { Skeleton } from '../ui/skeleton';
