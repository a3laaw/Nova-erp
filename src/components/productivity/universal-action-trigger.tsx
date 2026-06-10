
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription,
    DialogFooter 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, CheckCircle2, Bookmark, PlusCircle, Loader2, Calendar, Users, Send } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useFirebase } from '@/firebase';
import { ProductivityService } from '@/services/productivity-service';
import { useToast } from '@/hooks/use-toast';
import { DateInput } from '../ui/date-input';
import { MultiSelect } from '../ui/multi-select';
import type { UserProfile } from '@/lib/types';
import { cleanFirestoreData, getTenantPath } from '@/lib/utils';
import { collection, addDoc, serverTimestamp, getDocs, query } from 'firebase/firestore';

interface UniversalActionTriggerProps {
    title: string;
    clientId: string; 
    sourceModule: string;
    sourceId: string;
    sourceSubId?: string;
    subItemName?: string;
}

export function UniversalActionTrigger({ title, clientId, sourceModule, sourceId, sourceSubId, subItemName }: UniversalActionTriggerProps) {
    const { user: currentUser } = useAuth();
    const { firestore } = useFirebase();
    const { toast } = useToast();
    
    const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    const [actionType, setActionType] = useState<string>('review');
    const [dueDate, setDueDate] = useState<Date | undefined>(new Date());
    const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);

    const tenantId = currentUser?.currentCompanyId;

    // ✅ FIX: Replace unstable useSubscription with a stable one-time fetch
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const [usersLoading, setUsersLoading] = useState(true);

    useEffect(() => {
        if (!firestore || !tenantId) return;
        let isMounted = true;
        const usersPath = getTenantPath('users', tenantId);
        
        getDocs(query(collection(firestore, usersPath)))
            .then(snap => {
                if (isMounted) {
                    const usersData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
                    setAllUsers(usersData);
                }
            })
            .catch(console.error)
            .finally(() => {
                if (isMounted) {
                    setUsersLoading(false);
                }
            });

        return () => { isMounted = false; };
    }, [firestore, tenantId]);
    // --- End of Fix ---

    const userOptions = useMemo(() => 
        allUsers.filter(u => u.id !== currentUser?.id).map(u => ({ value: u.id!, label: u.fullName || u.username }))
    , [allUsers, currentUser?.id]);

    const handleAddBookmark = async () => {
        if (!firestore || !tenantId) return;
        setIsSaving(true);
        try {
            const service = new ProductivityService(firestore, tenantId);
            await service.createItem({
                userId: currentUser!.id,
                clientId: clientId, 
                entryType: 'bookmark',
                title: subItemName ? `${title} - ${subItemName}` : title,
                sourceModule,
                sourceId,
                sourceSubId,
                sourceUrl: window.location.pathname,
            });
            toast({ title: '✅ تم الحفظ في المفضلة' });
        } finally { setIsSaving(false); }
    };

    const handleCreateTask = async () => {
        if (!firestore || !tenantId || !currentUser) return;
        setIsSaving(true);
        try {
            const service = new ProductivityService(firestore, tenantId);
            const taskTitle = subItemName ? `${title} - ${subItemName}` : title;
            
            await service.createItem({
                userId: currentUser.id,
                clientId: clientId,
                entryType: 'task',
                title: taskTitle,
                actionType: actionType as any,
                dueDate,
                assignedUserIds,
                sourceModule,
                sourceId,
                sourceSubId,
                sourceUrl: window.location.pathname,
            });

            if (assignedUserIds.length > 0) {
                const notifPath = getTenantPath('notifications', tenantId)!;
                const taskPath = getTenantPath('userProductivity', tenantId)!;

                for (const targetId of assignedUserIds) {
                    await addDoc(collection(firestore, notifPath), cleanFirestoreData({
                        userId: targetId,
                        title: '📍 مهمة عمل تشاركية',
                        body: `قام زميلك ${currentUser.fullName} بإسناد مهمة إليك: "${taskTitle}" للمتابعة.`,
                        link: '/dashboard/productivity?tab=tasks',
                        isRead: false,
                        createdAt: serverTimestamp(),
                        companyId: tenantId
                    }));

                    await addDoc(collection(firestore, taskPath), cleanFirestoreData({
                        userId: targetId,
                        clientId: clientId, 
                        entryType: 'task',
                        title: taskTitle,
                        actionType: actionType as any,
                        dueDate,
                        status: 'pending',
                        sourceModule: `${sourceModule} (مسندة من ${currentUser.fullName})`,
                        sourceId,
                        sourceSubId,
                        sourceUrl: window.location.pathname,
                        createdAt: serverTimestamp(),
                        companyId: tenantId
                    }));
                }
            }

            toast({ title: '✅ تمت الجدولة والمشاركة بنجاح' });
            setIsTaskDialogOpen(false);
            setAssignedUserIds([]);
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل إتمام العملية التشاركية.' });
        } finally { setIsSaving(false); }
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="rounded-xl border-primary/20 text-primary gap-2 h-9 font-black shadow-sm group">
                        <Sparkles className="h-4 w-4 animate-pulse" /> محرك الإنتاجية
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" dir="rtl" className="w-64 rounded-2xl p-2 shadow-2xl bg-white border-none">
                    <DropdownMenuLabel className="text-[10px] font-black uppercase text-slate-400 p-3">إجراءات الإنتاجية</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => setIsTaskDialogOpen(true)} className="rounded-xl py-3 cursor-pointer gap-3 font-bold text-black hover:bg-primary/5">
                        <PlusCircle className="h-4 w-4 text-green-600" /> جدولة مهمة عمل (تشاركية)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleAddBookmark} className="rounded-xl py-3 cursor-pointer gap-3 font-bold text-black hover:bg-primary/5">
                        <Bookmark className="h-4 w-4 text-primary" /> حفظ في المفضلة
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
                <DialogContent dir="rtl" className="max-w-lg rounded-[2.5rem] border-none shadow-2xl bg-white p-0 overflow-hidden">
                    <DialogHeader className="p-8 bg-primary/5 border-b">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner"><CheckCircle2 className="h-6 w-6"/></div>
                            <div>
                                <DialogTitle className="text-xl font-black text-[#1e1b4b]">إضافة مهمة لجدول العمل</DialogTitle>
                                <DialogDescription className="font-bold text-slate-500">سيتم ربط المعاملة الحالية بالمهمة وإخطار الزملاء المشاركين.</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="p-8 space-y-6">
                        <div className="p-5 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                            <Label className="text-[10px] font-black text-slate-400 block mb-1">المصدر (المسار الفني):</Label>
                            <p className="font-black text-lg text-primary leading-tight">{subItemName || title}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="grid gap-2">
                                <Label className="font-black text-gray-700 pr-1">نوع الإجراء المطلوب</Label>
                                <Select value={actionType} onValueChange={setActionType}>
                                    <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue /></SelectTrigger>
                                    <SelectContent dir="rtl">
                                        <SelectItem value="review">مراجعة وتدقيق</SelectItem>
                                        <SelectItem value="decision">اتخاذ قرار نهائي</SelectItem>
                                        <SelectItem value="design">تصميم / رسم فني</SelectItem>
                                        <SelectItem value="meeting">اجتماع مع العميل</SelectItem>
                                        <SelectItem value="general">متابعة عامة</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label className="font-black text-gray-700 pr-1">موعد التسليم (Dead-line)</Label>
                                <DateInput value={dueDate} onChange={setDueDate} className="h-11 rounded-xl border-2" />
                            </div>
                        </div>

                        <div className="grid gap-3">
                            <Label className="font-black text-gray-700 pr-1 flex items-center gap-2">
                                <Users className="h-4 w-4 text-primary" /> مشاركة المهمة مع زميل (اختياري)
                            </Label>
                            <MultiSelect 
                                options={userOptions} 
                                selected={assignedUserIds} 
                                onChange={setAssignedUserIds} 
                                placeholder={usersLoading ? "جاري تحميل قائمة الزملاء..." : "اختر الزملاء للمشاركة..."} 
                                className="rounded-xl" 
                            />
                            <p className="text-[9px] font-bold text-slate-400 pr-1 italic">سيصلهم تنبيه فوري وتظهر المهمة في شاشاتهم آلياً.</p>
                        </div>
                    </div>

                    <DialogFooter className="p-8 bg-muted/10 border-t gap-3">
                        <Button type="button" variant="outline" onClick={() => setIsTaskDialogOpen(false)} disabled={isSaving} className="rounded-xl font-bold h-12 px-8">إلغاء</Button>
                        <Button onClick={handleCreateTask} disabled={isSaving} className="flex-1 h-12 rounded-xl font-black text-lg shadow-xl shadow-primary/30 gap-2 bg-primary text-white border-none">
                            {isSaving ? <Loader2 className="animate-spin h-5 w-5"/> : <Send className="h-5 w-5 rotate-180" />}
                            اعتماد المهمة ونشرها
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
