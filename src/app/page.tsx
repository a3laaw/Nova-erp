'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';

/**
 * جزيئات غبار النجوم (Stardust Blast Engine):
 * لضمان تناسق شاشة التحميل في كافة المسارات.
 */
const Stardust = () => (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 24 }).map((_, i) => (
            <div 
                key={i} 
                className="stardust-particle"
                style={{
                    top: '50%',
                    left: '50%',
                    '--tw-translate-x': `${(Math.random() - 0.5) * 600}px`,
                    '--tw-translate-y': `${(Math.random() - 0.5) * 600}px`,
                    animationDelay: `${Math.random() * 3}s`,
                    width: '2px',
                    height: '2px'
                } as any}
            />
        ))}
    </div>
);

export default function LoginPage() {
  const { login, resetPassword, user, logout, loading: globalLoading, error: authError } = useAuth();
  const { firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  const [identifier, setIdentifier] = useState(''); 
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'forgot-password'>('login');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
        const target = user.role === 'Developer' ? '/developer' : '/dashboard';
        router.replace(target);
    }
  }, [user, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    setLocalError(null);

    try {
        let loginEmail = identifier.trim().toLowerCase();

        if (!loginEmail.includes('@') && firestore) {
            const globalUsersRef = collection(firestore, 'global_users');
            const q = query(globalUsersRef, where('username', '==', loginEmail), limit(1));
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

  if (globalLoading && !isSubmitting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FFFDF0] relative overflow-hidden" dir="rtl">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] nova-glow-nebula rounded-full" />
          <Stardust />

          <div className="relative flex flex-col items-center justify-center">
              <div className="relative flex items-center justify-center w-64 h-64">
                  <div className="absolute inset-0 rounded-full border-[1.5px] border-slate-200/30" />
                  <div className="nova-plasma-ring" />
                  <div className="relative z-20 nova-text-glow">
                      <span className="text-5xl font-black tracking-widest text-[#FF7A00] drop-shadow-lg">NOVA</span>
                  </div>
              </div>
              
              <div className="mt-16 text-center space-y-4 relative z-10">
                  <div className="flex items-center justify-center gap-3">
                      <div className="flex gap-1.5 pt-2 order-2">
                          <div className="h-2 w-2 bg-[#FF7A00] rounded-full animate-bounce-dots" style={{ animationDelay: '0s' }} />
                          <div className="h-2 w-2 bg-[#FFB000] rounded-full animate-bounce-dots" style={{ animationDelay: '0.2s' }} />
                          <div className="h-2 w-2 bg-[#E66D00] rounded-full animate-bounce-dots" style={{ animationDelay: '0.4s' }} />
                      </div>
                      <p className="text-[#1e1b4b] font-black text-xl tracking-tight opacity-90 order-1">جاري التحميل</p>
                  </div>
              </div>
          </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-white/10 relative overflow-hidden" dir="rtl">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#FFB000]/5 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#FF7A00]/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="p-1 rounded-[3.8rem] bg-gradient-to-br from-[#FFB000] to-[#FF7A00] shadow-2xl animate-in zoom-in-95 duration-1000 relative z-10">
        <Card className="w-full max-md rounded-[3.5rem] border-none shadow-none overflow-hidden bg-white/95 backdrop-blur-2xl relative">
            <CardHeader className="py-10 px-8 text-center">
                <div className="bg-gradient-to-br from-[#FF7A00] to-[#E66D00] p-6 rounded-[2.2rem] w-fit mx-auto mb-6 shadow-xl border-4 border-white/30 transition-transform hover:scale-105 duration-500">
                    <LogIn className="h-10 w-10 text-white" />
                </div>
                <CardTitle className="text-4xl font-black text-[#1e1b4b] tracking-tighter">Nova ERP</CardTitle>
                <CardDescription className="text-[#FF7A00] font-black mt-2 text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                    <Sparkles className="h-3 w-3 animate-pulse" />
                    بوابة الموظفين والمديرين
                </CardDescription>
            </CardHeader>
            <CardContent className="px-10 pb-8 space-y-8">
                {(authError || localError) && (
                    <Alert variant="destructive" className="rounded-2xl border-2 animate-in shake-x">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs font-bold">{localError || authError}</AlertDescription>
                    </Alert>
                )}

                {mode === 'login' ? (
                    <form onSubmit={handleLogin} className="space-y-8" autoComplete="off">
                        <div className="grid gap-3">
                            <Label className="font-black text-[11px] uppercase tracking-widest text-center text-slate-400">اسم المستخدم أو البريد المعتمد</Label>
                            <div className="relative group">
                                <User className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-orange-500 transition-colors" />
                                <Input 
                                    value={identifier} 
                                    onChange={(e) => setIdentifier(e.target.value)} 
                                    className="h-14 rounded-2xl border-2 border-slate-100 text-center font-black text-lg bg-[#F8F9FB]/50 focus:bg-white focus:border-orange-500/30 transition-all shadow-inner pr-12" 
                                    required 
                                    placeholder="Username / ID"
                                    autoComplete="off"
                                />
                            </div>
                        </div>

                        <div className="grid gap-3">
                            <Label className="font-black text-[11px] uppercase tracking-widest text-center text-slate-400">كلمة المرور</Label>
                            <Input 
                                type="password" 
                                value={password} 
                                onChange={e => setPassword(e.target.value)} 
                                className="h-14 rounded-2xl border-2 border-slate-100 text-center font-bold text-base bg-[#F8F9FB]/50 focus:bg-white focus:border-orange-500/30 shadow-inner" 
                                required 
                                placeholder="••••••••"
                                autoComplete="current-password"
                            />
                        </div>

                        <div className="space-y-4">
                            <Button type="submit" className="w-full h-16 rounded-[2.5rem] font-black text-2xl gap-4 shadow-xl bg-gradient-to-r from-[#FF7A00] to-[#FFB000] text-white border-none transition-all active:scale-95 group">
                                {isSubmitting ? <Loader2 className="animate-spin h-6 w-6" /> : "دخول النظام"}
                                {!isSubmitting && <ArrowRight className="h-6 w-6 group-hover:translate-x-1 transition-transform rotate-180" />}
                            </Button>
                            
                            <div className="flex flex-col items-center gap-4">
                                <button type="button" onClick={() => setMode('forgot-password')} className="text-xs font-black text-slate-400 hover:text-[#FF7A00] transition-colors">نسيت كلمة المرور؟</button>
                                
                                <Separator className="w-1/2 opacity-10" />
                                
                                <div className="text-center pt-2">
                                    <p className="text-[10px] font-bold text-slate-400 mb-3">هل تملك مكتباً هندسياً أو شركة مقاولات؟</p>
                                    <Button asChild variant="outline" className="h-12 px-10 rounded-2xl border-2 border-orange-200 text-[#FF7A00] font-black text-sm gap-2 hover:bg-orange-50 shadow-sm transition-all">
                                        <Link href="/register">
                                            <Building2 className="h-5 w-5" />
                                            طلب انضمام منشأة جديدة
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </form>
                ) : (
                    <form onSubmit={handleResetPassword} className="space-y-6">
                        <div className="grid gap-3">
                            <Label className="font-black text-[11px] uppercase tracking-widest text-center text-slate-400">البريد المربوط بحسابك</Label>
                            <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="h-14 rounded-2xl border-2 text-center font-bold text-lg shadow-inner bg-[#F8F9FB]" required placeholder="your@email.com" />
                        </div>
                        <Button type="submit" disabled={isSubmitting} className="w-full h-14 rounded-2xl font-black text-lg gap-3 bg-gradient-to-r from-[#FF7A00] to-[#FFB000] text-white shadow-xl">
                            {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : <Send className="h-5 w-5" />}
                            إرسال رابط التعيين
                        </Button>
                        <button type="button" onClick={() => setMode('login')} className="w-full text-xs font-black opacity-50 flex items-center justify-center gap-2 hover:opacity-100 transition-opacity">
                            <ArrowRight className="h-4 w-4 rotate-180" /> العودة للدخول
                        </button>
                    </form>
                )}
            </CardContent>
        </Card>
      </div>
    </div>
  );
}