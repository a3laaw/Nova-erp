'use client';

import { useMemo } from 'react';
import { useFirebase } from '@/firebase';
import { useInfiniteScroll } from '@/lib/hooks/use-infinite-scroll';
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
  const {
    items: events,
    loading,
    loadingMore,
    hasMore,
    loaderRef
  } = useInfiniteScroll<HistoryEvent>(`clients/${clientId}/history`);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'><History className='text-primary'/> سجل التغييرات</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
            {events.length > 0 && <div className="absolute left-4 top-1 h-full w-0.5 -translate-x-1/2 bg-border rtl:left-auto rtl:right-4"></div>}

            <div className="space-y-8">
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
                    <div className="text-center text-muted-foreground py-8">
                        <p>لا توجد تغييرات مسجلة بعد.</p>
                    </div>
                )}
                {events.map((event) => (
                    <div key={event.id} className="relative flex items-start gap-4">
                        <div className="z-10 flex h-9 w-9 items-center justify-center rounded-full bg-card ring-4 ring-card">
                             <Avatar className="h-8 w-8">
                                <AvatarImage src={event.userAvatar} />
                                <AvatarFallback>{event.userName?.charAt(0) || 'S'}</AvatarFallback>
                            </Avatar>
                        </div>
                        
                        <div className="flex-1 pt-1">
                            <div className="flex justify-between items-center">
                                <p className="font-semibold text-sm text-foreground">{event.userName}</p>
                                <p className="text-xs text-muted-foreground">{formatDate(event.createdAt)}</p>
                            </div>
                            <div className="mt-1">
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.content}</p>
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={loaderRef} className="flex justify-center p-4">
                    {loadingMore && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
                    {!hasMore && events.length > 5 && <p className="text-sm text-muted-foreground">وصلت إلى نهاية السجل</p>}
                </div>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
