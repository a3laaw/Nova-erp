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
    Sparkles
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';

/**
 * شعار نوفا المدمج (NOVA Simple Text):
 * تصميم فخم وبسيط يتناسب مع التوهج الذهبي.
 */
const NovaLogo = () => (
  <svg width="140" height="60" viewBox="0 0 160 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <text 
      x="50%" 
      y="60%" 
      dominantBaseline="middle" 
      textAnchor="middle" 
      fontFamily="inherit" 
      fontWeight="900" 
      fontSize="42" 
      fill="#FF7A00"
      style={{ filter: 'drop-shadow(0px 0px 8px rgba(255,122,0,0.3))' }}
    >
      NOVA
    </text>
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
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-[#FF7A00]/5 rounded-full blur-[100px]" />
          <div className="relative flex flex-col items-center gap-8">
              {/* 🛡️ تكبير الحلقة لمنع التداخل مع الكلمة 🛡️ */}
              <div className="h-40 w-40 rounded-full border-2 border-primary/10 border-t-primary animate-spin shadow-[0_0_40px_rgba(255,122,0,0.1)]" />
              
              {/* نص NOVA في المنتصف المعزول تماماً */}
              <div className="absolute inset-0 m-auto flex flex-col items-center justify-center mb-8">
                  <NovaLogo />
              </div>

              {/* النص الكحلي بالأسفل بمسافة كافية */}
              <p className="text-[#1e1b4b] font-black text-2xl tracking-tighter mt-4">جاري التحميل...</p>
          </div>
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
