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
    Database,
    ArrowRight,
    PlusCircle
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';

/**
 * بوابة العبور الموحدة (Sovereign Login Gateway V53.0).
 * تم التحديث: إضافة زر "انضمام المنشأة" بشكل بارز وتوسيط العناصر.
 */
export default function LoginPage() {
  const { login, resetPassword, user, loading } = useAuth();
  const { firestore, app } = useFirebase();
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
      // استثناء المطور الرئيسي فقط
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
      // 🛡️ الربط الذكي: إذا تم مسح اليوزر يتم مسح الباسورد فوراً
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

  const currentProjectId = (app as any)?.options?.projectId || 'nov-erp-1-25549967-c24e5';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" dir="rtl">
      <Card className="w-full max-w-md rounded-[2.5rem] border-none shadow-2xl overflow-hidden glass-effect animate-in zoom-in-95 duration-500 relative z-10">
        <CardHeader className="py-10 px-8 text-center border-b border-white/40 bg-white/20">
            <div className="bg-white/60 p-4 rounded-3xl w-fit mx-auto mb-4 border border-white shadow-lg">
                {mode === 'login' ? <ShieldCheck className="h-10 w-10 text-[#1e1b4b]" /> : <Send className="h-10 w-10 text-primary" />}
            </div>
            <CardTitle className="text-3xl font-black text-[#1e1b4b]">Nova ERP</CardTitle>
            <CardDescription className="text-[#1e1b4b]/60 font-black uppercase tracking-widest text-[10px]">بوابة العبور السيادية</CardDescription>
        </CardHeader>
        
        <CardContent className="p-8 space-y-6">
            {errorMsg && (
                <Alert variant="destructive" className="rounded-2xl border-2 bg-red-50 border-red-200">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="text-[11px] font-black">فشل التحقق</AlertTitle>
                    <AlertDescription className="text-[10px] font-bold">{errorMsg}</AlertDescription>
                </Alert>
            )}

            {mode === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-6" autoComplete="off">
                    <div className="grid gap-2">
                        <Label className="font-black text-[10px] pr-1 uppercase tracking-widest text-center text-slate-500">اسم المستخدم أو البريد</Label>
                        <div className="relative">
                            <Input 
                                value={identifier} 
                                onChange={handleIdentifierChange} 
                                className="h-12 rounded-xl border-2 text-center font-black text-primary focus:placeholder:opacity-0" 
                                required 
                                placeholder="Username or Email"
                                autoComplete="off"
                            />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label className="font-black text-[10px] uppercase tracking-widest text-center text-slate-500">كلمة المرور</Label>
                        <div className="relative">
                            <Input 
                                type="password" 
                                value={password} 
                                onChange={e => setPassword(e.target.value)} 
                                className="h-12 rounded-xl border-2 font-mono text-center text-lg" 
                                required 
                                placeholder="••••••••"
                                autoComplete="new-password"
                            />
                        </div>
                        <div className="flex justify-center mt-1">
                             <button type="button" onClick={() => setMode('forgot-password')} className="text-[10px] font-black text-primary hover:underline">نسيت كلمة المرور؟</button>
                        </div>
                    </div>

                    <Button type="submit" disabled={localLoading} className="w-full h-14 rounded-2xl font-black text-xl gap-4 shadow-xl bg-[#1e1b4b] text-white border-b-8 border-black/40 active:translate-y-1 active:border-b-0 transition-all">
                        {localLoading ? <Loader2 className="animate-spin h-6 w-6" /> : <LogIn className="h-6 w-6" />}
                        دخول للنظام
                    </Button>

                    {/* 🛡️ قسم طلب انضمام المنشأة - مبرز بوضوح سيادي 🛡️ */}
                    <div className="pt-6 border-t border-black/5 mt-2 flex flex-col items-center gap-4">
                        <div className="text-center w-full">
                            <p className="text-[11px] font-bold text-slate-500 mb-4">هل تملك منشأة هندسية أو تجارية؟</p>
                            <Button asChild variant="outline" className="w-full h-14 rounded-2xl border-2 border-dashed border-primary/40 text-primary font-black gap-3 hover:bg-primary/10 transition-all hover:scale-[1.02] shadow-sm">
                                <Link href="/register">
                                    <PlusCircle className="h-6 w-6" />
                                    اطلب انضمام منشأتك الآن
                                </Link>
                            </Button>
                        </div>
                    </div>
                </form>
            ) : (
                <form onSubmit={handleResetPassword} className="space-y-6" autoComplete="off">
                    <div className="grid gap-2">
                        <Label className="font-black text-[10px] pr-1 uppercase tracking-widest text-center">أدخل بريدك الإلكتروني</Label>
                        <div className="relative">
                            <Input value={identifier} onChange={handleIdentifierChange} className="h-12 rounded-xl border-2 text-center font-bold" required placeholder="example@email.com" autoComplete="off" />
                        </div>
                    </div>
                    <Button type="submit" disabled={localLoading} className="w-full h-14 rounded-2xl font-black text-lg gap-2">
                        {localLoading ? <Loader2 className="animate-spin h-5 w-5" /> : <Send className="h-5 w-5" />}
                        إرسال رابط التعيين
                    </Button>
                    <button type="button" onClick={() => setMode('login')} className="w-full text-xs font-black opacity-50 flex items-center justify-center gap-2">
                        <ArrowRight className="h-3 w-3 rotate-180" /> العودة للدخول
                    </button>
                </form>
            )}
            
            <div className="pt-4 flex items-center justify-center gap-2 opacity-20">
                <Database className="h-3 w-3" />
                <span className="text-[8px] font-mono font-bold">{currentProjectId}</span>
            </div>
        </CardContent>
      </Card>
      
      <div className="fixed bottom-10 left-10 z-0 opacity-10 no-print">
          <p className="text-white font-black text-[100px] leading-none select-none">ERP</p>
      </div>
    </div>
  );
}
