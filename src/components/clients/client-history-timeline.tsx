'use client';

import { useMemo } from 'react';
import { useFirebase } from '@/firebase';
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { History, Loader2 } from 'lucide-react';
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

export function ClientHistoryTimeline({ clientId }: ClientHistoryTimelineProps) {
  const { firestore } = useFirebase();

  const {
    items: events,
    loading,
    loadingMore,
    hasMore,
    loaderRef
  } = useInfiniteScroll<HistoryEvent>(firestore, `clients/${clientId}/history`);
  
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
