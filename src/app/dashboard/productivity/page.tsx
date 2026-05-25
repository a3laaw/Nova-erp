
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { where, doc, updateDoc, serverTimestamp, deleteDoc, type QueryConstraint } from 'firebase/firestore';
import type { UserProductivityItem, ProductivityAction, ProductivityStatus } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
    ListChecks, 
    Bookmark, 
    Clock, 
    ArrowUpRight, 
    CheckCircle2,
    Sparkles,
    Trash2,
    Loader2,
    Target,
    Activity,
    CalendarDays,
    X,
    Pencil,
    Save,
    Calendar
} from 'lucide-react';
import { cn, formatCurrency, getTenantPath, cleanFirestoreData } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { useAuth } from '@/context/auth-context';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateInput } from '@/components/ui/date-input';

/**
 * منصة الإنتاجية الشخصية (Personal Workspace V71.0):
 * - تم إضافة نظام التعديل والحذف المرن للمهام.
 * - دعم تغيير التواريخ ونوع الإجراء يدوياً.
 */
export default function PersonalProductivityPage() {
    const { firestore } = useFirebase();
    const { user, loading: authLoading } = useAuth();
    const searchParams = useSearchParams();
    
    const [activeTab, setActiveTab] = useState('tasks');
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [taskToEdit, setTaskToEdit] = useState<UserProductivityItem | null>(null);

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'bookmarks') setActiveTab('bookmarks');
        else if (tab === 'tasks') setActiveTab('tasks');
    }, [searchParams]);

    const tenantId = user?.currentCompanyId;
    
    const productivityQuery = useMemo<QueryConstraint[] | null>(() => {
        if (!user?.id) return null;
        return [
            where('userId', '==', user.id)
        ];
    }, [user?.id]);

    const { data: rawItems, loading: subscriptionLoading } = useSubscription<UserProductivityItem>(
        firestore, 
        user?.id ? 'userProductivity' : null,
        productivityQuery || []
    );

    const allItems = useMemo(() => {
        return [...rawItems].sort((a, b) => {
            const timeA = toFirestoreDate(a.createdAt)?.getTime() || 0;
            const timeB = toFirestoreDate(b.createdAt)?.getTime() || 0;
            return timeB - timeA;
        });
    }, [rawItems]);

    const tasks = useMemo(() => allItems.filter(i => i.entryType === 'task'), [allItems]);
    const bookmarks = useMemo(() => allItems.filter(i => i.entryType === 'bookmark'), [allItems]);

    const globalLoading = authLoading || (user?.id && subscriptionLoading && allItems.length === 0);

    const openEditDialog = (task: UserProductivityItem) => {
        setTaskToEdit(task);
        setIsEditDialogOpen(true);
    };

    return (
        <div className="space-y-10" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-gradient-to-r from-[#FF7A00] to-[#FFB000] text-white relative">
                <div className="absolute top-0 right-0 w-80 h-full bg-white/10 -skew-x-12 transform translate-x-32 pointer-events-none" />
                <CardHeader className="p-10 relative z-10">
                    <div className="flex items-center gap-6">
                        <div className="p-5 bg-white/20 rounded-[2rem] backdrop-blur-xl border border-white/40 shadow-2xl">
                            <ListChecks className="h-10 w-10 text-white" />
                        </div>
                        <div className="text-right">
                            <CardTitle className="text-3xl font-black text-white tracking-tighter">منصة الإنجاز والإنتاجية</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                                <Sparkles className="h-4 w-4 text-amber-200 animate-pulse" />
                                <CardDescription className="text-white/90 font-bold text-sm">مساحتك الخاصة لمتابعة المهام المستخلصة من المشاريع والوصول السريع للمفضلات.</CardDescription>
                            </div>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="flex justify-center mb-10 no-print">
                    <TabsList className="bg-white/40 p-1.5 rounded-[2rem] border border-white/60 shadow-xl h-16 w-full max-w-2xl backdrop-blur-md">
                        <TabsTrigger value="tasks" className="rounded-2xl flex-1 font-black gap-2 h-full transition-all text-sm">
                            <ListChecks className="h-4 w-4" /> مهامي الشخصية المجدولة
                        </TabsTrigger>
                        <TabsTrigger value="bookmarks" className="rounded-2xl flex-1 font-black gap-2 h-full transition-all text-sm">
                            <Bookmark className="h-4 w-4" /> المفضلات والروابط
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="tasks" className="animate-in fade-in slide-in-from-bottom-4 duration-700 m-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {globalLoading ? (
                            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-72 w-full rounded-[3rem]" />)
                        ) : tasks.length === 0 ? (
                            <div className="col-span-full h-96 flex flex-col items-center justify-center opacity-20 grayscale border-4 border-dashed rounded-[3rem] bg-white/40">
                                <ListChecks className="h-24 w-24 mb-4" />
                                <p className="text-2xl font-black">لا توجد مهام مجدولة حالياً</p>
                                <p className="text-sm font-bold mt-2 text-center px-6">استخدم زر "محرك الإنتاجية" من داخل المسار الفني أو ملف العميل لإضافة مهام للمتابعة.</p>
                            </div>
                        ) : (
                            tasks.map(task => <TaskCard key={task.id} task={task} onEdit={openEditDialog} />)
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="bookmarks" className="animate-in fade-in slide-in-from-bottom-4 duration-700 m-0">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                        {globalLoading ? (
                            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-3xl" />)
                        ) : bookmarks.length === 0 ? (
                            <div className="col-span-full h-96 flex flex-col items-center justify-center opacity-20 grayscale border-4 border-dashed rounded-[3rem] bg-white/40">
                                <Bookmark className="h-24 w-24 mb-4" />
                                <p className="text-2xl font-black">المفضلة فارغة</p>
                                <p className="text-sm font-bold mt-2 text-center px-6">أضف الصفحات المهمة للمفضلة من زر "محرك الإنتاجية" للوصول السريع.</p>
                            </div>
                        ) : (
                            bookmarks.map(bm => <BookmarkCard key={bm.id} bookmark={bm} />)
                        )}
                    </div>
                </TabsContent>
            </Tabs>

            {isEditDialogOpen && taskToEdit && (
                <EditTaskDialog 
                    isOpen={isEditDialogOpen} 
                    onClose={() => setIsEditDialogOpen(false)} 
                    task={taskToEdit} 
                />
            )}
        </div>
    );
}

function TaskCard({ task, onEdit }: { task: UserProductivityItem, onEdit: (task: UserProductivityItem) => void }) {
    const { firestore } = useFirebase();
    const { user } = useAuth();
    const { toast } = useToast();
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const tenantId = user?.currentCompanyId;
    const taskPath = getTenantPath(`userProductivity/${task.id}`, tenantId);

    const handleComplete = async () => {
        if (!firestore || !taskPath) return;
        setIsUpdating(true);
        try {
            await updateDoc(doc(firestore, taskPath), {
                status: 'completed',
                completedAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            toast({ title: '✅ تم الإنجاز', description: 'تم تحديث المهمة ومنحك نقاط الخبرة.' });
        } finally { setIsUpdating(false); }
    };

    const handleDelete = async () => {
        if (!firestore || !taskPath || !confirm('هل تود حذف هذه المهمة نهائياً من جدولك؟')) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(firestore, taskPath));
            toast({ title: 'تم الحذف' });
        } finally { setIsDeleting(false); }
    };

    const actionLabels: Record<string, string> = {
        review: 'مراجعة وتدقيق', 
        decision: 'اتخاذ قرار', 
        design: 'تصميم فني', 
        redesign: 'إعادة تصميم / تعديل', 
        meeting: 'اجتماع عمل', 
        general: 'متابعة'
    };

    const actionColors: Record<string, string> = {
        review: 'bg-blue-100 text-blue-800 border-blue-200', 
        decision: 'bg-red-100 text-red-800 border-red-200', 
        design: 'bg-purple-100 text-purple-800 border-purple-200', 
        redesign: 'bg-orange-100 text-[#FF7A00] border-orange-200'
    };

    const isCompleted = task.status === 'completed';

    return (
        <Card className={cn(
            "rounded-[2.8rem] border-2 transition-all duration-500 hover:shadow-2xl group flex flex-col h-full",
            isCompleted ? "bg-green-50/20 border-green-100 grayscale opacity-60" : "bg-white hover:border-[#FF7A00]/20"
        )}>
            <CardHeader className="p-8 pb-4">
                <div className="flex justify-between items-start mb-4">
                    <Badge variant="outline" className={cn("px-4 py-1 rounded-full font-black text-[10px] uppercase tracking-widest border-2", actionColors[task.actionType!] || "bg-slate-50 text-slate-500 border-slate-100")}>
                        {actionLabels[task.actionType!] || 'مهمة عمل'}
                    </Badge>
                    <div className="flex items-center gap-2 no-print">
                         {!isCompleted && (
                            <Button variant="ghost" size="icon" onClick={() => onEdit(task)} className="h-8 w-8 rounded-full hover:bg-primary/10 text-primary">
                                <Pencil className="h-4 w-4" />
                            </Button>
                         )}
                         <Button variant="ghost" size="icon" onClick={handleDelete} disabled={isDeleting} className="h-8 w-8 rounded-full hover:bg-red-50 text-red-300 hover:text-red-600">
                            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>
                <CardTitle className="text-xl font-black text-black leading-tight tracking-tight group-hover:text-primary transition-colors">
                    {task.title}
                </CardTitle>
            </CardHeader>
            
            <CardContent className="px-8 flex-1">
                <div className="p-6 bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-100 space-y-4 shadow-inner group-hover:bg-white group-hover:border-primary/10 transition-all duration-500">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="h-3.5 w-3.5 text-primary opacity-40" />
                            <span className="text-[10px] font-black text-slate-400 uppercase">الموعد النهائي</span>
                        </div>
                        <span className="font-mono font-black text-[#000000] text-sm">
                            {toFirestoreDate(task.dueDate) ? format(toFirestoreDate(task.dueDate)!, 'dd MMMM', { locale: ar }) : '-'}
                        </span>
                    </div>
                    <Separator className="bg-slate-200/50" />
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-primary opacity-40" />
                            <span className="text-[10px] font-black text-slate-400 uppercase">الحالة</span>
                        </div>
                        <Badge className={cn("font-black text-[9px] border-none px-3", isCompleted ? "bg-green-600 text-white" : "bg-blue-600 text-white")}>
                            {isCompleted ? 'مكتملة' : 'قيد المتابعة'}
                        </Badge>
                    </div>
                </div>
            </CardContent>

            <CardFooter className="p-8 bg-muted/10 flex gap-3 rounded-b-[2.8rem]">
                <Button asChild variant="ghost" className="h-12 px-6 rounded-2xl font-black text-xs gap-2 hover:bg-white transition-all">
                    <Link href={task.sourceUrl || '#'}><ArrowUpRight className="h-4 w-4"/> فتح المصدر</Link>
                </Button>
                
                {!isCompleted && (
                    <Button onClick={handleComplete} disabled={isUpdating} className="flex-1 h-12 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-black gap-2 shadow-xl shadow-green-100">
                        {isUpdating ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle2 className="h-4 w-4"/>}
                        إتمام المهمة
                    </Button>
                )}
            </CardFooter>
        </Card>
    );
}

function EditTaskDialog({ isOpen, onClose, task }: { isOpen: boolean, onClose: () => void, task: UserProductivityItem }) {
    const { firestore } = useFirebase();
    const { user } = useAuth();
    const { toast } = useToast();
    
    const [title, setTitle] = useState(task.title);
    const [actionType, setActionType] = useState<string>(task.actionType || 'general');
    const [dueDate, setDueDate] = useState<Date | undefined>(toFirestoreDate(task.dueDate) || undefined);
    const [isSaving, setIsSaving] = useState(false);

    const handleUpdate = async () => {
        const tenantId = user?.currentCompanyId;
        if (!firestore || !tenantId) return;

        setIsSaving(true);
        try {
            const taskPath = getTenantPath(`userProductivity/${task.id}`, tenantId);
            await updateDoc(doc(firestore, taskPath!), cleanFirestoreData({
                title,
                actionType,
                dueDate: dueDate ? Timestamp.fromDate(dueDate) : null,
                updatedAt: serverTimestamp()
            }));
            toast({ title: '✅ تم تحديث المهمة' });
            onClose();
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ في الحفظ' });
        } finally { setIsSaving(false); }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent dir="rtl" className="max-w-md rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
                <DialogHeader className="p-8 bg-primary/5 border-b">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner">
                            <Pencil className="h-6 w-6" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-black text-[#1e1b4b]">تعديل مهمة العمل</DialogTitle>
                            <DialogDescription className="font-bold">تعديل الموعد أو نوع الإجراء المطلوب.</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-8 space-y-6">
                    <div className="grid gap-2">
                        <Label className="font-black text-slate-400 text-[10px] uppercase pr-2">عنوان المهمة *</Label>
                        <Input value={title} onChange={e => setTitle(e.target.value)} className="h-12 rounded-xl border-2 font-bold text-black" />
                    </div>

                    <div className="grid gap-2">
                        <Label className="font-black text-slate-400 text-[10px] uppercase pr-2">نوع الإجراء</Label>
                        <Select value={actionType} onValueChange={setActionType}>
                            <SelectTrigger className="h-11 rounded-xl border-2 font-bold">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent dir="rtl">
                                <SelectItem value="review">مراجعة وتدقيق</SelectItem>
                                <SelectItem value="decision">اتخاذ قرار</SelectItem>
                                <SelectItem value="design">تصميم فني</SelectItem>
                                <SelectItem value="redesign">إعادة تصميم / تعديل</SelectItem>
                                <SelectItem value="meeting">اجتماع عمل</SelectItem>
                                <SelectItem value="general">متابعة عامة</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label className="font-black text-slate-400 text-[10px] uppercase pr-2">الموعد النهائي المحدث</Label>
                        <DateInput value={dueDate} onChange={setDueDate} className="h-11 rounded-xl border-2" />
                    </div>
                </div>

                <DialogFooter className="p-8 bg-muted/10 border-t flex gap-3">
                    <Button variant="ghost" onClick={onClose} disabled={isSaving} className="rounded-xl font-bold h-12 px-8">إلغاء</Button>
                    <Button onClick={handleUpdate} disabled={isSaving || !title.trim()} className="flex-1 h-12 rounded-xl font-black text-lg shadow-xl shadow-primary/30 gap-2">
                        {isSaving ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
                        حفظ التغييرات
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function BookmarkCard({ bookmark }: { bookmark: UserProductivityItem }) {
    const { firestore } = useFirebase();
    const { user } = useAuth();
    const { toast } = useToast();
    
    const tenantId = user?.currentCompanyId;
    const path = getTenantPath(`userProductivity/${bookmark.id}`, tenantId);

    const handleDelete = async (e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        if (!firestore || !path) return;
        if (!confirm('هل تود حذف هذا الرابط من مفضلاتك؟')) return;
        try {
            await deleteDoc(doc(firestore, path));
            toast({ title: 'تمت الإزالة من المفضلة' });
        } catch(e) {}
    };

    return (
        <Link href={bookmark.sourceUrl || '#'} className="block group">
            <Card className="rounded-[2.5rem] border-2 border-transparent bg-white shadow-md hover:border-primary/40 hover:shadow-2xl transition-all duration-500 h-full flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
                <button onClick={handleDelete} className="absolute top-4 left-4 p-1.5 rounded-full hover:bg-red-50 text-red-300 hover:text-red-600 transition-all opacity-0 group-hover:opacity-100">
                    <X className="h-3 w-3" />
                </button>
                
                <div className="p-4 bg-primary/5 rounded-2xl text-primary mb-5 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                    <Bookmark className="h-8 w-8 fill-primary/10" />
                </div>
                
                <p className="font-black text-xs text-black line-clamp-2 leading-relaxed tracking-tight px-1">
                    {bookmark.title}
                </p>
                
                <div className="mt-6 opacity-40 group-hover:opacity-100 transition-all duration-700 scale-90 group-hover:scale-100">
                    <Badge variant="outline" className="text-[8px] font-black uppercase text-primary border-primary/20 bg-primary/5 px-3">
                        {bookmark.sourceModule}
                    </Badge>
                </div>
            </Card>
        </Link>
    );
}

