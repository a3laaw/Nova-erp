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
import { Bell, Circle, Loader2, Sparkles } from 'lucide-react';
import { Badge } from '../ui/badge';
import { useFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import Link from 'next/link';
import { useNotifications } from '@/hooks/use-notifications';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

const formatDate = (dateValue: any) => {
    if (!dateValue) return '';
    try {
        const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
        return formatDistanceToNow(date, { addSuffix: true, locale: ar });
    } catch (e) {
        return '';
    }
};

/**
 * رادار الجرس المركزي (Sovereign Header Pulse V91.0):
 * تفعيل التوجيه الفوري والتحديث اللحظي لحالة القراءة.
 */
export function Notifications() {
  const { notifications, loading } = useNotifications();
  const { firestore } = useFirebase();
  const router = useRouter();

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.isRead).length;
  }, [notifications]);

  const handleNotificationClick = (notification: any) => {
    if (!firestore || !notification.id) return;
    
    // 1. تحديث حالة القراءة في الخلفية
    if (!notification.isRead) {
        const notifRef = doc(firestore, 'notifications', notification.id);
        updateDoc(notifRef, { isRead: true }).catch(error => {
          console.error("Failed to mark notification as read:", error);
        });
    }

    // 2. التوجيه المباشر للرابط المرفق
    if (notification.link) {
        router.push(notification.link);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full text-foreground hover:bg-primary/10 hover:text-primary transition-all group">
          <Bell className="h-5 w-5 group-hover:animate-swing" />
          {unreadCount > 0 && (
            <Badge className="absolute top-0.5 right-0.5 h-4 w-4 justify-center p-0 bg-red-600 text-white border-2 border-white text-[8px] font-black animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
          <span className="sr-only">Toggle notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 rounded-[2.2rem] p-2 shadow-2xl bg-white border-none mt-2" dir="rtl">
        <DropdownMenuLabel className="font-black text-[#1e1b4b] p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>نبض التنبيهات</span>
          </div>
          <Link href="/dashboard/notifications" className="text-[10px] font-bold text-primary hover:underline bg-primary/5 px-3 py-1 rounded-full">
            إدارة الكل
          </Link>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-slate-100 mx-2" />
        <div className="max-h-[400px] overflow-y-auto scrollbar-none p-1">
            {loading && <div className="p-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>}
            {!loading && notifications.length === 0 && (
            <div className="p-10 text-center text-xs font-bold text-muted-foreground italic opacity-40">الصندوق نظيف.. لا توجد إشعارات.</div>
            )}
            {!loading && notifications.slice(0, 15).map(notif => (
            <DropdownMenuItem 
              key={notif.id} 
              className="p-0 mb-1 rounded-2xl overflow-hidden focus:bg-transparent" 
              onClick={() => handleNotificationClick(notif)}
            >
                <div className={cn(
                    "flex items-start gap-3 cursor-pointer p-4 transition-all w-full h-full",
                    notif.isRead ? "opacity-60" : "bg-primary/5 border-r-4 border-primary shadow-sm"
                )}>
                    {!notif.isRead && <Circle className="h-2 w-2 mt-2 fill-primary text-primary flex-shrink-0" />}
                    <div className={cn("flex-1 space-y-1", notif.isRead && "mr-5")}>
                        <p className="font-black text-sm text-[#1e1b4b] leading-tight">{notif.title}</p>
                        <p className="text-[11px] font-bold text-slate-500 line-clamp-2 leading-relaxed">{notif.body}</p>
                        <p className="text-[9px] font-black text-slate-400 mt-2 flex items-center gap-1 uppercase tracking-tighter">
                            <span className="h-1 w-1 rounded-full bg-slate-300" />
                            {formatDate(notif.createdAt)}
                        </p>
                    </div>
                </div>
            </DropdownMenuItem>
            ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
