'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, Target, Sparkles } from 'lucide-react';
import { cn, getTenantPath } from '@/lib/utils';
import { Label } from '../ui/label';

const moods = [
    { emoji: '😊', label: 'سعيد', color: 'bg-green-50 text-green-600 border-green-200' },
    { emoji: '🤩', label: 'متحمس', color: 'bg-orange-50 text-orange-600 border-orange-200' },
    { emoji: '☕', label: 'قهوة تايم', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    { emoji: '🛠️', label: 'عمل جاد', color: 'bg-blue-50 text-blue-600 border-blue-200' },
    { emoji: '🤔', label: 'تفكير عميق', color: 'bg-purple-50 text-purple-600 border-purple-200' },
    { emoji: '😴', label: 'مرهق', color: 'bg-slate-50 text-slate-600 border-slate-200' },
];

export function MoodTracker() {
    const { firestore } = useFirebase();
    const { user } = useAuth();
    const { toast } = useToast();
    
    const [selectedMood, setSelectedMood] = useState(user?.currentMood || '😊');
    const [focus, setFocus] = useState(user?.currentFocus || '');
    const [isSaving, setIsSaving] = useState(false);

    const handleUpdate = async () => {
        if (!firestore || !user?.currentCompanyId) return;
        setIsSaving(true);
        try {
            const userPath = getTenantPath(`users/${user.id}`, user.currentCompanyId);
            await updateDoc(doc(firestore, userPath), {
                currentMood: selectedMood,
                currentFocus: focus,
                updatedAt: serverTimestamp()
            });
            toast({ title: 'تم تحديث حالتك', description: 'تظهر حالتك الآن لجميع الزملاء في المنظومة.' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تحديث الحالة اليومية.' });
        } finally { setIsSaving(false); }
    };

    return (
        <Card className="rounded-[2.8rem] border-none shadow-2xl bg-white/60 backdrop-blur-2xl overflow-hidden group hover:border-primary/20 transition-all border-2 border-transparent">
            <CardContent className="p-8 space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-center gap-10">
                    {/* اختيار الحالة */}
                    <div className="space-y-4 text-center md:text-right">
                        <Label className="font-black text-xs text-slate-400 uppercase tracking-widest mr-2 block">حالتك المزاجية</Label>
                        <div className="flex flex-wrap justify-center md:justify-start gap-4">
                            {moods.map((m) => (
                                <button
                                    key={m.emoji}
                                    type="button"
                                    onClick={() => setSelectedMood(m.emoji)}
                                    className={cn(
                                        "w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-3xl transition-all duration-300 hover:scale-110 active:scale-95",
                                        selectedMood === m.emoji 
                                            ? cn(m.color, "shadow-xl border-2 ring-4 ring-white") 
                                            : "bg-white/40 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 shadow-sm border border-white/60"
                                    )}
                                    title={m.label}
                                >
                                    {m.emoji}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* عنوان التركيز */}
                    <div className="flex-1 w-full space-y-4">
                        <Label className="font-black text-xs text-primary uppercase tracking-widest flex items-center gap-2 pr-1">
                            <Target className="h-4 w-4" /> ما هو تركيزك اليوم؟
                        </Label>
                        <div className="flex gap-3 bg-white p-1.5 rounded-[1.8rem] border-2 border-slate-100 shadow-inner group-focus-within:border-primary/30 transition-all">
                            <Input 
                                value={focus} 
                                onChange={e => setFocus(e.target.value)} 
                                placeholder="مثلاً: إنهاء مراجعة مخططات برج النور..."
                                className="h-12 rounded-2xl border-none shadow-none focus-visible:ring-0 font-bold text-lg bg-transparent"
                            />
                            <Button onClick={handleUpdate} disabled={isSaving} className="h-12 w-16 rounded-2xl font-black shadow-xl shadow-primary/20 bg-[#FF7A00] hover:bg-[#E66D00] transition-all">
                                {isSaving ? <Loader2 className="animate-spin h-5 w-5" /> : <Send className="h-5 w-5" />}
                            </Button>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
