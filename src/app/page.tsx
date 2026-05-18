
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
    User
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

const NELogo = () => (
  <svg width="120" height="120" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-pulse">
    <circle cx="100" cy="100" r="90" fill="white" fillOpacity="0.1" />
    <path d="M50 150V50L100 150V50" stroke="#FF7A00" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M120 50H170V80H120V110H160V140H120V170H170" stroke="#FFB000" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M180 20L195 40L180 60" fill="#FFB000" />
    <path d="M20 180L5 160L20 140" fill="#FF7A00" />
  </svg>
);

export default function LoginPage() {
  const { login, resetPassword, user, loading: globalLoading, error: authError } = useAuth();
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
      <div className="min-h-screen flex flex-col items-center justify-center gap-8 bg-[#FFFDF0]" dir="rtl">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-primary/20 rounded-full blur-[100px] animate-pulse" />
          <div className="relative">
              <div className="h-24 w-24 rounded-full border-4 border-primary/10 border-t-primary animate-spin shadow-[0_0_40px_rgba(255,122,0,0.2)]" />
              <div className="absolute inset-0 m-auto flex flex-col items-center justify-center">
                  <NELogo />
              </div>
          </div>
          <p className="text-[#1e1b4b] font-black text-xl tracking-tighter">جاري فتح جلسة العمل...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-white/10 relative overflow-hidden" dir="rtl">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#FFB000]/10 rounded-full blur-[100px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#FF7A00]/10 rounded-full blur-[100px] animate-pulse" />

      <div className="p-1.5 rounded-[3.8rem] bg-gradient-to-br from-[#FFB000] to-[#FF7A00] shadow-[0_25px_80px_-15px_rgba(255,122,0,0.25)] animate-in zoom-in-95 duration-1000 relative z-10">
        <Card className="w-full max-w-md rounded-[3.5rem] border-none shadow-none overflow-hidden bg-white/95 backdrop-blur-2xl relative">
            <CardHeader className="py-10 px-8 text-center">
                <div className="bg-gradient-to-br from-[#FF7A00] to-[#E66D00] p-6 rounded-[2.2rem] w-fit mx-auto mb-6 shadow-xl border-4 border-white/30 transition-transform hover:scale-105 duration-500">
                    <LogIn className="h-10 w-10 text-white" />
                </div>
                <CardTitle className="text-4xl font-black text-[#1e1b4b] tracking-tighter">Nova ERP</CardTitle>
                <CardDescription className="text-[#FF7A00] font-black mt-2 text-xs uppercase tracking-[0.2em]">بوابة الموظفين والمديرين</CardDescription>
            </CardHeader>
            <CardContent className="px-10 pb-12 space-y-8">
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
                            <div className="relative">
                                <User className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                                <Input 
                                    value={identifier} 
                                    onChange={(e) => setIdentifier(e.target.value)} 
                                    className="h-14 rounded-2xl border-2 border-slate-100 text-center font-black text-lg bg-[#F8F9FB]/50 focus:bg-white focus:border-primary/30 transition-all shadow-inner pr-12" 
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
                                className="h-14 rounded-2xl border-2 border-slate-100 text-center font-bold text-base bg-[#F8F9FB]/50 focus:bg-white focus:border-primary/30 shadow-inner" 
                                required 
                                placeholder="••••••••"
                                autoComplete="current-password"
                            />
                        </div>

                        <Button type="submit" disabled={isSubmitting} className="w-full h-16 rounded-[2.5rem] font-black text-2xl gap-4 shadow-xl bg-gradient-to-r from-[#FF7A00] to-[#FFB000] text-white border-none transition-all active:scale-95 group">
                            {isSubmitting ? <Loader2 className="animate-spin h-6 w-6" /> : "دخول النظام"}
                            {!isSubmitting && <ArrowRight className="h-6 w-6 group-hover:translate-x-1 transition-transform rotate-180" />}
                        </Button>
                        <div className="text-center">
                            <button type="button" onClick={() => setMode('forgot-password')} className="text-xs font-black text-primary/70 hover:text-primary transition-colors">نسيت كلمة المرور؟</button>
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
