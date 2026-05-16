
'use client';

import React, { useState } from 'react';
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
import { Sparkles, CheckCircle2, Bookmark, PlusCircle, Loader2, Calendar } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useFirebase } from '@/firebase';
import { ProductivityService } from '@/services/productivity-service';
import { useToast } from '@/hooks/use-toast';
import { DateInput } from '../ui/date-input';

interface UniversalActionTriggerProps {
    title: string;
    sourceModule: string;
    sourceId: string;
    sourceSubId?: string;
    subItemName?: string; // e.g. "صب الخرسانة"
}

/**
 * الزناد الشامل (Universal Action Trigger):
 * مكوّن أنيق يوضع في كافة صفحات الـ ERP لتحويل الكيانات لمهام أو مفضلات.
 */
export function UniversalActionTrigger({ 
    title, 
    sourceModule, 
    sourceId, 
    sourceSubId,
    subItemName 
}: UniversalActionTriggerProps) {
    const { user } = useAuth();
    const { firestore } = useFirebase();
    const { toast } = useToast();
    
    const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    const [actionType, setActionType] = useState<string>('review');
    const [startDate, setStartDate] = useState<Date | undefined>(new Date());
    const [dueDate, setDueDate] = useState<Date | undefined>(new Date());

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
            await service.createItem({
                userId: user.id,
                entryType: 'task',
                title: subItemName ? `${title} - ${subItemName}` : title,
                actionType: actionType as any,
                startDate,
                dueDate,
                sourceModule,
                sourceId,
                sourceSubId,
                sourceUrl: window.location.pathname,
            });
            toast({ title: 'تمت جدولة المهمة بنجاح' });
            setIsTaskDialogOpen(false);
        } finally { setIsSaving(false); }
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="rounded-xl border-primary/20 text-primary gap-2 h-9 font-black shadow-sm group">
                        <Sparkles className="h-4 w-4 animate-pulse group-hover:scale-110 transition-transform" />
                        محرك الإنتاجية
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" dir="rtl" className="w-56 rounded-2xl p-2 shadow-2xl">
                    <DropdownMenuItem onClick={() => setIsTaskDialogOpen(true)} className="rounded-xl py-3 cursor-pointer gap-2 font-bold">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        تحويل لـ مهمة عمل
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleAddBookmark} className="rounded-xl py-3 cursor-pointer gap-2 font-bold text-primary">
                        <Bookmark className="h-4 w-4" />
                        حفظ في المفضلات
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
                <DialogContent dir="rtl" className="max-w-md rounded-[2rem] border-none shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black flex items-center gap-3">
                            <PlusCircle className="text-primary h-6 w-6"/>
                            جدولة المهمة التفصيلية
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-6 space-y-6">
                        <div className="p-4 bg-muted/20 rounded-2xl border-2 border-dashed">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">بند العمل المستخلص:</Label>
                            <p className="font-bold text-lg text-primary">{subItemName || title}</p>
                        </div>

                        <div className="grid gap-2">
                            <Label className="font-black text-gray-700 pr-1">نوع الإجراء المطلـوب *</Label>
                            <Select value={actionType} onValueChange={setActionType}>
                                <SelectTrigger className="h-12 rounded-xl border-2 font-bold">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="review">مـراجعة وتدقيق</SelectItem>
                                    <SelectItem value="decision">اتخاذ قرار إداري</SelectItem>
                                    <SelectItem value="design">بـدء التصميم / العمل</SelectItem>
                                    <SelectItem value="redesign">إعادة تصميم / تعديل</SelectItem>
                                    <SelectItem value="meeting">اجتمـاع فني</SelectItem>
                                    <SelectItem value="general">متابعة عامة</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label className="font-bold text-xs pr-1">تاريخ البدء</Label>
                                <DateInput value={startDate} onChange={setStartDate} className="h-11 rounded-xl" />
                            </div>
                            <div className="grid gap-2">
                                <Label className="font-bold text-xs pr-1">موعد التسليم</Label>
                                <DateInput value={dueDate} onChange={setDueDate} className="h-11 rounded-xl" />
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="gap-3 border-t pt-6">
                        <Button variant="ghost" onClick={() => setIsTaskDialogOpen(false)} disabled={isSaving} className="rounded-xl font-bold h-12 px-8">إلغاء</Button>
                        <Button onClick={handleCreateTask} disabled={isSaving} className="rounded-xl font-black h-12 px-12 shadow-xl shadow-primary/20 gap-2">
                            {isSaving ? <Loader2 className="animate-spin h-5 w-5"/> : <Calendar className="h-5 w-5" />}
                            تأكيد الجدولة
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
