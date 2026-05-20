'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { useFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'; 
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow, isValid } from 'date-fns';
import { ar } from 'date-fns/locale';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';
import { useInfiniteScroll } from '@/lib/hooks/use-infinite-scroll';
import { cn, getTenantPath } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

interface TimelineEvent {
  id: string;
  type: 'comment' | 'log';
  content: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  createdAt: any;
}

interface TransactionTimelineProps {
  clientId: string;
  transactionId: string;
  filterType: 'comment' | 'log';
  showInput?: boolean;
  title: string;
  icon: React.ReactNode;
  client: any;
  transaction: any;
}

const formatDate = (dateValue: any): string => {
    if (!dateValue) return '';
    const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
    if (!isValid(date)) return '';
    return formatDistanceToNow(date, { addSuffix: true, locale: ar });
}

export function TransactionTimeline({ clientId, transactionId, filterType, showInput = false, title, icon, client, transaction }: TransactionTimelineProps) {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [newComment, setNewComment] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  
  const relativePath = `clients/${clientId}/transactions/${transactionId}/timelineEvents`;
  const { 
    items: events, 
    setItems: setEvents, 
    loading, 
    loadingMore, 
    hasMore, 
    loaderRef 
  } = useInfiniteScroll<TimelineEvent>(relativePath);

  const handlePostComment = async () => {
    if (!newComment.trim() || !currentUser || !firestore) return;

    const tenantId = currentUser.currentCompanyId;
    const finalPath = getTenantPath(relativePath, tenantId);

    if (!finalPath) {
        toast({ variant: 'destructive', title: 'خطأ في الجلسة', description: 'يرجى إعادة تسجيل الدخول لتحديد المنشأة.' });
        return;
    }

    setIsPosting(true);
    const tempId = `temp_${Date.now()}`;
    const optimisticComment: TimelineEvent = {
        id: tempId,
        type: 'comment',
        content: newComment,
        userId: currentUser.id,
        userName: currentUser.fullName || currentUser.username,
        userAvatar: currentUser.avatarUrl,
        createdAt: new Date(),
    };
    
    setEvents(prev => [optimisticComment, ...prev]);
    setNewComment('');

    const commentData = {
        type: 'comment' as const,
        content: optimisticComment.content,
        userId: currentUser.id,
        userName: optimisticComment.userName,
        userAvatar: currentUser.avatarUrl || null,
        createdAt: serverTimestamp(),
        companyId: tenantId,
    };

    addDoc(collection(firestore, finalPath), commentData)
        .then(async () => {
            const clientName = client?.nameAr || 'عميل';
            const transactionName = transaction?.transactionType || 'معاملة';
            
            if (transaction?.assignedEngineerId && transaction.assignedEngineerId !== currentUser.employeeId) {
                const assigneeUserId = await findUserIdByEmployeeId(firestore, transaction.assignedEngineerId);
                if (assigneeUserId) {
                    await createNotification(firestore, {
                        userId: assigneeUserId,
                        title: `تعليق جديد من ${currentUser.fullName}`,
                        body: `أضاف زميلك تعليقاً على معاملة "${transactionName}" للعميل ${clientName}.`,
                        link: `/dashboard/clients/${clientId}/transactions/${transactionId}`
                    });
                }
            }
        })
        .catch(async (serverError) => {
            setEvents(prev => prev.filter(e => e.id !== tempId));
            setNewComment(optimisticComment.content);

            const permissionError = new FirestorePermissionError({
                path: finalPath,
                operation: 'create',
                requestResourceData: commentData
            });
            errorEmitter.emit('permission-error', permissionError);
        })
        .finally(() => {
            setIsPosting(false);
        });
  };

  const filteredEvents = useMemo(() => {
    return events.filter(event => event.type === filterType);
  }, [events, filterType]);

  return (
    <Card className='lg:col-span-3 border-none shadow-xl rounded-[2.5rem] bg-white/60 backdrop-blur-xl'>
      <CardHeader className="p-8 border-b">
        <CardTitle className='flex items-center gap-3 text-xl font-black text-[#1e1b4b]'>
            <div className="p-2 bg-primary/10 rounded-xl text-primary">{icon}</div>
            {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8 space-y-8">
        {showInput && currentUser && (
          <div className="flex items-start gap-4 p-8 bg-white rounded-[2.5rem] border-2 border-dashed border-primary/20 shadow-inner group focus-within:border-primary transition-all">
            <Avatar className="h-14 w-14 border-2 border-white shadow-md">
              <AvatarImage src={currentUser?.avatarUrl} className="object-cover" />
              <AvatarFallback className="bg-primary/10 text-primary font-black">{currentUser?.fullName?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-4">
              <Textarea
                placeholder="اكتب ملاحظاتك الميدانية أو ردك هنا..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={4}
                className="border-none shadow-none focus-visible:ring-0 text-xl leading-relaxed font-black placeholder:italic bg-transparent p-4 text-slate-900 min-h-[140px]"
              />
              <div className="flex justify-end">
                <Button 
                    onClick={handlePostComment} 
                    disabled={isPosting || !newComment.trim()}
                    className="rounded-2xl h-12 px-10 font-black gap-2 shadow-lg shadow-primary/20"
                >
                  {isPosting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5 rotate-180" />}
                  {isPosting ? 'جاري الإرسال...' : 'نشر التعليق الآن'}
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
            {loading && Array.from({length: 2}).map((_, i) => (
                <div key={i} className="flex gap-4 p-4 animate-pulse">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className='flex-1 space-y-2'>
                        <Skeleton className="h-4 w-1/4 rounded-lg" />
                        <Skeleton className="h-16 w-full rounded-2xl" />
                    </div>
                </div>
            ))}
            
            {!loading && filteredEvents.length === 0 && (
                <div className="text-center text-muted-foreground py-20 opacity-30 italic font-black">
                  <p>{filterType === 'comment' ? 'لا توجد تعليقات بعد. كن أول من يضيف لمسة في مسار العمل.' : 'لا توجد أحداث مسجلة في السجل التاريخي.'}</p>
                </div>
            )}

            {filteredEvents.map((event) => (
                <div key={event.id} className="flex items-start gap-4 animate-in fade-in duration-500">
                    <Avatar className="h-10 w-10 border shadow-sm">
                        <AvatarImage src={event.userAvatar} className="object-cover" />
                        <AvatarFallback className="font-bold bg-muted text-muted-foreground">{event.userName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className={cn(
                        "flex-1 p-6 rounded-[2rem] border shadow-sm",
                        event.type === 'log' ? "bg-muted/30 border-muted" : "bg-white border-slate-100"
                    )}>
                        <div className="flex justify-between items-center mb-3">
                            <p className="font-black text-sm text-[#1e1b4b]">{event.userName}</p>
                            <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                <span className="h-1 w-1 rounded-full bg-slate-300" />
                                {formatDate(event.createdAt)}
                            </p>
                        </div>
                        <p className="text-lg font-bold text-slate-800 leading-relaxed whitespace-pre-wrap">{event.content}</p>
                    </div>
                </div>
            ))}

            <div ref={loaderRef} className="flex justify-center p-4">
                {loadingMore && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
            </div>
        </div>
      </CardContent>
    </Card>
  );
}