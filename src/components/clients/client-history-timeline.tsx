'use client';

import { useMemo } from 'react';
import { useFirebase, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { History } from 'lucide-react';
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

  const historyQuery = useMemo(() => {
    if (!firestore || !clientId) return null;
    return query(collection(firestore, `clients/${clientId}/history`), orderBy('createdAt', 'desc'));
  }, [firestore, clientId]);

  const [historySnapshot, loading, error] = useCollection(historyQuery);

  const historyEvents = useMemo(() => {
    if (!historySnapshot) return [];
    return historySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HistoryEvent));
  }, [historySnapshot]);

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
             {!loading && error && (
                <p className="text-center text-destructive">فشل تحميل سجل التغييرات.</p>
            )}
            {!loading && historyEvents.length === 0 && (
                <div className="text-center text-muted-foreground pt-8">
                    <p>لا توجد تغييرات مسجلة على هذا الملف بعد.</p>
                </div>
            )}
          {historyEvents.map((event) => (
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
        </div>
      </CardContent>
    </Card>
  );
}
