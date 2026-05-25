'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
    Zap, Save, Loader2, GitMerge, Settings2, 
    ArrowRightLeft, PlusCircle, Trash2, Activity
} from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, doc, addDoc, serverTimestamp, orderBy, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { cleanFirestoreData } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function AutomationEngine() {
    const { firestore } = useFirebase();
    const { user } = useAuth();
    const { toast } = useToast();
    
    const [isSaving, setIsSaving] = useState(false);
    const [triggerEvent, setTriggerEvent] = useState('on_save');
    const [sourceModule, setSourceModule] = useState('Construction');
    const [actionEffect, setActionEffect] = useState('create_draft_voucher');

    const { data: workflows, loading } = useSubscription<any>(firestore, 'system_automations', [orderBy('createdAt', 'desc')]);

    const handleAddAutomation = async () => {
        if (!firestore || !user?.currentCompanyId) return;
        setIsSaving(true);
        try {
            const autoRef = collection(firestore, `companies/${user.currentCompanyId}/system_automations`);
            await addDoc(autoRef, cleanFirestoreData({
                triggerEvent,
                sourceModule,
                actionEffect,
                isActive: true,
                createdAt: serverTimestamp(),
                companyId: user.currentCompanyId
            }));
            toast({ title: '✅ تم تفعيل القاعدة التلقائية' });
        } finally { setIsSaving(false); }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <Card className="lg:col-span-8 rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white/80 backdrop-blur-xl border border-white/40">
                <CardHeader className="bg-orange-500/5 p-10 border-b">
                    <div className="flex items-center gap-5">
                        <div className="p-4 bg-orange-600 rounded-[1.8rem] shadow-xl text-white border-4 border-white">
                            <Zap className="h-8 w-8" />
                        </div>
                        <div className="text-right">
                            <CardTitle className="text-2xl font-black">محرك الإجراءات المتسلسلة (Triggers)</CardTitle>
                            <CardDescription className="font-bold text-slate-500">برمجة ردود فعل النظام (مثال: إذا تم استلام مواد، ولّد قيد مالي فوراً).</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-10 space-y-12">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-10 bg-slate-50 p-8 rounded-[2.5rem] border-2 border-dashed">
                        <div className="space-y-4 flex-1">
                            <Label className="font-black text-indigo-600 text-xs uppercase tracking-widest pr-1">مُحفز الحدث (Trigger)</Label>
                            <Select value={triggerEvent} onValueChange={setTriggerEvent}>
                                <SelectTrigger className="h-12 rounded-xl bg-white border-2 font-bold"><SelectValue /></SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="on_save">عند حفظ مستند (Post-Save)</SelectItem>
                                    <SelectItem value="on_change">عند تغيير حقل (Real-time Change)</SelectItem>
                                    <SelectItem value="on_overdue">عند تجاوز الموعد (Overdue Alert)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="p-3 bg-white rounded-2xl shadow-md text-slate-400 rotate-90 md:rotate-0"><ArrowRightLeft className="h-5 w-5"/></div>
                        <div className="space-y-4 flex-1">
                            <Label className="font-black text-orange-600 text-xs uppercase tracking-widest pr-1">الإجراء التلقائي (Action)</Label>
                            <Select value={actionEffect} onValueChange={setActionEffect}>
                                <SelectTrigger className="h-12 rounded-xl bg-white border-2 font-bold text-orange-700 border-orange-200"><SelectValue /></SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="create_draft_voucher">توليد مسودة قيد مالي</SelectItem>
                                    <SelectItem value="send_admin_notif">إرسال تنبيه فوري للمدير</SelectItem>
                                    <SelectItem value="update_inventory">تحديث رصيد المخزن آلياً</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="p-8 bg-blue-50/50 rounded-[2rem] border-2 border-blue-100 flex items-center gap-6">
                        <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg"><Settings2 className="h-6 w-6"/></div>
                        <div className="space-y-1">
                            <p className="font-black text-blue-900 text-lg">تحصين الدورة المستندية</p>
                            <p className="text-xs font-bold text-blue-700 leading-relaxed">بناءً على هذه القواعد، سيقوم النظام بالفصل الآمن بين "الميدان" و "المالية"؛ حيث تصل البيانات للمحاسب كمقترح (Draft) بانتظار الاعتماد.</p>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="p-10 border-t bg-muted/5 flex justify-end">
                    <Button onClick={handleAddAutomation} disabled={isSaving} className="h-14 px-16 rounded-2xl font-black text-xl gap-3 shadow-xl bg-orange-600 hover:bg-orange-700">
                        {isSaving ? <Loader2 className="animate-spin h-6 w-6"/> : <PlusCircle className="h-6 w-6"/>} تفعيل القاعدة الآن
                    </Button>
                </CardFooter>
            </Card>

            <Card className="lg:col-span-4 rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white/45 backdrop-blur-xl border border-white/60">
                <CardHeader className="bg-slate-900 text-white p-8">
                    <CardTitle className="text-xl font-black flex items-center gap-2"><Activity className="h-5 w-5"/> القواعد النشطة</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    {loading ? <div className="space-y-3"><Skeleton className="h-16 w-full rounded-2xl"/><Skeleton className="h-16 w-full rounded-2xl"/></div> :
                     workflows.length === 0 ? <p className="text-center opacity-20 italic py-10 font-black">لا توجد قواعد أتمتة حالية.</p> :
                     workflows.map((flow: any) => (
                        <div key={flow.id} className="p-5 bg-white rounded-3xl border-2 mb-4 hover:border-orange-400 transition-all group shadow-sm">
                            <div className="flex justify-between items-start mb-3">
                                <Badge className="bg-orange-100 text-orange-700 border-none font-black text-[9px] uppercase tracking-widest">{flow.triggerEvent}</Badge>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteDoc(doc(firestore!, `companies/${user?.currentCompanyId}/system_automations`, flow.id!))}><Trash2 className="h-4 w-4"/></Button>
                            </div>
                            <p className="font-black text-sm text-slate-800 flex items-center gap-2">
                                {flow.actionEffect === 'create_draft_voucher' ? 'توليد قيد استحقاق آلي' : 'تنبيه إداري فوري'}
                            </p>
                        </div>
                     ))}
                </CardContent>
            </Card>
        </div>
    );
}