
'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useFirebase } from '@/firebase';
import { collectionGroup, query, orderBy, limit, getDocs, onSnapshot } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Skeleton } from '../ui/skeleton';
import { History, MessageSquare, AlertCircle } from 'lucide-react';

interface ActivityEvent {
  id: string;
  type: 'comment' | 'log';
  content: string;
  userName: string;
  userAvatar?: string;
  createdAt: any;
  transactionName?: string;
}

/**
 * مكون النشاط الأخير: يجلب آخر الأحداث والتعليقات من كافة أنحاء النظام (Global Timeline).
 */
export function RecentActivity() {
  const { firestore } = useFirebase();
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firestore) return;

    // استخدام collectionGroup لجلب الأحداث من كافة المعاملات والمشاريع
    const q = query(
      collectionGroup(firestore, 'timelineEvents'),
      orderBy('createdAt', 'desc'),
      limit(8)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as ActivityEvent));
      setActivities(items);
      setLoading(false);
    }, (error) => {
      console.error("Global Timeline Error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [firestore]);

  const formatDate = (dateValue: any) => {
    if (!dateValue) return '';
    const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
    try {
      return formatDistanceToNow(date, { addSuffix: true, locale: ar });
    } catch {
      return '';
    }
  };

  return (
    <Card className="h-full border-none shadow-sm rounded-3xl overflow-hidden">
      <CardHeader className="bg-muted/10 border-b pb-4">
        <div className="flex items-center gap-2">
            <History className="text-primary h-5 w-5" />
            <CardTitle className="text-lg font-black">آخر النشاطات في النظام</CardTitle>
        </div>
        <CardDescription>متابعة حية لكل ما يتم تسجيله من تعليقات وإجراءات في كافة الأقسام.</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-6">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div className="flex items-center gap-4" key={i}>
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))
          ) : activities.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground italic">لا توجد نشاطات مسجلة حالياً.</div>
          ) : (
            activities.map((activity) => (
              <div className="flex items-start gap-4 group" key={activity.id}>
                <Avatar className="h-10 w-10 border-2 border-background shadow-sm shrink-0">
                  <AvatarImage src={activity.userAvatar} alt="Avatar" />
                  <AvatarFallback className="bg-primary/5 text-primary font-bold">{activity.userName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="grid gap-1 flex-1">
                  <p className="text-sm font-bold leading-tight">
                    {activity.userName}{' '}
                    <span className="text-muted-foreground font-medium">
                        {activity.type === 'comment' ? 'أضاف تعليقاً:' : 'قام بـإجراء:'}
                    </span>
                  </p>
                  <div className="text-xs text-foreground/80 bg-muted/30 p-2 rounded-lg border border-transparent group-hover:border-muted-foreground/10 transition-colors">
                    {activity.content}
                  </div>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
                    <History className="h-2 w-2" />
                    {formatDate(activity.createdAt)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
