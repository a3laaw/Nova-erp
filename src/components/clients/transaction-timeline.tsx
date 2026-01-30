'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'; // Import useRef, useCallback
import { useAuth } from '@/context/auth-context';
import { useFirebase } from '@/firebase';
// Import necessary firestore functions
import { collection, query, orderBy, addDoc, serverTimestamp, writeBatch, doc, getDocs, limit, startAfter, type DocumentSnapshot } from 'firebase/firestore'; 
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Send, History, Loader2 } from 'lucide-react'; // Import Loader2
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

const PAGE_SIZE = 15;

export function TransactionTimeline({ clientId, transactionId, filterType, showInput = false, title, icon, client, transaction }: TransactionTimelineProps) {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [newComment, setNewComment] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  
  // New state for infinite scroll
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = useRef(null);


  const fetchEvents = useCallback(async (loadMore = false) => {
    if (!firestore || !clientId || !transactionId) return;
    
    const currentLoadingState = loadMore ? loadingMore : loading;
    if (currentLoadingState) return;

    if (loadMore) {
        setLoadingMore(true);
    } else {
        setLoading(true);
        setEvents([]);
        setLastVisible(null);
        setHasMore(true);
    }

    try {
        const constraints = [
            orderBy('createdAt', 'desc'),
            limit(PAGE_SIZE)
        ];
        if (loadMore && lastVisible) {
            constraints.push(startAfter(lastVisible));
        }
        
        const timelineQuery = query(collection(firestore, `clients/${clientId}/transactions/${transactionId}/timelineEvents`), ...constraints);
        const snapshot = await getDocs(timelineQuery);

        const newEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimelineEvent));

        setEvents(prev => loadMore ? [...prev, ...newEvents] : newEvents);
        
        const lastDoc = snapshot.docs[snapshot.docs.length - 1];
        setLastVisible(lastDoc || null);

        if (snapshot.docs.length < PAGE_SIZE) {
            setHasMore(false);
        }

    } catch (error) {
        console.error("Error fetching timeline:", error);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في تحميل سجل المتابعة.' });
    } finally {
        setLoading(false);
        setLoadingMore(false);
    }
  }, [firestore, clientId, transactionId, lastVisible, toast]);

  // Initial fetch
  useEffect(() => {
    // Only fetch initially, subsequent fetches are triggered by observer
    if (clientId && transactionId) {
        fetchEvents(false);
    }
  }, [clientId, transactionId]); // Removed fetchEvents from deps

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          fetchEvents(true);
        }
      },
      { threshold: 1.0 }
    );

    const loader = loaderRef.current;
    if (loader) {
      observer.observe(loader);
    }

    return () => {
      if (loader) {
        observer.unobserve(loader);
      }
    };
  }, [hasMore, loadingMore, loading, fetchEvents]);


  const handlePostComment = async () => {
    if (!newComment.trim() || !currentUser || !firestore) return;

    setIsPosting(true);
    const tempId = `temp_${Date.now()}`;
    const optimisticComment: TimelineEvent = {
        id: tempId,
        type: 'comment',
        content: newComment,
        userId: currentUser.id,
        userName: currentUser.fullName,
        userAvatar: currentUser.avatarUrl,
        createdAt: new Date(),
    };
    
    // Optimistic UI update
    setEvents(prev => [optimisticComment, ...prev]);
    setNewComment('');

    try {
      const timelineCollection = collection(firestore, `clients/${clientId}/transactions/${transactionId}/timelineEvents`);
      const historyCollection = collection(firestore, `clients/${clientId}/history`);
      const commentData = {
          type: 'comment' as const,
          content: newComment,
          userId: currentUser.id,
          userName: currentUser.fullName,
          userAvatar: currentUser.avatarUrl,
          createdAt: serverTimestamp(),
      };

      const batch = writeBatch(firestore);
      const newDocRef = doc(timelineCollection);
      batch.set(newDocRef, commentData);
      batch.set(doc(historyCollection), commentData);
      await batch.commit();

      // Replace optimistic comment with real one once saved
      // This is less critical now with real-time updates but good for robustness
      setEvents(prev => prev.map(e => e.id === tempId ? { ...commentData, id: newDocRef.id, createdAt: new Date() } as TimelineEvent : e));
      
      // --- Notification Logic --- (remains the same)
      const recipients = new Set<string>();
      const clientName = client?.nameAr || 'عميل';
      const transactionType = transaction?.transactionType || 'معاملة';
      
      if (currentUser.id) recipients.add(currentUser.id);

      if (transaction?.assignedEngineerId) {
          const assigneeUserId = await findUserIdByEmployeeId(firestore, transaction.assignedEngineerId);
          if (assigneeUserId && assigneeUserId !== currentUser.id) {
              recipients.add(assigneeUserId);
          }
      }

      for (const recipientId of recipients) {
          const isCreator = recipientId === currentUser.id;
          const title = isCreator ? 'تم إرسال تعليقك' : `تعليق جديد من ${currentUser.fullName}`;
          const body = isCreator ? `تم إرسال تعليقك على معاملة العميل ${clientName} بنجاح.` : `أضاف ${currentUser.fullName} تعليقًا على المعاملة "${transactionType}" للعميل ${clientName}.`;
          
          createNotification(firestore, { userId: recipientId, title, body, link: `/dashboard/clients/${clientId}/transactions/${transactionId}` });
      }
      
      // No need for a toast on success, the optimistic update is enough feedback

    } catch (err) {
      // Rollback on error
      setEvents(prev => prev.filter(e => e.id !== tempId));
      setNewComment(optimisticComment.content); // Restore textarea content
      console.error('Failed to post comment:', err);
      toast({ variant: 'destructive', title: 'خطأ', description: 'فشل إرسال التعليق.' });
    } finally {
      setIsPosting(false);
    }
  };

  const filteredEvents = useMemo(() => {
    return events.filter(event => event.type === filterType);
  }, [events, filterType]);

  return (
    <Card className='lg:col-span-3'>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>{icon}{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
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

        <div className="space-y-6">
            {loading && Array.from({length: 3}).map((_, i) => (
                <div key={i} className="flex gap-4">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className='flex-1 space-y-2'>
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-8 w-full" />
                    </div>
                </div>
            ))}
            {!loading && filteredEvents.length === 0 && (
                <div className="text-center text-muted-foreground pt-8">
                  <p>{filterType === 'comment' ? 'لا توجد تعليقات بعد. كن أول من يضيف تعليقاً.' : 'لا توجد أحداث مسجلة في السجل.'}</p>
                </div>
            )}
          {filteredEvents.map((event) => (
            <div key={event.id} className="flex items-start gap-4">
              <Avatar className="h-9 w-9 border">
                <AvatarImage src={event.userAvatar} />
                <AvatarFallback>{event.userName?.charAt(0)}</AvatarFallback>
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

            <div ref={loaderRef} className="flex justify-center p-4">
                {loadingMore && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
                {!hasMore && filteredEvents.length > 0 && <p className="text-sm text-muted-foreground">وصلت إلى نهاية السجل</p>}
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
