'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
    Loader2, 
    ShieldCheck, 
    LogIn, 
    AlertCircle, 
    Send,
    ArrowRight,
    PlusCircle
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

/**
 * صفحة الدخول السيادية (Access Gateway V94.0):
 * تم تحصينها بمؤقت أمان (Safety Timeout) لمنع التعليق في حال بطء المزامنة.
 */
export default function LoginPage() {
  const { login, resetPassword, user, loading: globalLoading, error: authError } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [identifier, setIdentifier] = useState(''); 
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'forgot-password'>('login');
  const [localLoading, setLocalLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const redirectAttempted = useRef(false);

  // 🛡️ فك تجميد الشاشة التلقائي في حال التأخير الزائد
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (localLoading) {
        timer = setTimeout(() => {
            setLocalLoading(false);
            setErrorMsg('تأخر النظام في التعرف على هويتك. يرجى المحاولة مرة أخرى أو تحديث الصفحة.');
        }, 15000); // 10 ثوانٍ كحد أقصى للانتظار
    }
    return () => clearTimeout(timer);
  }, [localLoading]);

  // ⚡ التوجيه اللحظي الفوري فور استقرار حالة المستخدم
  useEffect(() => {
    if (user && !redirectAttempted.current) {
        redirectAttempted.current = true;
        setLocalLoading(false);
        const target = user.role === 'Developer' ? '/developer' : '/dashboard';
        router.replace(target);
    }
  }, [user, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (localLoading) return;
    
    setLocalLoading(true);
    setErrorMsg(null);

    try {
        await login(identifier.trim().toLowerCase(), password);
        // التوجيه سيتم آلياً عبر الـ useEffect أعلاه فور اكتمال جلب الملف من Firestore
    } catch (error: any) {
        setLocalLoading(false);
        setErrorMsg('بيانات الدخول غير صحيحة، يرجى التأكد من اسم المستخدم وكلمة المرور.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      if (localLoading || !identifier) return;
      setLocalLoading(true);
      try {
          await resetPassword(identifier.trim().toLowerCase());
          toast({ title: 'تم الإرسال', description: 'راجع بريدك لإعادة تعيين كلمة المرور.' });
          setMode('login');
      } catch (error: any) {
          setErrorMsg(error.message);
      } finally { setLocalLoading(false); }
  };

  if (user) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" dir="rtl">
      <Card className="w-full max-w-md rounded-[3rem] border-none shadow-2xl overflow-hidden glass-effect animate-in zoom-in-95 duration-500 relative z-10">
        <CardHeader className="py-12 px-8 text-center border-b border-orange-100 bg-white/20">
            <div className="bg-primary p-5 rounded-[2rem] w-fit mx-auto mb-6 shadow-xl shadow-orange-200 border-4 border-white">
                {mode === 'login' ? <ShieldCheck className="h-10 w-10 text-white" /> : <Send className="h-10 w-10 text-white" />}
            </div>
            <CardTitle className="text-4xl font-black text-slate-900 tracking-tighter">Nova ERP</CardTitle>
            <CardDescription className="text-primary font-black mt-2 uppercase tracking-widest text-[11px]">Corporate Suite</CardDescription>
        </CardHeader>
        
        <CardContent className="p-10 space-y-8 bg-white/20">
            {(errorMsg || authError) && (
                <Alert variant="destructive" className="rounded-2xl border-2 animate-in slide-in-from-top-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="text-[11px] font-black">تنبيه العبور</AlertTitle>
                    <AlertDescription className="text-[10px] font-bold">{errorMsg || authError}</AlertDescription>
                </Alert>
            )}

            {mode === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-8" autoComplete="off">
                    <div className="grid gap-3">
                        <Label className="font-black text-[11px] uppercase tracking-widest text-center text-slate-400">اسم المستخدم أو البريد</Label>
                        <Input 
                            value={identifier} 
                            onChange={(e) => setIdentifier(e.target.value)} 
                            className="h-14 rounded-2xl border-2 text-center font-black text-xl text-primary bg-white/60 focus:bg-white transition-all shadow-inner border-orange-50" 
                            required 
                            placeholder="Username / Email"
                            autoComplete="off"
                            disabled={localLoading}
                        />
                    </div>

                    <div className="grid gap-3">
                        <Label className="font-black text-[11px] uppercase tracking-widest text-center text-slate-400">كلمة المرور</Label>
                        <Input 
                            type="password" 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            className="h-14 rounded-2xl border-2 font-mono text-center text-2xl bg-white/60 focus:bg-white transition-all shadow-inner border-orange-50" 
                            required 
                            placeholder="••••••••"
                            autoComplete="new-password"
                            disabled={localLoading}
                        />
                        <div className="flex justify-center mt-1">
                             <button type="button" onClick={() => setMode('forgot-password')} className="text-xs font-bold text-primary hover:underline opacity-60 hover:opacity-100 transition-opacity">نسيت كلمة المرور؟</button>
                        </div>
                    </div>

                    <Button type="submit" disabled={localLoading} className="w-full h-16 rounded-[2.5rem] font-black text-2xl gap-4 shadow-xl shadow-orange-200 bg-primary text-white hover:scale-[1.02] active:scale-95 transition-all border-none">
                        {localLoading ? <Loader2 className="animate-spin h-6 w-6" /> : <LogIn className="h-6 w-6" />}
                        {localLoading ? 'جاري العبور...' : 'دخول للنظام'}
                    </Button>

                    <div className="pt-8 border-t border-orange-100 flex flex-col items-center">
                        <Button asChild variant="ghost" className="text-slate-500 font-bold gap-2 hover:bg-primary/5 rounded-xl h-10 px-6 transition-all group">
                            <Link href="/register">
                                <PlusCircle className="h-4 w-4 group-hover:rotate-90 transition-transform" />
                                اطلب انضمام منشأتك الآن
                            </Link>
                        </Button>
                    </div>
                </form>
            ) : (
                <form onSubmit={handleResetPassword} className="space-y-6" autoComplete="off">
                    <div className="grid gap-3">
                        <Label className="font-black text-[11px] uppercase tracking-widest text-center text-slate-400">البريد الإلكتروني المسجل</Label>
                        <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="h-14 rounded-2xl border-2 text-center font-bold text-lg border-orange-50 bg-white/60" required placeholder="your@email.com" autoComplete="off" />
                    </div>
                    <Button type="submit" disabled={localLoading} className="w-full h-14 rounded-2xl font-black text-lg gap-3">
                        {localLoading ? <Loader2 className="animate-spin h-5 w-5" /> : <Send className="h-5 w-5" />}
                        إإرسال رابط التعيين
                    </Button>
                    <button type="button" onClick={() => setMode('login')} className="w-full text-xs font-black opacity-50 flex items-center justify-center gap-2 hover:opacity-100">
                        <ArrowRight className="h-4 w-4 rotate-180" /> العودة للدخول
                    </button>
                </form>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
