'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '../ui/button';
import { Bell, Circle } from 'lucide-react';
import { Badge } from '../ui/badge';
import { useFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/context/auth-context';
import { useCollection } from '@/firebase';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

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

export function Notifications() {
  const { firestore } = useFirebase();
  const { user } = useAuth();
  const router = useRouter();

  const notificationsQuery = useMemo(() => {
    if (!firestore || !user?.id) return null;
    // We use user.id which is the Firestore document ID for our internal user management
    return query(
      collection(firestore, 'notifications'),
      where('userId', '==', user.id),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
  }, [firestore, user?.id]);

  const [snapshot, loading] = useCollection(notificationsQuery);

  const notifications = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 w-5 justify-center p-0">{unreadCount > 9 ? '9+' : unreadCount}</Badge>
          )}
          <span className="sr-only">Toggle notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80" dir="rtl">
        <DropdownMenuLabel>الإشعارات</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading && <DropdownMenuItem>جاري تحميل الإشعارات...</DropdownMenuItem>}
        {!loading && notifications.length === 0 && (
          <DropdownMenuItem disabled className="text-center">لا توجد إشعارات جديدة.</DropdownMenuItem>
        )}
        {!loading && notifications.map(notif => (
          <DropdownMenuItem key={notif.id} className="flex items-start gap-2 cursor-pointer p-2" onClick={() => handleNotificationClick(notif)}>
            {!notif.isRead && <Circle className="h-2 w-2 mt-1.5 fill-primary text-primary flex-shrink-0" />}
            <div className={`flex-1 ${notif.isRead ? 'ml-4' : ''}`}>
              <p className="font-semibold">{notif.title}</p>
              <p className="text-xs text-muted-foreground whitespace-normal">{notif.body}</p>
              <p className="text-xs text-muted-foreground mt-1">{formatDate(notif.createdAt)}</p>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

    