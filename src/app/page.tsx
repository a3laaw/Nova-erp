'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldCheck, Mail, Sparkles, LogIn, Building2, Lock, AlertCircle, RefreshCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function UnifiedLoginPage() {
  const { login, user, loading: authLoading, error: contextError } = useAuth();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showRescue, setShowRescue] = useState(false);

  // 🛡️ محرك التوجيه والتحكم في تعليق الحالة
  useEffect(() => {
    if (!authLoading && user) {
        router.replace(user.role === 'Developer' ? '/developer' : '/dashboard');
    }
    
    // صمام أمان: إذا استمر التحميل أكثر من 6 ثوانٍ، نظهر خيار الإنقاذ
    let timer: NodeJS.Timeout;
    if (isLoading || authLoading) {
        timer = setTimeout(() => setShowRescue(true), 6000);
    }
    return () => clearTimeout(timer);
  }, [user, authLoading, router, isLoading]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setShowRescue(false);

    try {
        await login(formData.email, formData.password);
    } catch (error) {
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" dir="rtl">
      <Card className="w-full max-w-md rounded-[2.5rem] border-none shadow-2xl overflow-hidden glass-effect animate-in zoom-in-95 duration-500 relative z-10">
        <CardHeader className="py-10 px-8 text-center border-b border-white/40">
            <div className="bg-white/60 p-4 rounded-3xl w-fit mx-auto mb-4 backdrop-blur-xl border border-white shadow-lg">
                <ShieldCheck className="h-10 w-10 text-[#1e1b4b]" />
            </div>
            <CardTitle className="text-3xl font-black tracking-tighter text-[#1e1b4b] flex items-center justify-center gap-2">
                Nova ERP
                <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            </CardTitle>
            <CardDescription className="text-[#1e1b4b]/60 font-bold mt-1 text-xs uppercase tracking-widest">بوابة العبور السيادية</CardDescription>
        </CardHeader>
        
        <CardContent className="p-8 space-y-6">
            {(contextError || showRescue) && (
                <Alert variant="destructive" className="rounded-2xl border-2 bg-red-50/50 animate-in shake-in duration-300">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="font-black text-xs">{showRescue ? 'تأخر في الاستجابة' : 'تعذر العبور'}</AlertTitle>
                    <AlertDescription className="text-[11px] font-bold mt-1">
                        {showRescue ? 'يبدو أن الجلسة معلقة، يرجى تحديث الصفحة.' : contextError}
                        {showRescue && (
                            <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="w-full mt-3 h-8 rounded-lg gap-2 text-red-700 border-red-200">
                                <RefreshCcw className="h-3 w-3" /> تحديث الصفحة الآن
                            </Button>
                        )}
                    </AlertDescription>
                </Alert>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
                <div className="grid gap-2">
                    <Label className="font-black text-[10px] pr-1 flex items-center gap-2 text-[#1e1b4b] uppercase tracking-widest">
                        <Mail className="h-3 w-3 opacity-50" /> البريد الإلكتروني الفني
                    </Label>
                    <Input 
                        type="email" 
                        value={formData.email} 
                        onChange={e => setFormData(p => ({...p, email: e.target.value}))} 
                        className="h-12 rounded-xl border-white/60 bg-white/40 backdrop-blur-md dir-ltr font-black text-base text-[#1e1b4b] shadow-inner border-2" 
                        required 
                        placeholder="user@company.nova"
                        disabled={isLoading || authLoading}
                    />
                </div>

                <div className="grid gap-2">
                    <Label className="font-black text-[10px] pr-1 flex items-center gap-2 text-[#1e1b4b] uppercase tracking-widest">
                        <Lock className="h-3 w-3 opacity-50" /> كلمة المرور
                    </Label>
                    <Input 
                        type="password" 
                        value={formData.password} 
                        onChange={e => setFormData(p => ({...p, password: e.target.value}))} 
                        className="h-12 rounded-xl border-white/60 bg-white/40 backdrop-blur-md font-mono font-black text-[#1e1b4b] shadow-inner border-2 text-center" 
                        required 
                        placeholder="********"
                        disabled={isLoading || authLoading}
                    />
                </div>

                <Button 
                    type="submit" 
                    disabled={isLoading || authLoading} 
                    className="w-full h-14 rounded-2xl font-black text-xl gap-4 shadow-xl bg-[#1e1b4b] text-white hover:bg-black transition-all active:scale-95 border-b-4 border-black/30 mt-2"
                >
                    {isLoading || authLoading ? (
                        <>
                            <Loader2 className="animate-spin h-6 w-6" />
                            <span>جاري العبور...</span>
                        </>
                    ) : (
                        <>
                            <LogIn className="h-6 w-6" />
                            <span>دخول للنظام</span>
                        </>
                    )}
                </Button>
            </form>

            <div className="pt-6 border-t border-black/5 text-center">
                <p className="text-[10px] font-bold text-slate-500 mb-3 uppercase tracking-tighter">ليس لديك منشأة مسجلة؟</p>
                <Button asChild variant="ghost" className="w-full h-12 rounded-2xl border-2 border-white/60 bg-white/20 text-[#1e1b4b] font-black hover:bg-white/40 transition-all gap-2">
                    <Link href="/register">
                        <Building2 className="h-4 w-4" />
                        سجل منشأتك الآن
                    </Link>
                </Button>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
