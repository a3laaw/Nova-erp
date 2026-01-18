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
import { Check, X, FileWarning } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { useFirebase, useCollection, useAuth } from '@/firebase';
import { collection, query, where, orderBy, doc, updateDoc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { Notification } from '@/lib/types';
import { mockNotifications } from '@/lib/data';

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
        if (loading || !snapshot) {
          return [];
        }
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
        data.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        return data;
    }, [snapshot, loading]);
    
    const handleMarkAsRead = async (notificationId: string) => {
        // This check is important because we don't have IDs for mock data to update.
        if (!firestore || !notificationId) return;
        const notifRef = doc(firestore, 'notifications', notificationId);
        try {
            await updateDoc(notifRef, { isRead: true });
            toast({ title: 'نجاح', description: 'تم تحديد الإشعار كمقروء.' });
        } catch (err) {
            console.error(err);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تحديث الإشعار.' });
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
            عرض {notifications.length} من {notifications.length} نتيجة
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>العنوان</TableHead>
                <TableHead>التفاصيل</TableHead>
                <TableHead>تاريخ التنبيه</TableHead>
                <TableHead className="text-center">مقروء</TableHead>
                <TableHead className="text-center">الإجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && Array.from({length: 3}).map((_, i) => (
                  <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-5" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-5 mx-auto rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8 mx-auto" /></TableCell>
                  </TableRow>
              ))}
              {!loading && error && (
                  <TableRow>
                      <TableCell colSpan={6} className="text-center h-24 text-destructive">فشل تحميل التنبيهات.</TableCell>
                  </TableRow>
              )}
               {!loading && notifications.length === 0 && (
                  <TableRow>
                      <TableCell colSpan={6} className="text-center h-24">لا توجد تنبيهات لعرضها.</TableCell>
                  </TableRow>
              )}
              {!loading && notifications.map((alert, index) => {
                  const {date, time} = formatDate(alert.createdAt);
                  return (
                    <TableRow key={alert.id} className={!alert.isRead ? 'bg-primary/5' : ''}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">{alert.title}</TableCell>
                      <TableCell>{alert.body}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                            <span>{date}</span>
                            <span className="text-xs text-muted-foreground">{time}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {alert.isRead ? <Check className="h-5 w-5 text-green-500 mx-auto" /> : <X className="h-5 w-5 text-red-500 mx-auto" />}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="icon" onClick={() => handleNotificationClick(alert)}>
                            <FileWarning className="h-5 w-5 text-primary mx-auto" />
                        </Button>
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
