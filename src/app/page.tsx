
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Loader2,
    LogIn,
    AlertCircle,
    Send,
    ArrowRight,
    User,
    Building2,
    Sparkles,
    LogOut,
    UserCheck
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';

function ParticleBackground() {
    const [particles, setParticles] = useState<any[]>([]);
    useEffect(() => {
        const p = Array.from({ length: 25 }).map((_, i) => ({
            id: i,
            size: `${Math.random() * 3 + 1}px`,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            duration: `${Math.random() * 5 + 5}s`,
            delay: `${Math.random() * 5}s`,
        }));
        setParticles(p);
    }, []);

    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
            {particles.map((p) => (
                <div
                    key={p.id}
                    className="particle"
                    style={{
                        width: p.size,
                        height: p.size,
                        left: p.left,
                        top: p.top,
                        animation: `float-particle ${p.duration} linear infinite`,
                        animationDelay: p.delay
                    }}
                />
            ))}
        </div>
    );
}

export default function LoginPage() {
    const { login, logout, resetPassword, user, loading: authIsLoading } = useAuth();
    const { firestore } = useFirebase();
    const router = useRouter();
    const { toast } = useToast();

    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [mode, setMode] = useState<'login' | 'forgot-password'>('login');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);
    const [authStatus, setAuthStatus] = useState<'checking' | 'session-found' | 'no-session'>('checking');

    useEffect(() => {
        if (user && authStatus === 'no-session') {
            const target = user.role === 'Developer' ? '/developer' : '/dashboard';
            router.replace(target);
        }
    }, [user, authStatus, router]);
    
    useEffect(() => {
        if (!authIsLoading) {
            if (user) {
                setAuthStatus('session-found');
            } else {
                setAuthStatus('no-session');
            }
        }
    }, [authIsLoading, user]);

    const handleAutoLogin = useCallback(() => {
        if (user) {
            const target = user.role === 'Developer' ? '/developer' : '/dashboard';
            router.replace(target);
        }
    }, [user, router]);

    const handleForceLogout = useCallback(async () => {
        await logout();
        setAuthStatus('no-session');
    }, [logout]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);
        setLocalError(null);
        try {
            let loginEmail = identifier.trim().toLowerCase();
            if (!loginEmail.includes('@') && firestore) {
                const q = query(collection(firestore, 'global_users'), where('username', '==', loginEmail), limit(1));
                const snapshot = await getDocs(q);
                if (snapshot.empty) throw new Error("عذراً، اسم المستخدم غير مسجل.");
                loginEmail = snapshot.docs[0].data().email;
            }
            await login(loginEmail, password);
        } catch (error: any) {
            setLocalError(error.message);
            setIsSubmitting(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await resetPassword(identifier);
            toast({ title: 'تم الإرسال', description: 'راجع بريدك لإعادة تعيين كلمة المرور.' });
            setMode('login');
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'تأكد من البيانات المدخلة.' });
        } finally { setIsSubmitting(false); }
    };

    if (authStatus === 'checking') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#fdfaf3] relative overflow-hidden" dir="rtl">
                <ParticleBackground />
                <main className="relative z-10 flex flex-col items-center justify-center w-full px-6">
                    <div className="nova-image-container animate-pulse-nova relative w-full max-w-md">
                        <img alt="Nova Nebula" className="w-full h-auto" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAAwUtP2b2CToLjUJ8eDO6iwFczMu5EfgTZXtRhviSqh4p1FZk1EdVK4Mt4nVqBsE5dqYeVMu8ZKJccZdK7tbyOKef7DJvuqjqe3C91u1shEfJJuzX7cQxegYjwyQSlROGi81TaZaihR3hTDDdmUNS0FDGQ03jl0t-q9xzfNX45G0VAEsH9UjbL1QtLp57Dea6Tfs2ENlRLLWbeZoAkkxautawwahzzBFDgFtEH18arUAkbMW9w5QAyhMiJrflIscMibtocPoyrR_o8" />
                    </div>
                </main>
                <footer className="fixed bottom-16 flex flex-col items-center gap-4 z-10">
                     <div className="flex items-center gap-3">
                         <span className="text-[#ea580c] text-xl font-bold tracking-wide">جاري التحقق من الهوية...</span>
                         <div className="dot-loader flex gap-1 pt-1"><span></span><span></span><span></span></div>
                     </div>
                </footer>
            </div>
        );
    }

    if (authStatus === 'session-found' && user) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-[#fdfaf3] relative overflow-hidden" dir="rtl">
                <ParticleBackground />
                <div className="relative z-10 w-full max-w-md mx-auto">
                    <Card className="w-full rounded-[3.5rem] border-none shadow-2xl bg-white/95 backdrop-blur-2xl">
                        <CardHeader className="py-10 px-8 text-center">
                            <div className="bg-gradient-to-br from-[#10b981] to-[#059669] p-6 rounded-[2.2rem] w-fit mx-auto mb-6 shadow-xl border-4 border-white/30">
                                <UserCheck className="h-10 w-10 text-white" />
                            </div>
                            <CardTitle className="text-4xl font-black text-[#1e1b4b] tracking-tighter">أهلاً بعودتك</CardTitle>
                            <CardDescription className="text-2xl font-bold text-slate-500 mt-2">{user.username || user.email}</CardDescription>
                        </CardHeader>
                        <CardContent className="px-10 pb-8 space-y-4">
                            <Button onClick={handleAutoLogin} className="w-full h-16 rounded-2xl font-black text-2xl gap-4 shadow-xl bg-gradient-to-r from-[#e87c24] to-[#FFB000] text-white">
                                متابعة <ArrowRight className="h-6 w-6 transition-transform rotate-180" />
                            </Button>
                            <Button onClick={handleForceLogout} variant="ghost" className="w-full h-12 rounded-2xl font-bold text-sm text-slate-500 gap-2">
                                <LogOut className="h-5 w-5" /> تسجيل الدخول كمستخدم آخر
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }
    
    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-[#fdfaf3] relative overflow-hidden" dir="rtl">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#e87c24]/5 rounded-full blur-[100px]" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#e87c24]/5 rounded-full blur-[100px]" />

            <div className="p-1 rounded-[3.8rem] bg-gradient-to-br from-[#FFB000] to-[#e87c24] shadow-2xl relative z-10">
                <Card className="w-full max-w-md rounded-[3.5rem] border-none bg-white/95 backdrop-blur-2xl">
                    <CardHeader className="py-10 px-8 text-center">
                         <div className="bg-gradient-to-br from-[#e87c24] to-[#c26514] p-6 rounded-[2.2rem] w-fit mx-auto mb-6 shadow-xl">
                            <LogIn className="h-10 w-10 text-white" />
                        </div>
                        <CardTitle className="text-4xl font-black text-[#1e1b4b] tracking-tighter">Nova</CardTitle>
                        <CardDescription className="text-[#e87c24] font-black mt-2 text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                            <Sparkles className="h-3 w-3" /> دخول الموظفين
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="px-10 pb-8 space-y-8">
                        {localError && (
                            <Alert variant="destructive" className="rounded-2xl border-2"><AlertCircle className="h-4 w-4" /><AlertDescription className="text-xs font-bold">{localError}</AlertDescription></Alert>
                        )}
                        {mode === 'login' ? (
                            <form onSubmit={handleLogin} className="space-y-8" autoComplete="off">
                                <div className="grid gap-3">
                                    <Label className="font-black text-[11px] uppercase tracking-widest text-center text-slate-400">اسم المستخدم</Label>
                                    <div className="relative">
                                        <User className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                                        <Input 
                                            value={identifier} 
                                            onChange={(e) => setIdentifier(e.target.value)} 
                                            className="h-14 rounded-2xl border-2 border-slate-100 text-center font-black text-lg bg-[#F8F9FB]/50 pr-12" 
                                            required 
                                            placeholder="Username / ID" 
                                            autoComplete="username" 
                                            disabled={isSubmitting} 
                                        />
                                    </div>
                                </div>
                                <div className="grid gap-3">
                                    <Label className="font-black text-[11px] uppercase tracking-widest text-center text-slate-400">كلمة المرور</Label>
                                    <Input 
                                        type="password" 
                                        value={password} 
                                        onChange={e => setPassword(e.target.value)} 
                                        className="h-14 rounded-2xl border-2 border-slate-100 text-center font-bold text-base bg-[#F8F9FB]/50" 
                                        required 
                                        placeholder="••••••••" 
                                        autoComplete="current-password" 
                                        disabled={isSubmitting} 
                                    />
                                </div>
                                <div className="space-y-4">
                                    <Button type="submit" disabled={isSubmitting} className="w-full h-16 rounded-[2.5rem] font-black text-2xl gap-4 shadow-xl bg-gradient-to-r from-[#e87c24] to-[#FFB000] text-white">
                                        {isSubmitting ? <Loader2 className="animate-spin h-6 w-6" /> : "دخول"}
                                        {!isSubmitting && <ArrowRight className="h-6 w-6 transition-transform rotate-180" />}
                                    </Button>
                                    <div className="flex flex-col items-center gap-4">
                                        <button type="button" onClick={() => setMode('forgot-password')} className="text-xs font-black text-slate-400 hover:text-[#e87c24]">نسيت كلمة المرور؟</button>
                                        <Separator className="w-1/2" />
                                        <div className="text-center pt-2">
                                            <p className="text-[10px] font-bold text-slate-400 mb-3">هل تملك شركة؟</p>
                                            <Button asChild variant="outline" className="h-12 px-10 rounded-2xl border-2 border-orange-200 text-[#e87c24] font-black text-sm">
                                                <Link href="/register"><Building2 className="h-5 w-5 ml-2" /> طلب فتح حساب شركة</Link>
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        ) : (
                            <form onSubmit={handleResetPassword} className="space-y-6">{/* ... Reset Password Form ... */}</form>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
