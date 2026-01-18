'use client';

import { useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BellRing, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { useFirebase, useCollection, useAuth } from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { Notification } from '@/lib/types';
import { cn } from '@/lib/utils';

const formatDate = (dateValue: any) => {
    if (!dateValue) return { date: '-', time: '-'};
    try {
        const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
        return {
            date: format(date, 'yyyy-MM-dd'),
            time: format(date, 'HH:mm:ss')
        };
    } catch (e) {
        return { date: '-', time: '-'};
    }
};


export default function SystemAlertsPage() {
    const { firestore } = useFirebase();
    const { user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const notificationsQuery = useMemo(() => {
        if (!firestore || !user?.id) return null;
        return query(
            collection(firestore, 'notifications'),
            where('userId', '==', user.id)
        );
    }, [firestore, user?.id]);

    const [snapshot, loading, error] = useCollection(notificationsQuery);

    const notifications = useMemo(() => {
        if (!snapshot) return [];

        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));

        // Sort client-side: unread first, then by date descending.
        data.sort((a, b) => {
            if (a.isRead !== b.isRead) {
                return a.isRead ? 1 : -1;
            }
            const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
            const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
            return timeB - timeA;
        });

        return data;
    }, [snapshot]);
    
    const handleMarkAsRead = async (notificationId: string) => {
        if (!firestore || !notificationId) return;
        
        const notifRef = doc(firestore, 'notifications', notificationId);
        try {
            await updateDoc(notifRef, { isRead: true });
        } catch (err) {
            console.error(err);
            // Don't show toast here to not distract from navigation
        }
    };
    
    const handleNotificationClick = (notification: Notification) => {
        if (!notification.isRead && notification.id) {
            handleMarkAsRead(notification.id);
        }
        if (notification.link) {
            router.push(notification.link);
        }
    };


  return (
    <Card dir="rtl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>تنبيهات النظام</CardTitle>
            <CardDescription>
              عرض جميع التنبيهات والمهام المتعلقة بالمعاملات.
            </CardDescription>
          </div>
          <div className="text-sm text-muted-foreground">
            {loading ? 'جاري التحميل...' : `عرض ${notifications.length} تنبيه`}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[65%]">التنبيه</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead className="text-center">الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && Array.from({length: 5}).map((_, i) => (
                  <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-16 mx-auto rounded-full" /></TableCell>
                  </TableRow>
              ))}
              {!loading && error && (
                  <TableRow>
                      <TableCell colSpan={3} className="text-center h-24 text-destructive">فشل تحميل التنبيهات.</TableCell>
                  </TableRow>
              )}
               {!loading && notifications.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={3} className="h-48 text-center text-muted-foreground">
                            <div className="flex flex-col items-center gap-4">
                                <BellRing className="h-16 w-16" />
                                <h3 className="text-xl font-semibold">صندوق الوارد نظيف</h3>
                                <p>لا توجد تنبيهات جديدة في الوقت الحالي.</p>
                            </div>
                        </TableCell>
                    </TableRow>
              )}
              {!loading && notifications.map((alert) => {
                  const {date, time} = formatDate(alert.createdAt);
                  return (
                    <TableRow 
                        key={alert.id} 
                        className={cn("cursor-pointer", !alert.isRead && 'bg-primary/5 font-semibold')}
                        onClick={() => handleNotificationClick(alert)}
                    >
                      <TableCell>
                        <p>{alert.title}</p>
                        <p className={cn("text-sm", !alert.isRead ? "text-foreground/80" : "text-muted-foreground")}>{alert.body}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                            <span>{date}</span>
                            <span className="text-xs text-muted-foreground">{time}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={alert.isRead ? "secondary" : "default"}>
                            {alert.isRead ? "مقروء" : "جديد"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
