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
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import Link from 'next/link';

/**
 * بوابة العبور الموحدة (Sovereign Login Gateway V55.0).
 * تم التطهير البصري: إخفاء شريط التمرير، وتوسيط المحتوى، ومنع الإكمال التلقائي تماماً.
 */
export default function LoginPage() {
  const { login, resetPassword, user, loading } = useAuth();
  const { firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  const [identifier, setIdentifier] = useState(''); 
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'forgot-password'>('login');
  const [localLoading, setLocalLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user && !loading) {
        const target = user.role === 'Developer' ? '/developer' : '/dashboard';
        router.replace(target);
    }
  }, [user, loading, router]);

  const resolveEmail = async (id: string) => {
      const input = id.trim().toLowerCase();
      if (input === 'alaa' || input === 'alaawaaheeb@gmail.com') return 'alaawaaheeb@gmail.com';
      if (input.includes('@')) return input;
      
      if (firestore) {
          try {
              const q = query(collection(firestore, 'global_users'), where('username', '==', input), limit(1));
              const snap = await getDocs(q);
              if (!snap.empty) return snap.docs[0].data().email;
          } catch (e) { 
              console.warn("Username resolving skipped."); 
          }
      }
      return input;
  };

  const handleIdentifierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setIdentifier(val);
      if (val === '') {
          setPassword('');
      }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (localLoading) return;
    setLocalLoading(true);
    setErrorMsg(null);

    try {
        const finalEmail = await resolveEmail(identifier);
        await login(finalEmail, password);
    } catch (error: any) {
        setLocalLoading(false);
        let msg = 'بيانات الدخول غير صحيحة.';
        if (error.code === 'auth/invalid-credential') {
            msg = 'خطأ أمني: بيانات الدخول لا تطابق السجلات.';
        }
        setErrorMsg(msg);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      if (localLoading || !identifier) return;
      setLocalLoading(true);
      try {
          const finalEmail = await resolveEmail(identifier);
          await resetPassword(finalEmail);
          toast({ title: 'تم الإرسال', description: 'راجع بريدك الإلكتروني لتعيين كلمة مرور جديدة.' });
          setMode('login');
      } catch (error: any) {
          setErrorMsg(error.message);
      } finally { setLocalLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" dir="rtl">
      <Card className="w-full max-w-md rounded-[3rem] border-none shadow-2xl overflow-hidden glass-effect animate-in zoom-in-95 duration-500 relative z-10">
        <CardHeader className="py-12 px-8 text-center border-b border-black/5">
            <div className="bg-white p-5 rounded-[2rem] w-fit mx-auto mb-6 shadow-xl border border-slate-100">
                {mode === 'login' ? <ShieldCheck className="h-12 w-12 text-primary" /> : <Send className="h-12 w-12 text-primary" />}
            </div>
            <CardTitle className="text-4xl font-black text-slate-900 tracking-tighter">Nova ERP</CardTitle>
            <CardDescription className="text-slate-500 font-bold mt-2 uppercase tracking-widest text-[11px]">نظام الإدارة السيادي</CardDescription>
        </CardHeader>
        
        <CardContent className="p-10 space-y-8">
            {errorMsg && (
                <Alert variant="destructive" className="rounded-2xl border-2 bg-red-50 border-red-200 animate-in slide-in-from-top-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="text-[11px] font-black">فشل التحقق</AlertTitle>
                    <AlertDescription className="text-[10px] font-bold">{errorMsg}</AlertDescription>
                </Alert>
            )}

            {mode === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-8" autoComplete="off">
                    <div className="grid gap-3">
                        <Label className="font-black text-[11px] uppercase tracking-widest text-center text-slate-400">اسم المستخدم أو البريد</Label>
                        <Input 
                            value={identifier} 
                            onChange={handleIdentifierChange} 
                            className="h-14 rounded-2xl border-2 text-center font-black text-xl text-primary bg-white/50 focus:bg-white transition-all shadow-inner" 
                            required 
                            placeholder="Username / Email"
                            autoComplete="off"
                        />
                    </div>

                    <div className="grid gap-3">
                        <Label className="font-black text-[11px] uppercase tracking-widest text-center text-slate-400">كلمة المرور</Label>
                        <Input 
                            type="password" 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            className="h-14 rounded-2xl border-2 font-mono text-center text-2xl bg-white/50 focus:bg-white transition-all shadow-inner" 
                            required 
                            placeholder="••••••••"
                            autoComplete="new-password"
                        />
                        <div className="flex justify-center mt-1">
                             <button type="button" onClick={() => setMode('forgot-password')} className="text-xs font-bold text-primary hover:underline opacity-60 hover:opacity-100 transition-opacity">نسيت كلمة المرور؟</button>
                        </div>
                    </div>

                    <Button type="submit" disabled={localLoading} className="w-full h-16 rounded-[2rem] font-black text-2xl gap-4 shadow-xl bg-primary text-white hover:scale-[1.02] active:scale-95 transition-all">
                        {localLoading ? <Loader2 className="animate-spin h-6 w-6" /> : <LogIn className="h-6 w-6" />}
                        دخول للنظام
                    </Button>

                    <div className="pt-8 border-t border-black/5 flex flex-col items-center">
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
                        <Input value={identifier} onChange={handleIdentifierChange} className="h-14 rounded-2xl border-2 text-center font-bold text-lg" required placeholder="example@email.com" autoComplete="off" />
                    </div>
                    <Button type="submit" disabled={localLoading} className="w-full h-14 rounded-2xl font-black text-lg gap-3">
                        {localLoading ? <Loader2 className="animate-spin h-5 w-5" /> : <Send className="h-5 w-5" />}
                        إرسال رابط التعيين
                    </Button>
                    <button type="button" onClick={() => setMode('login')} className="w-full text-xs font-black opacity-50 flex items-center justify-center gap-2 hover:opacity-100">
                        <ArrowRight className="h-4 w-4 rotate-180" /> العودة للدخول
                    </button>
                </form>
            )}
        </CardContent>
      </Card>
      
      <div className="fixed bottom-10 left-10 z-0 opacity-5 select-none pointer-events-none">
          <p className="text-[#1e1b4b] font-black text-[150px] leading-none">ERP</p>
      </div>
    </div>
  );
}