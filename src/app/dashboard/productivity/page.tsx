
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { orderBy, where } from 'firebase/firestore';
import type { UserProductivityItem } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
    LayoutGrid, 
    ListChecks, 
    Bookmark, 
    Clock, 
    ArrowUpRight, 
    Search,
    CheckCircle2,
    Calendar,
    RotateCcw,
    Sparkles,
    Trash2,
    Loader2
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { useAuth } from '@/context/auth-context';
import { ProductivityService } from '@/services/productivity-service';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

/**
 * منصة الإنتاجية الشخصية (Personal Workspace):
 * تضم كافة المهام والمفضلات المستخلصة من الـ ERP في واجهة كانبان وقائمة مفضلات.
 */
export default function PersonalProductivityPage() {
    const { firestore } = useFirebase();
    const { user } = useAuth();
    const searchParams = useSearchParams();
    
    // محرك التبديل اللحظي بناءً على رادار الملاحة
    const [activeTab, setActiveTab] = useState('tasks');

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'bookmarks') setActiveTab('bookmarks');
        else if (tab === 'tasks') setActiveTab('tasks');
    }, [searchParams]);

    // جلب المهام والمفضلات الخاصة بالمستخدم الحالي فقط (Privacy Protected)
    const productivityQuery = useMemo(() => [
        where('userId', '==', user?.id),
        orderBy('createdAt', 'desc')
    ], [user?.id]);

    const { data: allItems, loading } = useSubscription<UserProductivityItem>(
        firestore, 
        user?.currentCompanyId ? `companies/${user.currentCompanyId}/userProductivity` : null, 
        productivityQuery
    );

    const tasks = useMemo(() => allItems.filter(i => i.entryType === 'task'), [allItems]);
    const bookmarks = useMemo(() => allItems.filter(i => i.entryType === 'bookmark'), [allItems]);

    return (
        <div className="space-y-8" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-gradient-to-l from-white to-orange-50 dark:from-slate-900 dark:to-orange-950/20">
                <CardHeader className="pb-8 px-8 border-b">
                    <div className="flex items-center gap-5">
                        <div className="p-3 bg-orange-600/10 rounded-2xl text-orange-600 shadow-inner">
                            <Sparkles className="h-8 w-8" />
                        </div>
                        <div>
                            <CardTitle className="text-3xl font-black text-foreground tracking-tight">منصة الإنجاز والإنتاجية</CardTitle>
                            <CardDescription className="text-base font-medium">مساحتك الخاصة لمتابعة المهام المستخلصة من المشاريع والوصول السريع للمفضلات.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-white/40 p-1 rounded-2xl border border-white/60 shadow-sm h-14 mb-8">
                    <TabsTrigger value="tasks" className="rounded-xl px-12 font-black gap-2 data-[state=active]:bg-primary data-[state=active]:text-white h-full transition-all">
                        <ListChecks className="h-4 w-4" /> مهامي الشخصية
                    </TabsTrigger>
                    <TabsTrigger value="bookmarks" className="rounded-xl px-12 font-black gap-2 data-[state=active]:bg-primary data-[state=active]:text-white h-full transition-all">
                        <Bookmark className="h-4 w-4" /> مركز المفضلات
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="tasks" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {loading ? (
                            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-3xl" />)
                        ) : tasks.length === 0 ? (
                            <div className="col-span-full h-96 flex flex-col items-center justify-center opacity-20 grayscale">
                                <ListChecks className="h-24 w-24 mb-4" />
                                <p className="text-2xl font-black">لا توجد مهام حالياً</p>
                            </div>
                        ) : (
                            tasks.map(task => <TaskCard key={task.id} task={task} />)
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="bookmarks" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {loading ? (
                            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-3xl" />)
                        ) : bookmarks.length === 0 ? (
                            <div className="col-span-full h-96 flex flex-col items-center justify-center opacity-20 grayscale">
                                <Bookmark className="h-24 w-24 mb-4" />
                                <p className="text-2xl font-black">المفضلة فارغة</p>
                            </div>
                        ) : (
                            bookmarks.map(bm => <BookmarkCard key={bm.id} bookmark={bm} />)
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}

function TaskCard({ task }: { task: UserProductivityItem }) {
    const { firestore } = useFirebase();
    const { user } = useAuth();
    const [isUpdating, setIsUpdating] = useState(false);

    const handleComplete = async () => {
        if (!firestore || !user?.currentCompanyId) return;
        setIsUpdating(true);
        const service = new ProductivityService(firestore, user.currentCompanyId);
        await service.updateTaskStatus(task.id!, 'completed');
        setIsUpdating(false);
    };

    const actionLabels: Record<string, string> = {
        review: 'مراجعة', decision: 'قرار', design: 'تصميم', redesign: 'تعديل', meeting: 'اجتماع', general: 'متابعة'
    };

    const actionColors: Record<string, string> = {
        review: 'bg-blue-100 text-blue-700', decision: 'bg-red-100 text-red-700', design: 'bg-purple-100 text-purple-700', redesign: 'bg-orange-100 text-orange-700'
    };

    return (
        <Card className={cn(
            "rounded-[2rem] border-2 transition-all hover:shadow-xl group",
            task.status === 'completed' ? "bg-green-50/50 border-green-100 grayscale opacity-60" : "bg-white hover:border-primary/20"
        )}>
            <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                    <Badge variant="outline" className={cn("font-black text-[9px] uppercase px-3", actionColors[task.actionType!] || "bg-slate-100")}>
                        {actionLabels[task.actionType!] || 'مهمة'}
                    </Badge>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-slate-400">{task.sourceModule}</span>
                        <Clock className="h-3.5 w-3.5 text-slate-300" />
                    </div>
                </div>
                <CardTitle className="text-lg font-black text-slate-800 leading-tight mt-3">{task.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center gap-4 bg-muted/20 p-3 rounded-xl border border-dashed text-xs">
                    <div className="space-y-0.5">
                        <p className="text-[8px] font-black text-muted-foreground uppercase">موعد التسليم</p>
                        <p className="font-bold">{toFirestoreDate(task.dueDate) ? format(toFirestoreDate(task.dueDate)!, 'dd MMMM', { locale: ar }) : '-'}</p>
                    </div>
                    <Separator orientation="vertical" className="h-6" />
                    <div className="space-y-0.5">
                        <p className="text-[8px] font-black text-muted-foreground uppercase">الحالة</p>
                        <p className="font-black text-primary">{task.status === 'completed' ? 'تم الإنجاز' : 'قيد المتابعة'}</p>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="p-6 bg-muted/10 gap-2">
                <Button asChild variant="ghost" className="rounded-xl h-10 px-4 font-bold text-xs gap-2 group-hover:bg-white transition-all">
                    <Link href={task.sourceUrl || '#'}><ArrowUpRight className="h-4 w-4"/> فتح المصدر</Link>
                </Button>
                {task.status !== 'completed' && (
                    <Button onClick={handleComplete} disabled={isUpdating} className="flex-1 h-10 rounded-xl bg-green-600 hover:bg-green-700 text-white font-black text-xs gap-2">
                        {isUpdating ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle2 className="h-4 w-4"/>}
                        تم الإنجاز
                    </Button>
                )}
            </CardFooter>
        </Card>
    );
}

function BookmarkCard({ bookmark }: { bookmark: UserProductivityItem }) {
    return (
        <Link href={bookmark.sourceUrl || '#'} className="block group">
            <Card className="rounded-[1.8rem] border-2 border-transparent bg-white shadow-sm hover:border-primary/40 hover:shadow-xl transition-all h-full flex flex-col items-center justify-center p-6 text-center">
                <div className="p-3 bg-primary/5 rounded-2xl text-primary mb-3 group-hover:scale-110 transition-transform">
                    <Bookmark className="h-6 w-6" />
                </div>
                <p className="font-black text-xs text-slate-800 line-clamp-2 leading-relaxed">{bookmark.title}</p>
                <div className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Badge variant="outline" className="text-[8px] font-black uppercase text-primary border-primary/20">{bookmark.sourceModule}</Badge>
                </div>
            </Card>
        </Link>
    );
}
