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
import { Heart, Loader2, Save, User, Send, Star } from 'lucide-react';
import type { Employee, UserProfile } from '@/lib/types';
import { InlineSearchList } from '../ui/inline-search-list';
import { cleanFirestoreData, getTenantPath } from '@/lib/utils';

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

                // 1. إنشاء المنشور
                const newPostRef = doc(collection(firestore, postPath));
                transaction.set(newPostRef, cleanFirestoreData({
                    userId: currentUser.id,
                    userName: currentUser.fullName,
                    userAvatar: currentUser.avatarUrl,
                    postType: 'kudos',
                    content: `شكراً لزميلي ${targetUser.fullName}: ${message}`,
                    votesCount: 0,
                    pointsAwarded: 15,
                    createdAt: serverTimestamp(),
                    companyId: tenantId
                }));

                // 2. تسجيل النقاط في السجل
                const newLedgerRef = doc(collection(firestore, ledgerPath));
                transaction.set(newLedgerRef, {
                    userId: selectedUserId,
                    source: 'kudos_received',
                    points: 15,
                    description: `استلام ثناء من ${currentUser.fullName}`,
                    periodKey,
                    createdAt: serverTimestamp(),
                    companyId: tenantId
                });

                // 3. تحديث رصيد الموظف
                transaction.update(doc(firestore, userPath), {
                    totalPoints: (targetUser.totalPoints || 0) + 15
                });
            });

            toast({ title: 'تم إرسال بطاقة الشكر', description: 'تم منح زميلك 15 نقطة تفاعلية.' });
            onClose();
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل إرسال الثناء.' });
        } finally { setIsSaving(false); }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent dir="rtl" className="max-w-md rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden">
                <DialogHeader className="p-8 bg-red-50 border-b">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-100 rounded-2xl text-red-600 shadow-inner">
                            <Heart className="h-8 w-8" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-black text-red-900">إرسال بطاقة شكر (Kudos)</DialogTitle>
                            <DialogDescription className="font-bold text-red-700/60">عبر عن تقديرك لزميلك وامنحه نقاطاً للرتبة.</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>
                <div className="p-8 space-y-6">
                    <div className="grid gap-2">
                        <Label className="font-black text-slate-700 pr-1">اختر الزميل المتميز *</Label>
                        <InlineSearchList 
                            value={selectedUserId}
                            onSelect={setSelectedUserId}
                            options={userOptions}
                            placeholder={loading ? "تحميل..." : "ابحث عن اسم..."}
                            className="h-12 rounded-xl"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label className="font-black text-slate-700 pr-1">رسالة التقدير *</Label>
                        <Textarea 
                            value={message} 
                            onChange={e => setMessage(e.target.value)} 
                            placeholder="لماذا تشكر زميلك اليوم؟" 
                            className="rounded-2xl border-2 p-4 text-base"
                            rows={4}
                        />
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-black text-red-600 uppercase tracking-widest bg-red-50 p-3 rounded-xl border border-red-100">
                        <Star className="h-3 w-3 fill-red-600" /> سيتم منح الزميل 15 نقطة تفاعلية فوراً.
                    </div>
                </div>
                <DialogFooter className="p-8 bg-muted/10 border-t flex gap-3">
                    <Button variant="ghost" onClick={onClose} disabled={isSaving} className="rounded-xl font-bold h-12 px-8">إلغاء</Button>
                    <Button onClick={handleSend} disabled={isSaving || !selectedUserId || !message.trim()} className="rounded-xl font-black px-12 h-12 shadow-xl shadow-red-200 bg-red-600 hover:bg-red-700 text-white border-none gap-2">
                        {isSaving ? <Loader2 className="animate-spin h-5 w-5"/> : <Send className="h-4 w-4" />} إرسال البطاقة
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
