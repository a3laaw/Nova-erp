
'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogFooter 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, CheckCircle2, Bookmark, PlusCircle, Loader2, Calendar, Users } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useFirebase, useSubscription } from '@/firebase';
import { ProductivityService } from '@/services/productivity-service';
import { useToast } from '@/hooks/use-toast';
import { DateInput } from '../ui/date-input';
import { MultiSelect } from '../ui/multi-select';
import type { UserProfile } from '@/lib/types';
import { cleanFirestoreData } from '@/lib/utils';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface UniversalActionTriggerProps {
    title: string;
    sourceModule: string;
    sourceId: string;
    sourceSubId?: string;
    subItemName?: string;
}

export function UniversalActionTrigger({ title, sourceModule, sourceId, sourceSubId, subItemName }: UniversalActionTriggerProps) {
    const { user } = useAuth();
    const { firestore } = useFirebase();
    const { toast } = useToast();
    
    const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    const [actionType, setActionType] = useState<string>('review');
    const [dueDate, setDueDate] = useState<Date | undefined>(new Date());
    const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);

    const { data: allUsers = [] } = useSubscription<UserProfile>(firestore, 'users');
    const userOptions = useMemo(() => allUsers.filter(u => u.id !== user?.id).map(u => ({ value: u.id!, label: u.fullName || u.username })), [allUsers, user?.id]);

    const handleAddBookmark = async () => {
        if (!firestore || !user?.currentCompanyId) return;
        setIsSaving(true);
        try {
            const service = new ProductivityService(firestore, user.currentCompanyId);
            await service.createItem({
                userId: user.id,
                entryType: 'bookmark',
                title: subItemName ? `${title} - ${subItemName}` : title,
                sourceModule,
                sourceId,
                sourceSubId,
                sourceUrl: window.location.pathname,
            });
            toast({ title: 'تمت الإضافة للمفضلة' });
        } finally { setIsSaving(false); }
    };

    const handleCreateTask = async () => {
        if (!firestore || !user?.currentCompanyId) return;
        setIsSaving(true);
        try {
            const service = new ProductivityService(firestore, user.currentCompanyId);
            const taskTitle = subItemName ? `${title} - ${subItemName}` : title;
            
            // إنشاء المهمة الرئيسية
            await service.createItem({
                userId: user.id,
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

            // إشعار الزملاء المشاركين
            for (const targetId of assignedUserIds) {
                await addDoc(collection(firestore, 'notifications'), cleanFirestoreData({
                    userId: targetId,
                    title: 'مهمة عمل مشتركة',
                    body: `أضافك ${user.fullName} في مهمة: ${taskTitle}`,
                    link: '/dashboard/productivity?tab=tasks',
                    isRead: false,
                    createdAt: serverTimestamp()
                }));
            }

            toast({ title: 'تمت جدولة المهمة' });
            setIsTaskDialogOpen(false);
            setAssignedUserIds([]);
        } finally { setIsSaving(false); }
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="rounded-xl border-primary/20 text-primary gap-2 h-9 font-black shadow-sm group">
                        <Sparkles className="h-4 w-4 animate-pulse" /> محرك العمل
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" dir="rtl" className="w-56 rounded-2xl p-2 shadow-2xl">
                    <DropdownMenuItem onClick={() => setIsTaskDialogOpen(true)} className="rounded-xl py-3 cursor-pointer gap-2 font-bold"><CheckCircle2 className="h-4 w-4 text-green-600" /> جدولة مهمة</DropdownMenuItem>
                    <DropdownMenuItem onClick={handleAddBookmark} className="rounded-xl py-3 cursor-pointer gap-2 font-bold text-primary"><Bookmark className="h-4 w-4" /> حفظ بالمفضلة</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
                <DialogContent dir="rtl" className="max-w-md rounded-[2rem] border-none shadow-2xl bg-white">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black">جدولة مهمة عمل</DialogTitle>
                    </DialogHeader>
                    <div className="py-6 space-y-6">
                        <div className="p-4 bg-muted/20 rounded-2xl border-2 border-dashed">
                            <Label className="text-[10px] font-black uppercase text-slate-400">بند العمل المستخلص:</Label>
                            <p className="font-bold text-lg text-primary">{subItemName || title}</p>
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-black">نوع الإجراء *</Label>
                            <Select value={actionType} onValueChange={setActionType}>
                                <SelectTrigger className="h-12 rounded-xl border-2"><SelectValue /></SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="review">مراجعة وتدقيق</SelectItem>
                                    <SelectItem value="decision">اتخاذ قرار</SelectItem>
                                    <SelectItem value="design">تصميم / عمل</SelectItem>
                                    <SelectItem value="meeting">اجتماع فني</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-black">مشاركة المهمة مع الزملاء</Label>
                            <MultiSelect options={userOptions} selected={assignedUserIds} onChange={setAssignedUserIds} placeholder="اختر مهندسين أو سكرتارية..." className="rounded-xl" />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-black">موعد التسليم</Label>
                            <DateInput value={dueDate} onChange={setDueDate} className="h-12 rounded-xl" />
                        </div>
                    </div>
                    <DialogFooter className="gap-3 border-t pt-6">
                        <Button variant="ghost" onClick={() => setIsTaskDialogOpen(false)} disabled={isSaving}>إلغاء</Button>
                        <Button onClick={handleCreateTask} disabled={isSaving} className="rounded-xl font-black px-10 h-12 shadow-xl">
                            {isSaving ? <Loader2 className="animate-spin h-5 w-5"/> : <Save className="h-5 w-5" />} حفظ المهمة
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
