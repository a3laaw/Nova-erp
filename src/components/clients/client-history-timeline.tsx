'use client';

import { useMemo, useState, useEffect, useRef, useCallback } from 'react'; // Added hooks
import { useFirebase } from '@/firebase';
// Import necessary firestore functions
import { collection, query, orderBy, limit, startAfter, getDocs, type DocumentSnapshot } from 'firebase/firestore'; 
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { History, Loader2 } from 'lucide-react'; // Added Loader2
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

interface HistoryEvent {
  id: string;
  type: 'comment' | 'log';
  content: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  createdAt: any;
}

interface ClientHistoryTimelineProps {
  clientId: string;
}

const formatDate = (dateValue: any): string => {
    if (!dateValue) return '';
    const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
    if (isNaN(date.getTime())) return '';
    return formatDistanceToNow(date, { addSuffix: true, locale: ar });
}

const PAGE_SIZE = 20;

export function ClientHistoryTimeline({ clientId }: ClientHistoryTimelineProps) {
  const { firestore } = useFirebase();

  // State for infinite scroll
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = useRef(null);

  const fetchEvents = useCallback(async (loadMore = false) => {
    if (!firestore || !clientId) return;

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
        
        const historyQuery = query(collection(firestore, `clients/${clientId}/history`), ...constraints);
        const snapshot = await getDocs(historyQuery);

        const newEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HistoryEvent));

        setEvents(prev => loadMore ? [...prev, ...newEvents] : newEvents);
        
        const lastDoc = snapshot.docs[snapshot.docs.length - 1];
        setLastVisible(lastDoc || null);

        if (snapshot.docs.length < PAGE_SIZE) {
            setHasMore(false);
        }

    } catch (error) {
        console.error("Error fetching client history:", error);
    } finally {
        setLoading(false);
        setLoadingMore(false);
    }
  }, [firestore, clientId, lastVisible]);
  
  // Initial fetch
  useEffect(() => {
    fetchEvents(false);
  }, [clientId, fetchEvents]);

  // Intersection Observer
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
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'><History className='text-primary'/> سجل التغييرات على ملف العميل</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
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
            {!loading && events.length === 0 && (
                <div className="text-center text-muted-foreground pt-8">
                    <p>لا توجد تغييرات مسجلة على هذا الملف بعد.</p>
                </div>
            )}
          {events.map((event) => (
            <div key={event.id} className="flex items-start gap-4">
              <Avatar className="h-9 w-9 border">
                <AvatarImage src={event.userAvatar} />
                <AvatarFallback>{event.userName?.charAt(0) || 'S'}</AvatarFallback>
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
                {!hasMore && events.length > 0 && <p className="text-sm text-muted-foreground">وصلت إلى نهاية السجل</p>}
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
