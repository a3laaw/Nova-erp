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
    User, 
    Key, 
    Send,
    Database,
    ArrowRight
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { cn } from '@/lib/utils';

/**
 * بوابة العبور الموحدة (Sovereign Login V48.0):
 * تم تحصين كافة الاستيرادات لضمان استقرار لؤلؤي تحت الضغط.
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
      if (input === 'alaa' || input === 'alaawaaheeb@gmail.com') return 'alaawaaheeb@gmail.com';
      
      if (!input.includes('@') && firestore) {
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
            msg = 'خطأ أمني: بيانات الدخول غير مطابقة للسجلات في مشروع النجمة الحالي.';
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
                {mode === 'login' ? <ShieldCheck className="h-10 w-10 text-[#1e1b4b]" /> : <Key className="h-10 w-10 text-primary" />}
            </div>
            <CardTitle className="text-3xl font-black text-[#1e1b4b]">Nova ERP</CardTitle>
            <CardDescription className="text-[#1e1b4b]/60 font-bold uppercase tracking-widest text-[10px]">بوابة العبور السيادية</CardDescription>
        </CardHeader>
        
        <CardContent className="p-8 space-y-6">
            {errorMsg && (
                <Alert variant="destructive" className="rounded-2xl border-2 bg-red-50 border-red-200 animate-in shake-in">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="text-[11px] font-black">فشل التحقق</AlertTitle>
                    <AlertDescription className="text-[10px] font-bold">{errorMsg}</AlertDescription>
                </Alert>
            )}

            {mode === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-5">
                    <div className="grid gap-2">
                        <Label className="font-black text-[10px] pr-1 uppercase tracking-widest">اسم المستخدم أو البريد</Label>
                        <div className="relative">
                            <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input 
                                value={identifier} 
                                onChange={e => setIdentifier(e.target.value)} 
                                className="h-12 rounded-xl border-2 pr-10 dir-ltr font-black" 
                                required 
                                placeholder="Username or Email"
                            />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <div className="flex justify-between items-center pr-1">
                            <Label className="font-black text-[10px] uppercase tracking-widest">كلمة المرور</Label>
                            <button type="button" onClick={() => setMode('forgot-password')} className="text-[10px] font-black text-primary">نسيت كلمة المرور؟</button>
                        </div>
                        <div className="relative">
                            <Key className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input 
                                type="password" 
                                value={password} 
                                onChange={e => setPassword(e.target.value)} 
                                className="h-12 rounded-xl border-2 pr-10 font-mono text-center" 
                                required 
                            />
                        </div>
                    </div>

                    <Button type="submit" disabled={localLoading} className="w-full h-14 rounded-2xl font-black text-xl gap-4 shadow-xl bg-[#1e1b4b] text-white border-b-8 border-black/40">
                        {localLoading ? <Loader2 className="animate-spin h-6 w-6" /> : <LogIn className="h-6 w-6" />}
                        دخول للنظام
                    </Button>
                </form>
            ) : (
                <form onSubmit={handleResetPassword} className="space-y-6">
                    <div className="grid gap-2">
                        <Label className="font-black text-[10px] pr-1">أدخل بريدك الإلكتروني</Label>
                        <div className="relative">
                            <Send className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input value={identifier} onChange={e => setIdentifier(e.target.value)} className="h-12 rounded-xl border-2 pr-10 font-bold" required />
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
    </div>
  );
}
