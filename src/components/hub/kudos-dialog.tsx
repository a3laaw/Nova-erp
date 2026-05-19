'use client';

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { useFirebase, useSubscription } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { collection, addDoc, serverTimestamp, doc, runTransaction } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Heart, Loader2, Save, User, Send, Star, Sparkles, X } from 'lucide-react';
import type { Employee, UserProfile } from '@/lib/types';
import { InlineSearchList } from '../ui/inline-search-list';
import { cleanFirestoreData, getTenantPath } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';

export function KudosDialog({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    
    const [selectedUserId, setSelectedUserId] = useState('');
    const [message, setMessage] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const { data: users, loading } = useSubscription<UserProfile>(firestore, 'users');

    const userOptions = useMemo(() => 
        users.filter(u => u.id !== currentUser?.id).map(u => ({ value: u.id!, label: u.fullName || u.username }))
    , [users, currentUser?.id]);

    const handleSend = async () => {
        if (!firestore || !currentUser || !selectedUserId || !message.trim()) return;
        setIsSaving(true);
        try {
            await runTransaction(firestore, async (transaction) => {
                const targetUser = users.find(u => u.id === selectedUserId)!;
                const tenantId = currentUser.currentCompanyId!;
                
                const postPath = getTenantPath('hub_posts', tenantId);
                const ledgerPath = getTenantPath('points_ledger', tenantId);
                const userPath = getTenantPath(`users/${selectedUserId}`, tenantId);

                const currentYear = new Date().getFullYear();
                const currentMonth = new Date().getMonth() + 1;
                const periodKey = `${currentYear}-${currentMonth}`;

                // 1. إنشاء المنشور الاجتماعي
                const newPostRef = doc(collection(firestore, postPath));
                transaction.set(newPostRef, cleanFirestoreData({
                    userId: currentUser.id,
                    userName: currentUser.fullName,
                    userAvatar: currentUser.avatarUrl,
                    postType: 'kudos',
                    content: `بكل تقدير، أهدى زميلنا ${currentUser.fullName} بطاقة شكر لـ ${targetUser.fullName}: ${message}`,
                    votesCount: 0,
                    pointsAwarded: 15,
                    createdAt: serverTimestamp(),
                    companyId: tenantId
                }));

                // 2. تسجيل النقاط في السجل المالي التفاعلي
                const newLedgerRef = doc(collection(firestore, ledgerPath));
                transaction.set(newLedgerRef, {
                    userId: selectedUserId,
                    source: 'kudos_received',
                    points: 15,
                    description: `استلام ثناء تقديري من ${currentUser.fullName}`,
                    periodKey,
                    createdAt: serverTimestamp(),
                    companyId: tenantId
                });

                // 3. تحديث رصيد الموظف (الرتبة)
                transaction.update(doc(firestore, userPath), {
                    totalPoints: (targetUser.totalPoints || 0) + 15
                });
            });

            toast({ title: 'تم إرسال بطاقة الشكر', description: 'تم منح زميلك 15 نقطة تفاعلية للرتبة.' });
            onClose();
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل إرسال الثناء.' });
        } finally { setIsSaving(false); }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent dir="rtl" className="max-w-md rounded-[3.5rem] border-none shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] p-0 overflow-hidden bg-white/95 backdrop-blur-xl animate-in zoom-in-95 duration-300">
                {/* 🛡️ الهيدر الملكي المتوهج 🛡️ */}
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-orange-400 via-primary to-orange-400 z-50" />
                
                <DialogHeader className="p-10 pb-8 bg-gradient-to-br from-orange-50/80 via-white to-white border-b relative">
                    <button 
                        onClick={onClose} 
                        className="absolute left-6 top-6 p-2 rounded-full hover:bg-orange-100 transition-colors group"
                    >
                        <X className="h-5 w-5 text-slate-400 group-hover:text-primary" />
                    </button>
                    
                    <div className="flex items-center gap-5">
                        <div className="p-4 bg-white rounded-3xl text-primary shadow-[0_10px_25px_rgba(255,122,0,0.2)] border-2 border-orange-50 animate-float">
                            <Heart className="h-10 w-10 fill-red-500 text-red-500" />
                        </div>
                        <div className="text-right">
                            <DialogTitle className="text-2xl font-black text-[#1e1b4b] tracking-tighter">إرسال ثناء (Kudos)</DialogTitle>
                            <DialogDescription className="font-bold text-slate-500 mt-1">عبر عن تقديرك لزميلك وامنحه نقاطاً للرتبة.</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-10 space-y-8">
                    <div className="grid gap-3">
                        <Label className="font-black text-[11px] uppercase tracking-widest text-slate-400 pr-2">اختر الزميل المتميز *</Label>
                        <InlineSearchList 
                            value={selectedUserId}
                            onSelect={setSelectedUserId}
                            options={userOptions}
                            placeholder={loading ? "جاري جلب القائمة..." : "ابحث عن اسم الزميل..."}
                            className="h-14 rounded-2xl border-2 bg-slate-50/50 shadow-inner text-lg"
                        />
                    </div>

                    <div className="grid gap-3">
                        <Label className="font-black text-[11px] uppercase tracking-widest text-slate-400 pr-2">رسالة التقدير *</Label>
                        <div className="relative group">
                            <div className="absolute top-4 left-4 opacity-[0.05] text-primary font-black text-6xl pointer-events-none select-none">“</div>
                            <Textarea 
                                value={message} 
                                onChange={e => setMessage(e.target.value)} 
                                placeholder="لماذا يستحق الشكر اليوم؟" 
                                className="rounded-[2rem] border-2 bg-slate-50/50 p-6 text-lg font-bold leading-relaxed focus:bg-white transition-all shadow-inner min-h-[160px]"
                            />
                        </div>
                    </div>

                    {/* بطاقة التنبيه الذهبية */}
                    <div className="flex items-center gap-4 bg-orange-50/50 p-5 rounded-[1.8rem] border-2 border-dashed border-orange-200 animate-in fade-in slide-in-from-bottom-2 duration-700">
                        <div className="p-2.5 bg-orange-100 rounded-xl">
                            <Sparkles className="h-5 w-5 text-[#FF7A00] animate-pulse" />
                        </div>
                        <p className="text-xs font-black text-orange-800 leading-tight">
                            باعتمادك الإرسال، سيتم منح الزميل <span className="underline decoration-2">15 نقطة XP</span> فوراً، ونشر الخبر على الحائط التفاعلي.
                        </p>
                    </div>
                </div>

                <DialogFooter className="p-10 bg-slate-50/50 border-t flex gap-4 shrink-0">
                    <Button 
                        variant="ghost" 
                        onClick={onClose} 
                        disabled={isSaving} 
                        className="h-14 px-8 rounded-2xl font-bold text-slate-500 hover:bg-white"
                    >
                        تراجع
                    </Button>
                    <Button 
                        onClick={handleSend} 
                        disabled={isSaving || !selectedUserId || !message.trim()} 
                        className="flex-1 h-14 rounded-2xl font-black text-xl shadow-[0_15px_40px_-10px_rgba(255,122,0,0.4)] gap-3 bg-gradient-to-r from-[#FF7A00] to-[#FFB000] border-none text-white active:scale-95 transition-all"
                    >
                        {isSaving ? <Loader2 className="animate-spin h-6 w-6"/> : <Send className="h-5 w-5 rotate-180" />}
                        اعتماد وإرسال البطاقة
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
