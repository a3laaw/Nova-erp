'use client';

import { useMemo } from 'react';
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
import { doc, updateDoc } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import Link from 'next/link';
import type { Notification } from '@/lib/types';
import { useNotifications } from '@/hooks/use-notifications'; // Use the new hook

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
  const { notifications, loading } = useNotifications();
  const { firestore } = useFirebase();

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.isRead).length;
  }, [notifications]);

  const handleMarkAsRead = (notificationId: string) => {
    if (!firestore || !notificationId) return;

    const notifRef = doc(firestore, 'notifications', notificationId);
    // This is a "fire-and-forget" operation, we don't await it
    // to avoid blocking navigation.
    updateDoc(notifRef, { isRead: true }).catch(error => {
      console.error("Failed to mark notification as read:", error);
    });
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
        <DropdownMenuLabel>
          <Link href="/dashboard/notifications" className="hover:underline">
            الإشعارات
          </Link>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading && <DropdownMenuItem>جاري تحميل الإشعارات...</DropdownMenuItem>}
        {!loading && notifications.length === 0 && (
          <DropdownMenuItem disabled className="text-center">لا توجد إشعارات جديدة.</DropdownMenuItem>
        )}
        {!loading && notifications.slice(0, 10).map(notif => ( // slice to show only latest
          <DropdownMenuItem key={notif.id} className="p-0" asChild>
             <Link
              href={notif.link || '#'}
              className="flex items-start gap-2 cursor-pointer p-2 w-full h-full"
              onClick={() => {
                if (!notif.isRead && notif.id) {
                    handleMarkAsRead(notif.id);
                }
              }}
            >
                {!notif.isRead && <Circle className="h-2 w-2 mt-1.5 fill-primary text-primary flex-shrink-0" />}
                <div className={`flex-1 ${notif.isRead ? 'ml-4' : ''}`}>
                <p className="font-semibold">{notif.title}</p>
                <p className="text-xs text-muted-foreground whitespace-normal">{notif.body}</p>
                <p className="text-xs text-muted-foreground mt-1">{formatDate(notif.createdAt)}</p>
                </div>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
