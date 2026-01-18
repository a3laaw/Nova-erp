'use client';

import { useMemo, useState } from 'react';
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
import { ArrowRight, Circle, MailOpen } from 'lucide-react';
import { useFirebase, useCollection } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { collection, query, where, writeBatch, doc, updateDoc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

interface Notification {
  id: string;
  title: string;
  body: string;
  link: string;
  isRead: boolean;
  createdAt: any;
  userId: string;
}

const formatDate = (dateValue: any) => {
    if (!dateValue) return '';
    try {
        const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
        return formatDistanceToNow(date, { addSuffix: true, locale: ar });
    } catch (e) {
        return '';
    }
};

export default function NotificationsPage() {
    const { firestore } = useFirebase();
    const { user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [isProcessing, setIsProcessing] = useState(false);

    const notificationsQuery = useMemo(() => {
        if (!firestore || !user?.id) return null;
        // The orderBy is removed to avoid needing a composite index. Sorting is handled client-side.
        return query(
          collection(firestore, 'notifications'),
          where('userId', '==', user.id)
        );
    }, [firestore, user?.id]);

    const [snapshot, loading, error] = useCollection(notificationsQuery);

    const notifications = useMemo(() => {
        if (!snapshot) return [];
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
        // Client-side sorting
        data.sort((a, b) => {
            const timeA = a.createdAt?.toMillis() || 0;
            const timeB = b.createdAt?.toMillis() || 0;
            return timeB - timeA;
        });
        return data;
    }, [snapshot]);
    
    const unreadCount = useMemo(() => {
        return notifications.filter(n => !n.isRead).length;
    }, [notifications]);

    const handleNotificationClick = async (notification: Notification) => {
        if (!firestore) return;

        if (!notification.isRead) {
            const notifRef = doc(firestore, 'notifications', notification.id);
            try {
                await updateDoc(notifRef, { isRead: true });
            } catch (error) {
                console.error("Failed to mark notification as read:", error);
            }
        }
        router.push(notification.link);
    };

    const handleMarkAllAsRead = async () => {
        if (!firestore || unreadCount === 0) return;
        
        setIsProcessing(true);
        try {
            const batch = writeBatch(firestore);
            notifications.forEach(notif => {
                if (!notif.isRead) {
                    const notifRef = doc(firestore, 'notifications', notif.id);
                    batch.update(notifRef, { isRead: true });
                }
            });
            await batch.commit();
            toast({ title: 'نجاح', description: 'تم تحديد جميع الإشعارات كمقروءة.' });
        } catch (err) {
            console.error(err);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تحديث حالة الإشعارات.' });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Card dir="rtl">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>جميع الإشعارات</CardTitle>
                        <CardDescription>
                            سجل بجميع الإشعارات التي تم إرسالها إليك.
                        </CardDescription>
                    </div>
                    <Button onClick={handleMarkAllAsRead} disabled={isProcessing || unreadCount === 0}>
                        <MailOpen className="ml-2 h-4 w-4" />
                        تحديد الكل كمقروء
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[20px]"></TableHead>
                                <TableHead>العنوان</TableHead>
                                <TableHead>الوقت</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading && Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell colSpan={3}><Skeleton className="h-8 w-full" /></TableCell>
                                </TableRow>
                            ))}
                            {error && (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center h-24 text-destructive">فشل تحميل الإشعارات.</TableCell>
                                </TableRow>
                            )}
                            {!loading && notifications.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center h-24">لا يوجد إشعارات لعرضها.</TableCell>
                                </TableRow>
                            )}
                            {!loading && notifications.map(notif => (
                                <TableRow 
                                    key={notif.id} 
                                    onClick={() => handleNotificationClick(notif)}
                                    className={`cursor-pointer ${!notif.isRead ? 'font-bold' : ''}`}
                                >
                                    <TableCell>
                                        {!notif.isRead && <Circle className="h-2 w-2 fill-primary text-primary" />}
                                    </TableCell>
                                    <TableCell>
                                        <p>{notif.title}</p>
                                        <p className={`text-xs ${!notif.isRead ? 'text-foreground' : 'text-muted-foreground'} font-normal`}>
                                            {notif.body}
                                        </p>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-xs font-normal">
                                        {formatDate(notif.createdAt)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
