'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { doc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, Sparkles, Target } from 'lucide-react';
import { cn, getTenantPath } from '@/lib/utils';

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
            toast({ title: 'تم تحديث حالتك', description: 'سيتم ظهورها لزملائك الآن.' });
        } finally { setIsSaving(false); }
    };

    return (
        <Card className="rounded-[2.5rem] border-none shadow-xl bg-white/60 backdrop-blur-xl overflow-hidden group hover:border-primary/20 transition-all border-2 border-transparent">
            <CardContent className="p-8 space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex flex-wrap justify-center gap-3">
                        {moods.map((m) => (
                            <button
                                key={m.emoji}
                                type="button"
                                onClick={() => setSelectedMood(m.emoji)}
                                className={cn(
                                    "w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-all hover:scale-110",
                                    selectedMood === m.emoji ? cn(m.color, "shadow-lg border-2") : "bg-white/40 grayscale opacity-40 hover:grayscale-0 hover:opacity-100"
                                )}
                                title={m.label}
                            >
                                {m.emoji}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 w-full space-y-3">
                        <Label className="font-black text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                            <Target className="h-3 w-3 text-primary" /> ما هو تركيزك اليوم؟
                        </Label>
                        <div className="flex gap-2">
                            <Input 
                                value={focus} 
                                onChange={e => setFocus(e.target.value)} 
                                placeholder="مثلاً: إنهاء مراجعة مخططات برج النور..."
                                className="h-12 rounded-2xl border-2 bg-white/50 focus:bg-white font-bold"
                            />
                            <Button onClick={handleUpdate} disabled={isSaving} className="h-12 rounded-xl px-8 font-black shadow-lg shadow-primary/20">
                                {isSaving ? <Loader2 className="animate-spin" /> : <Send className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

import { Label } from '../ui/label';
