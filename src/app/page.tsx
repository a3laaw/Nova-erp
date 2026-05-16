'use client';

import { useState, useEffect } from 'react';
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
 * بوابة الدخول السيادية الموحدة (User Interface Restoration V97.0)
 * - تم تصفير كافة الحقول لتمكين العميل من إدخال بياناته.
 * - تبسيط لغة "جاري الدخول" لتكون سهلة وودودة.
 */
export default function LoginPage() {
  const { login, resetPassword, user, loading: globalLoading, error: authError } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [identifier, setIdentifier] = useState(''); 
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'forgot-password'>('login');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // التوجيه التلقائي بمجرد نجاح المصادقة
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
    try {
        await login(identifier, password);
    } catch (error: any) {
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
          toast({ variant: 'destructive', title: 'خطأ', description: 'تأكد من البريد الإلكتروني.' });
      } finally { setIsSubmitting(false); }
  };

  if (globalLoading && !isSubmitting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background" dir="rtl">
          <div className="relative">
              <div className="h-20 w-20 rounded-full border-4 border-primary/10 border-t-primary animate-spin" />
              <ShieldCheck className="h-8 w-8 text-primary absolute inset-0 m-auto animate-pulse" />
          </div>
          <p className="text-foreground font-black text-xl tracking-tighter">جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" dir="rtl">
      <Card className="w-full max-w-md rounded-[3rem] border-none shadow-2xl overflow-hidden glass-effect relative z-10 animate-in zoom-in-95 duration-500">
        <CardHeader className="py-12 px-8 text-center border-b border-white/10 bg-white/20">
            <div className="bg-primary p-5 rounded-[2rem] w-fit mx-auto mb-6 shadow-xl shadow-primary/20 border-4 border-white/40">
                {mode === 'login' ? <LogIn className="h-10 w-10 text-white" /> : <Send className="h-10 w-10 text-white" />}
            </div>
            <CardTitle className="text-4xl font-black text-slate-900 tracking-tighter">Nova ERP</CardTitle>
            <CardDescription className="text-primary font-black mt-2 uppercase tracking-widest text-[11px]">بوابة تسجيل الدخول</CardDescription>
        </CardHeader>
        
        <CardContent className="p-10 space-y-8 bg-white/20">
            {authError && (
                <Alert variant="destructive" className="rounded-2xl border-2 animate-in shake-x duration-500">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="text-[11px] font-black">تنبيه</AlertTitle>
                    <AlertDescription className="text-[10px] font-bold">{authError}</AlertDescription>
                </Alert>
            )}

            {mode === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-8">
                    <div className="grid gap-3">
                        <Label className="font-black text-[11px] uppercase tracking-widest text-center text-slate-500">البريد الإلكتروني أو اسم المستخدم</Label>
                        <Input 
                            value={identifier} 
                            onChange={(e) => setIdentifier(e.target.value)} 
                            className="h-14 rounded-2xl border-2 text-center font-black text-xl text-primary bg-white/60 focus:bg-white transition-all shadow-inner" 
                            required 
                            placeholder="Email / User ID"
                        />
                    </div>

                    <div className="grid gap-3">
                        <Label className="font-black text-[11px] uppercase tracking-widest text-center text-slate-500">كلمة المرور</Label>
                        <Input 
                            type="password" 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            className="h-14 rounded-2xl border-2 font-mono text-center text-2xl bg-white/60 focus:bg-white transition-all shadow-inner" 
                            required 
                            placeholder="••••••••"
                        />
                        <div className="flex justify-center mt-1">
                             <button type="button" onClick={() => setMode('forgot-password')} className="text-xs font-bold text-primary hover:underline opacity-60">نسيت كلمة المرور؟</button>
                        </div>
                    </div>

                    <Button type="submit" disabled={isSubmitting} className="w-full h-16 rounded-[2.5rem] font-black text-2xl gap-4 shadow-xl shadow-primary/20 bg-primary text-white border-none transition-all active:scale-95">
                        {isSubmitting ? <Loader2 className="animate-spin h-6 w-6" /> : <LogIn className="h-6 w-6" />}
                        {isSubmitting ? "جاري الدخول..." : "دخول للنظام"}
                    </Button>

                    <div className="pt-8 border-t border-white/10 flex flex-col items-center">
                        <Button asChild variant="ghost" className="text-slate-500 font-bold gap-2 rounded-xl h-10 px-6 group">
                            <Link href="/register">
                                <PlusCircle className="h-4 w-4 group-hover:rotate-90 transition-transform" />
                                اطلب انضمام منشأتك الآن
                            </Link>
                        </Button>
                    </div>
                </form>
            ) : (
                <form onSubmit={handleResetPassword} className="space-y-6">
                    <div className="grid gap-3">
                        <Label className="font-black text-[11px] uppercase tracking-widest text-center text-slate-500">البريد الإلكتروني المسجل</Label>
                        <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="h-14 rounded-2xl border-2 text-center font-bold text-lg shadow-inner bg-white/60" required placeholder="your@email.com" />
                    </div>
                    <Button type="submit" disabled={isSubmitting} className="w-full h-14 rounded-2xl font-black text-lg gap-3">
                        {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : <Send className="h-5 w-5" />}
                        إرسال رابط التعيين
                    </Button>
                    <button type="button" onClick={() => setMode('login')} className="w-full text-xs font-black opacity-50 flex items-center justify-center gap-2">
                        <ArrowRight className="h-4 w-4 rotate-180" /> العودة للدخول
                    </button>
                </form>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
