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
    Building2, 
    Sparkles, 
    AlertCircle, 
    User, 
    Key, 
    Mail, 
    ArrowRight,
    Send 
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { cn } from '@/lib/utils';

/**
 * بوابة العبور الموحدة (Unified Login Gateway):
 * تم تحصينها لاستقبال المطورين ببريد رسمي @gmail.com والعملاء بـ @company.nova
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
  const [diagnosis, setDiagnosis] = useState<{ message: string, type: 'error' | 'success' } | null>(null);

  useEffect(() => {
    if (user && !loading) {
        const target = user.role === 'Developer' ? '/developer' : '/dashboard';
        router.replace(target);
    }
  }, [user, loading, router]);

  const resolveEmail = async (id: string) => {
      let finalEmail = id.trim().toLowerCase();
      // إذا لم يكن إيميلاً، نبحث في الفهرس العالمي عن اسم المستخدم
      if (!finalEmail.includes('@') && firestore) {
          const globalQuery = query(
              collection(firestore, 'global_users'), 
              where('username', '==', finalEmail),
              limit(1)
          );
          const snap = await getDocs(globalQuery);
          if (!snap.empty) {
              finalEmail = snap.docs[0].data().email;
          } else if (finalEmail === 'alaa') {
              finalEmail = 'alaawaaheeb@gmail.com';
          } else {
              throw new Error('اسم المستخدم غير مسجل في المنظومة.');
          }
      }
      return finalEmail;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (localLoading) return;
    
    setLocalLoading(true);
    setDiagnosis(null);

    try {
        const finalEmail = await resolveEmail(identifier);
        await login(finalEmail, password);
    } catch (error: any) {
        setLocalLoading(false);
        setDiagnosis({ type: 'error', message: error.message || 'بيانات الدخول غير صحيحة.' });
        toast({ variant: 'destructive', title: 'فشل الدخول', description: error.message });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      if (localLoading || !identifier) return;

      setLocalLoading(true);
      setDiagnosis(null);

      try {
          const finalEmail = await resolveEmail(identifier);
          await resetPassword(finalEmail);
          setDiagnosis({ 
              type: 'success', 
              message: `تم إرسال رابط إعادة تعيين كلمة المرور إلى البريد: ${finalEmail}` 
          });
      } catch (error: any) {
          setDiagnosis({ type: 'error', message: error.message || 'فشل إرسال بريد إعادة التعيين.' });
      } finally {
          setLocalLoading(false);
      }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" dir="rtl">
      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 50%, #818cf8 0%, transparent 50%)' }} />
      
      <Card className="w-full max-w-md rounded-[2.5rem] border-none shadow-2xl overflow-hidden glass-effect animate-in zoom-in-95 duration-500 relative z-10">
        <CardHeader className="py-10 px-8 text-center border-b border-white/40 bg-white/20">
            <div className="bg-white/60 p-4 rounded-3xl w-fit mx-auto mb-4 border border-white shadow-lg">
                {mode === 'login' ? <ShieldCheck className="h-10 w-10 text-[#1e1b4b]" /> : <Key className="h-10 w-10 text-primary" />}
            </div>
            <CardTitle className="text-3xl font-black tracking-tighter text-[#1e1b4b] flex items-center justify-center gap-2">
                {mode === 'login' ? 'Nova ERP' : 'استعادة الدخول'}
                <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            </CardTitle>
            <CardDescription className="text-[#1e1b4b]/60 font-bold mt-1 uppercase tracking-widest text-[10px]">
                {mode === 'login' ? 'بوابة العبور الموحدة' : 'سيصلك رابط التعيين على بريدك'}
            </CardDescription>
        </CardHeader>
        
        <CardContent className="p-8 space-y-6">
            {diagnosis && (
                <Alert variant={diagnosis.type === 'success' ? 'default' : 'destructive'} className={cn(
                    "rounded-2xl border-2 animate-in fade-in slide-in-from-top-2", 
                    diagnosis.type === 'success' ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200"
                )}>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="text-[11px] font-black">إشعار النظام</AlertTitle>
                    <AlertDescription className="text-[10px] font-black leading-relaxed mt-1">
                        {diagnosis.message}
                    </AlertDescription>
                </Alert>
            )}

            {mode === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-5">
                    <div className="grid gap-2">
                        <Label className="font-black text-[10px] pr-1 uppercase tracking-widest text-[#1e1b4b]">اسم المستخدم أو البريد</Label>
                        <div className="relative group">
                            <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                            <Input 
                                type="text" 
                                value={identifier} 
                                onChange={e => setIdentifier(e.target.value)} 
                                className="h-12 rounded-xl border-white/60 bg-white/40 dir-ltr font-black text-base shadow-inner border-2 pr-10" 
                                required 
                                placeholder="Email or Username"
                                disabled={localLoading}
                            />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <div className="flex justify-between items-center pr-1">
                            <Label className="font-black text-[10px] uppercase tracking-widest text-[#1e1b4b]">كلمة المرور</Label>
                            <button 
                                type="button" 
                                onClick={() => setMode('forgot-password')}
                                className="text-[10px] font-black text-primary hover:underline"
                            >
                                نسيت كلمة المرور؟
                            </button>
                        </div>
                        <Input 
                            type="password" 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            className="h-12 rounded-xl border-white/60 bg-white/40 font-mono font-black text-center shadow-inner border-2" 
                            required 
                            placeholder="********"
                            disabled={localLoading}
                        />
                    </div>

                    <Button 
                        type="submit" 
                        disabled={localLoading} 
                        className="w-full h-14 rounded-2xl font-black text-xl gap-4 shadow-xl bg-[#1e1b4b] text-white hover:bg-black transition-all border-b-4 border-black/30 mt-2 active:translate-y-1 active:border-b-0"
                    >
                        {localLoading ? <Loader2 className="animate-spin h-6 w-6" /> : <LogIn className="h-6 w-6" />}
                        <span>دخول للنظام</span>
                    </Button>
                </form>
            ) : (
                <form onSubmit={handleResetPassword} className="space-y-6">
                    <div className="grid gap-2">
                        <Label className="font-black text-[10px] pr-1 uppercase tracking-widest text-[#1e1b4b]">أدخل بريدك أو اسم المستخدم</Label>
                        <div className="relative group">
                            <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input 
                                type="text" 
                                value={identifier} 
                                onChange={e => setIdentifier(e.target.value)} 
                                className="h-12 rounded-xl border-2 pr-10 bg-white/40 font-bold" 
                                required 
                                placeholder="alaa.wahib"
                                disabled={localLoading}
                            />
                        </div>
                    </div>

                    <Button 
                        type="submit" 
                        disabled={localLoading || !identifier} 
                        className="w-full h-14 rounded-2xl font-black text-lg gap-3 shadow-xl bg-primary text-white"
                    >
                        {localLoading ? <Loader2 className="animate-spin h-6 w-6" /> : <Send className="h-6 w-6" />}
                        إرسال رابط التعيين
                    </Button>

                    <button 
                        type="button" 
                        onClick={() => { setMode('login'); setDiagnosis(null); }}
                        className="w-full text-xs font-black text-[#1e1b4b]/60 flex items-center justify-center gap-2 hover:text-[#1e1b4b]"
                    >
                        <ArrowRight className="h-3 w-3 rotate-180" /> العودة للدخول
                    </button>
                </form>
            )}

            <div className="pt-6 border-t border-black/5 text-center">
                <p className="text-[10px] font-bold text-slate-500 mb-3 uppercase">هل ترغب في تسجيل منشأة جديدة؟</p>
                <Button asChild variant="ghost" className="w-full h-12 rounded-2xl border-2 border-white/60 bg-white/20 text-[#1e1b4b] font-black hover:bg-white/40 gap-2">
                    <Link href="/register">
                        <Building2 className="h-4 w-4" />
                        سجل مكتبك الآن
                    </Link>
                </Button>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
