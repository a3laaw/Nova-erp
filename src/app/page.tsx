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
    PlusCircle,
    UserCircle,
    KeyRound
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * بوابة الدخول السيادية (Sovereign Gateway V100.0)
 * تم تصميمها بدقة لتطابق الصورة المرفقة:
 * - الهيكل العائم (Floating Structure)
 * - الأيقونة البرتقالية المتوهجة
 * - الأزرار ثلاثية الأبعاد (3D Tactics)
 */
export default function LoginPage() {
  const { login, resetPassword, user, loading: globalLoading, error: authError } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [identifier, setIdentifier] = useState(''); 
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'forgot-password'>('login');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
          <p className="text-foreground font-black text-xl tracking-tighter">جاري استعادة الجلسة...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-white/50 relative overflow-hidden" dir="rtl">
      {/* خلفية النظام المنسابة تظهر من خلف الشفافية */}
      <Card className="w-full max-w-md rounded-[3.5rem] border-none shadow-[0_50px_100px_-20px_rgba(0,0,0,0.1)] overflow-hidden bg-white relative z-10 animate-in zoom-in-95 duration-700">
        
        <CardHeader className="py-12 px-8 text-center bg-transparent">
            {/* الأيقونة البرتقالية كما في الصورة */}
            <div className="bg-[#FF7A00] p-6 rounded-[2.2rem] w-fit mx-auto mb-6 shadow-[0_15px_35px_rgba(255,122,0,0.4)] border-4 border-white/20 transition-transform hover:scale-105 duration-500">
                <LogIn className="h-10 w-10 text-white" />
            </div>
            
            <CardTitle className="text-4xl font-black text-[#1e1b4b] tracking-tighter">Nova ERP</CardTitle>
            <CardDescription className="text-[#FF7A00] font-black mt-2 text-xs">بوابة تسجيل الدخول</CardDescription>
        </CardHeader>
        
        <CardContent className="px-10 pb-12 space-y-8">
            {authError && (
                <Alert variant="destructive" className="rounded-2xl border-2 animate-in shake-x duration-500">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs font-bold">{authError}</AlertDescription>
                </Alert>
            )}

            {mode === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-8" autoComplete="off">
                    <div className="grid gap-3">
                        <Label className="font-black text-[11px] uppercase tracking-widest text-center text-slate-400">البريد الإلكتروني أو اسم المستخدم</Label>
                        <Input 
                            value={identifier} 
                            onChange={(e) => setIdentifier(e.target.value)} 
                            className="h-14 rounded-2xl border-2 border-slate-50 text-center font-bold text-base bg-[#F8F9FB] focus:bg-white focus:border-primary/20 transition-all shadow-inner" 
                            required 
                            placeholder="Email / User ID"
                            autoComplete="off"
                        />
                    </div>

                    <div className="grid gap-3">
                        <Label className="font-black text-[11px] uppercase tracking-widest text-center text-slate-400">كلمة المرور</Label>
                        <Input 
                            type="password" 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            className="h-14 rounded-2xl border-2 border-slate-50 text-center font-bold text-base bg-[#F8F9FB] focus:bg-white focus:border-primary/20 transition-all shadow-inner" 
                            required 
                            placeholder="••••••••"
                            autoComplete="new-password"
                        />
                        <div className="flex justify-center">
                             <button type="button" onClick={() => setMode('forgot-password')} className="text-xs font-black text-primary/60 hover:text-primary transition-colors">نسيت كلمة المرور؟</button>
                        </div>
                    </div>

                    <Button type="submit" disabled={isSubmitting} className="w-full h-16 rounded-[2.5rem] font-black text-2xl gap-4 shadow-[0_15px_30px_rgba(255,122,0,0.3)] bg-[#FF7A00] hover:bg-[#E66D00] text-white border-none transition-all active:scale-95 group">
                        {isSubmitting ? <Loader2 className="animate-spin h-6 w-6" /> : "دخول للنظام"}
                        {!isSubmitting && <LogIn className="h-6 w-6 group-hover:translate-x-1 transition-transform" />}
                    </Button>

                    <div className="pt-8 flex flex-col items-center">
                        <Button asChild variant="ghost" className="text-slate-400 font-black gap-2 rounded-xl h-10 px-6 group hover:bg-slate-50 hover:text-primary">
                            <Link href="/register" className="flex items-center gap-2">
                                <PlusCircle className="h-4 w-4 opacity-40 group-hover:rotate-90 transition-all" />
                                اطلب انضمام منشأتك الآن
                            </Link>
                        </Button>
                    </div>
                </form>
            ) : (
                <form onSubmit={handleResetPassword} className="space-y-6" autoComplete="off">
                    <div className="grid gap-3">
                        <Label className="font-black text-[11px] uppercase tracking-widest text-center text-slate-400">البريد الإلكتروني المسجل</Label>
                        <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="h-14 rounded-2xl border-2 text-center font-bold text-lg shadow-inner bg-[#F8F9FB]" required placeholder="your@email.com" autoComplete="off" />
                    </div>
                    <Button type="submit" disabled={isSubmitting} className="w-full h-14 rounded-2xl font-black text-lg gap-3 bg-[#FF7A00] hover:bg-[#E66D00] shadow-xl">
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
  );
}
