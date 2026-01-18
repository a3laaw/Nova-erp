'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { useFirebase, useCollection } from '@/firebase';
import { collection, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Send, History } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';

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
    if (isNaN(date.getTime())) return '';
    return formatDistanceToNow(date, { addSuffix: true, locale: ar });
}

export function TransactionTimeline({ clientId, transactionId, filterType, showInput = false, title, icon, client, transaction }: TransactionTimelineProps) {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [newComment, setNewComment] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  const timelineQuery = useMemo(() => {
    if (!firestore || !clientId || !transactionId) return null;
    return query(collection(firestore, `clients/${clientId}/transactions/${transactionId}/timelineEvents`), orderBy('createdAt', 'desc'));
  }, [firestore, clientId, transactionId]);

  const [timelineSnapshot, loading, error] = useCollection(timelineQuery);

  const timelineEvents = useMemo(() => {
    if (!timelineSnapshot) return [];
    return timelineSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as TimelineEvent))
        .filter(event => event.type === filterType);
  }, [timelineSnapshot, filterType]);

  const handlePostComment = async () => {
    if (!newComment.trim() || !currentUser || !firestore) return;

    setIsPosting(true);
    try {
      const timelineCollection = collection(firestore, `clients/${clientId}/transactions/${transactionId}/timelineEvents`);
      await addDoc(timelineCollection, {
        type: 'comment',
        content: newComment,
        userId: currentUser.id,
        userName: currentUser.fullName,
        userAvatar: currentUser.avatarUrl,
        createdAt: serverTimestamp(),
      });
      

      // --- Notification Logic ---
      const recipients = new Set<string>();
      const clientName = client?.nameAr || 'عميل';
      const transactionType = transaction?.transactionType || 'معاملة';
      
      // 1. Add self for confirmation
      recipients.add(currentUser.id);

      // 2. Add assignee to recipients if they are not the commenter
      if (transaction?.assignedEngineerId) {
          const assigneeUserId = await findUserIdByEmployeeId(firestore, transaction.assignedEngineerId);
          if (assigneeUserId && assigneeUserId !== currentUser.id) {
              recipients.add(assigneeUserId);
          }
      }

      // 3. Send notifications
      for (const recipientId of recipients) {
          const isCreator = recipientId === currentUser.id;
          const title = isCreator 
              ? 'تم إرسال تعليقك' 
              : `تعليق جديد من ${currentUser.fullName}`;
          const body = isCreator
              ? `تم إرسال تعليقك على معاملة العميل ${clientName} بنجاح.`
              : `أضاف ${currentUser.fullName} تعليقًا على المعاملة "${transactionType}" للعميل ${clientName}.`;
          
          createNotification(firestore, {
              userId: recipientId,
              title,
              body,
              link: `/dashboard/clients/${clientId}/transactions/${transactionId}`
          });
      }
      
      setNewComment('');
      toast({ title: 'نجاح', description: 'تم إرسال التعليق بنجاح.' });

    } catch (err) {
      console.error('Failed to post comment:', err);
      toast({ variant: 'destructive', title: 'خطأ', description: 'فشل إرسال التعليق.' });
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <Card className='lg:col-span-3'>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>{icon}{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Comment Input Form */}
        {showInput && currentUser && (
          <div className="flex items-start gap-4">
            <Avatar className="h-9 w-9 border">
              <AvatarImage src={currentUser?.avatarUrl} />
              <AvatarFallback>{currentUser?.fullName?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <Textarea
                placeholder="أكتب تعليقاً أو تحديثاً..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={3}
              />
              <div className="flex justify-end">
                <Button onClick={handlePostComment} disabled={isPosting || !newComment.trim()}>
                  <Send className="ml-2 h-4 w-4" />
                  {isPosting ? 'جاري الإرسال...' : 'إرسال'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Timeline Events */}
        <div className="space-y-6">
            {loading && Array.from({length: 2}).map((_, i) => (
                <div key={i} className="flex gap-4">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className='flex-1 space-y-2'>
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-8 w-full" />
                    </div>
                </div>
            ))}
             {!loading && error && (
                <p className="text-center text-destructive">فشل تحميل السجل.</p>
            )}
            {!loading && timelineEvents.length === 0 && (
                <div className="text-center text-muted-foreground pt-8">
                  <p>{filterType === 'comment' ? 'لا توجد تعليقات بعد. كن أول من يضيف تعليقاً.' : 'لا توجد أحداث مسجلة في السجل.'}</p>
                </div>
            )}
          {timelineEvents.map((event) => (
            <div key={event.id} className="flex items-start gap-4">
              <Avatar className="h-9 w-9 border">
                <AvatarImage src={event.userAvatar} />
                <AvatarFallback>{event.userName.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 rounded-md border bg-muted/50 p-3">
                <div className="flex justify-between items-center mb-1">
                  <p className="font-semibold text-sm">{event.userName}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(event.createdAt)}</p>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{event.content}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
