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
import { Badge } from '@/components/ui/badge';
import { BellRing, CheckCircle2, Loader2, Sparkles, Activity, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useFirebase } from '@/firebase';
import { doc, updateDoc, deleteDoc, writeBatch, collection, query, where, getDocs } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import type { Notification } from '@/lib/types';
import { cn, getTenantPath } from '@/lib/utils';
import { useNotifications } from '@/hooks/use-notifications';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { toFirestoreDate } from '@/services/date-converter';
import { useToast } from '@/hooks/use-toast';

/**
 * مركز إدارة التنبيهات السيادي:
 * تم تحديثه ليدعم إدارة "المهام التشاركية" وكافة أحداث المعاملات بوضوح تام.
 */
export default function SystemAlertsPage() {
    const { firestore } = useFirebase();
    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const { notifications, loading, error } = useNotifications();

    const [isClearing, setIsClearing] = useState(false);

    const formatDate = (dateValue: any) => {
        const date = toFirestoreDate(dateValue);
        if (!date) return { date: '-', time: '-'};
        return {
            date: format(date, 'dd MMMM yyyy', { locale: ar }),
            time: format(date, 'HH:mm')
        };
    };

    const handleMarkAsRead = async (id: string) => {
        if (!firestore || !id) return;
        try {
            await updateDoc(doc(firestore, 'notifications', id), { isRead: true });
        } catch (err) {}
    };

    const handleClearAll = async () => {
        if (!firestore || !user?.id || !confirm('سيتم حذف كافة الإشعارات المقروءة، هل أنت متأكد؟')) return;
        setIsClearing(true);
        try {
            const batch = writeBatch(firestore);
            const toDelete = notifications.filter(n => n.isRead);
            toDelete.forEach(n => {
                batch.delete(doc(firestore, 'notifications', n.id!));
            });
            await batch.commit();
            toast({ title: 'تم تنظيف الصندوق' });
        } finally { setIsClearing(false); }
    };

    return (
        <div className="space-y-8" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-gradient-to-r from-slate-900 to-indigo-950 text-white relative">
                <div className="absolute top-0 right-0 w-80 h-full bg-white/5 -skew-x-12 transform translate-x-32 pointer-events-none" />
                <CardHeader className="p-10 relative z-10">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                        <div className="flex items-center gap-6">
                            <div className="p-5 bg-white/10 rounded-[2rem] backdrop-blur-xl border border-white/20 shadow-2xl">
                                <BellRing className="h-10 w-10 text-white" />
                            </div>
                            <div className="text-right">
                                <CardTitle className="text-3xl font-black text-white tracking-tighter">رادار التنبيهات المركزي</CardTitle>
                                <div className="flex items-center gap-2 mt-1">
                                    <Sparkles className="h-4 w-4 text-amber-200 animate-pulse" />
                                    <CardDescription className="text-white/80 font-bold text-sm">متابعة كافة الأحداث، المهام التشاركية، وتحديثات المعاملات الفنية.</CardDescription>
                                </div>
                            </div>
                        </div>
                        <Button onClick={handleClearAll} disabled={isClearing || loading} variant="outline" className="h-12 px-8 rounded-2xl font-black bg-white/10 text-white border-white/40 hover:bg-red-500/20 hover:text-red-200 gap-2">
                            {isClearing ? <Loader2 className="animate-spin h-4 w-4"/> : <Trash2 className="h-4 w-4" />}
                            تنظيف المقروء
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <Card className="border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white/95">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-[#F8F9FE] h-14 border-b">
                            <TableRow className="border-none">
                                <TableHead className="px-10 font-black text-[#7209B7]">الإشعار</TableHead>
                                <TableHead className="font-black text-[#7209B7] text-center">توقيت الحدث</TableHead>
                                <TableHead className="font-black text-[#7209B7] text-center">الحالة</TableHead>
                                <TableHead className="w-[100px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({length: 5}).map((_, i) => (
                                    <TableRow key={i}><TableCell colSpan={4} className="p-8"><Skeleton className="h-12 w-full rounded-2xl"/></TableCell></TableRow>
                                ))
                            ) : notifications.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-96 text-center">
                                        <div className="flex flex-col items-center gap-4 opacity-20 grayscale">
                                            <Activity className="h-24 w-24 text-muted-foreground animate-pulse" />
                                            <p className="text-3xl font-black italic">صندوق الوارد فارغ تماماً</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                notifications.map((notif) => {
                                    const {date, time} = formatDate(notif.createdAt);
                                    return (
                                        <TableRow 
                                            key={notif.id} 
                                            className={cn(
                                                "transition-colors h-24 border-b last:border-0 group",
                                                !notif.isRead ? "bg-primary/[0.02]" : "opacity-60"
                                            )}
                                        >
                                            <TableCell className="px-10">
                                                <div className="flex items-center gap-4">
                                                    {!notif.isRead && <div className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse shrink-0" />}
                                                    <div className="space-y-1">
                                                        <p className="font-black text-lg text-[#1e1b4b] leading-tight">{notif.title}</p>
                                                        <p className="text-sm font-bold text-slate-500 leading-relaxed max-w-2xl">{notif.body}</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className="font-bold text-xs text-slate-800">{date}</span>
                                                    <span className="font-mono text-[10px] text-slate-400 mt-1">{time}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={notif.isRead ? "secondary" : "default"} className={cn(
                                                    "px-4 py-1 rounded-full font-black text-[10px] uppercase",
                                                    !notif.isRead ? "bg-primary text-white" : "bg-slate-100 text-slate-400"
                                                )}>
                                                    {notif.isRead ? "مقروء" : "جديد"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center pr-6">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    onClick={() => {
                                                        handleMarkAsRead(notif.id!);
                                                        if (notif.link) router.push(notif.link);
                                                    }}
                                                    className="h-11 w-11 rounded-2xl border-2 border-transparent hover:border-primary/20 hover:bg-white text-primary shadow-sm"
                                                >
                                                    <Eye className="h-5 w-5" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
