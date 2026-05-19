'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { doc, updateDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, Target, Sparkles } from 'lucide-react';
import { cn, getTenantPath, cleanFirestoreData } from '@/lib/utils';
import { Label } from '../ui/label';
import { Badge } from '@/components/ui/badge';

const moods = [
    { emoji: '😊', label: 'سعيد', color: 'bg-green-50 text-green-600 border-green-200 shadow-green-100' },
    { emoji: '🤩', label: 'متحمس', color: 'bg-orange-50 text-orange-600 border-orange-200 shadow-orange-100' },
    { emoji: '☕', label: 'تركيز', color: 'bg-amber-50 text-amber-700 border-amber-200 shadow-amber-100' },
    { emoji: '🛠️', label: 'عمل جاد', color: 'bg-blue-50 text-blue-600 border-blue-200 shadow-blue-100' },
    { emoji: '🤔', label: 'تفكير', color: 'bg-purple-50 text-purple-600 border-purple-200 shadow-purple-100' },
    { emoji: '😴', label: 'مرهق', color: 'bg-slate-50 text-slate-600 border-slate-200 shadow-slate-100' },
];

export function MoodTracker() {
    const { firestore } = useFirebase();
    const { user } = useAuth();
    const { toast } = useToast();
    
    const [selectedMood, setSelectedMood] = useState(user?.currentMood || '😊');
    const [focus, setFocus] = useState(user?.currentFocus || '');
    const [isSaving, setIsSaving] = useState(false);

    const handleUpdate = async () => {
        const tenantId = user?.currentCompanyId;
        if (!firestore || !tenantId) return;
        
        setIsSaving(true);
        try {
            const userRef = doc(firestore, getTenantPath(`users/${user.id}`, tenantId));
            const postPath = getTenantPath(`hub_posts`, tenantId);
            
            await updateDoc(userRef, {
                currentMood: selectedMood,
                currentFocus: focus,
                updatedAt: serverTimestamp()
            });

            if (focus.trim()) {
                await addDoc(collection(firestore, postPath), cleanFirestoreData({
                    userId: user.id,
                    userName: user.fullName,
                    userAvatar: user.avatarUrl,
                    postType: 'employee_idea',
                    content: `تركيزي اليوم: ${focus}`,
                    moodIcon: selectedMood,
                    votesCount: 0,
                    pointsAwarded: 5,
                    createdAt: serverTimestamp(),
                    companyId: tenantId
                }));
            }

            toast({ title: 'تم التحديث', description: 'تظهر حالتك الآن لجميع الزملاء في الحائط الحي.' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تحديث النبض اليومي.' });
        } finally { setIsSaving(false); }
    };

    return (
        <Card className="rounded-[3rem] border-none shadow-2xl bg-white/60 backdrop-blur-3xl overflow-hidden group hover:border-primary/20 transition-all duration-500 border-4 border-white active-glow">
            <CardContent className="p-10 space-y-10">
                <div className="flex flex-col xl:flex-row justify-between items-center gap-12">
                    <div className="space-y-4 text-center xl:text-right shrink-0">
                        <Label className="font-black text-xs text-slate-400 uppercase tracking-[0.3em] mr-2 block">Mood Pulse / نبض الحالة</Label>
                        <div className="flex flex-wrap justify-center gap-5">
                            {moods.map((m) => (
                                <button
                                    key={m.emoji}
                                    type="button"
                                    onClick={() => setSelectedMood(m.emoji)}
                                    className={cn(
                                        "w-20 h-20 rounded-[1.8rem] flex items-center justify-center text-4xl transition-all duration-500 hover:scale-110 active:scale-95",
                                        selectedMood === m.emoji 
                                            ? cn(m.color, "shadow-2xl border-4 ring-8 ring-white scale-110") 
                                            : "bg-white/40 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 shadow-md border-2 border-white/80"
                                    )}
                                    title={m.label}
                                >
                                    {m.emoji}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 w-full space-y-4">
                        <div className="flex justify-between items-end pr-2">
                            <Label className="font-black text-xs text-[#FF7A00] uppercase tracking-[0.3em] flex items-center gap-2">
                                <Target className="h-4 w-4 animate-spin-slow" /> ماهو عنوان تركيزك اليوم؟
                            </Label>
                            {focus.length > 0 && <Badge className="bg-orange-500/10 text-[#FF7A00] border-none text-[8px] font-black h-4 px-2">+5 Points</Badge>}
                        </div>
                        <div className="flex gap-4 bg-white p-2 rounded-[2.2rem] border-4 border-slate-50 shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)] group-focus-within:border-orange-500/20 transition-all duration-500 group-focus-within:shadow-xl">
                            <Input 
                                value={focus} 
                                onChange={e => setFocus(e.target.value)} 
                                placeholder="اكتب المهمة الكبرى التي تشغلك الآن..."
                                className="h-14 rounded-2xl border-none shadow-none focus-visible:ring-0 font-black text-xl bg-transparent placeholder:text-slate-300 placeholder:italic"
                            />
                            <Button 
                                onClick={handleUpdate} 
                                disabled={isSaving} 
                                className="h-14 w-20 rounded-[1.5rem] font-black shadow-2xl shadow-orange-500/30 bg-[#FF7A00] hover:bg-[#E66D00] transition-all hover:scale-105 active:scale-90 text-white"
                            >
                                {isSaving ? <Loader2 className="animate-spin h-6 w-6" /> : <Send className="h-6 w-6 rotate-180" />}
                            </Button>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
