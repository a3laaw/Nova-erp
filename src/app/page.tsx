'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldCheck, Mail, Sparkles, LogIn, Building2, AlertCircle, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';

/**
 * بوابة الدخول السيادية المرممة:
 * تم الالتزام بالأبعاد (max-w-md) والتدرج اللؤلؤي الأصلي.
 */
export default function UnifiedLoginPage() {
  const { login, user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    email: '', 
    password: '',
  });

  // صمام أمان لإعادة توجيه المستخدم إذا كان مسجلاً للدخول بالفعل
  useEffect(() => {
    if (!authLoading && user) {
        const targetPath = user.role === 'Developer' ? '/developer' : '/dashboard';
        router.replace(targetPath);
    }
  }, [user, authLoading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
        await login(formData.email, formData.password);
        // التوجيه يتم عبر الـ useEffect أعلاه عند تحديث حالة المستخدم
    } catch (error: any) {
        console.error("Login failed:", error);
        setErrorMessage("بيانات الدخول غير صحيحة أو الحساب يحتاج لمزامنة.");
        setIsLoading(false); 
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" dir="rtl">
      {/* عناصر جمالية في الخلفية */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      
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
            {errorMessage && (
                <Alert variant="destructive" className="rounded-2xl border-2 bg-red-50/50">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="font-black text-xs">تعذر العبور</AlertTitle>
                    <AlertDescription className="text-[11px] font-bold mt-1">
                        {errorMessage}
                    </AlertDescription>
                </Alert>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
                <div className="grid gap-2">
                    <Label className="font-black text-[10px] pr-1 flex items-center gap-2 text-[#1e1b4b] uppercase tracking-widest">
                        <Mail className="h-3 w-3 opacity-50" /> البريد الفني المعتمد
                    </Label>
                    <Input 
                        type="email" 
                        value={formData.email} 
                        onChange={e => setFormData(p => ({...p, email: e.target.value}))} 
                        className="h-12 rounded-xl border-white/60 bg-white/40 backdrop-blur-md dir-ltr font-black text-base text-[#1e1b4b] shadow-inner border-2" 
                        required 
                        placeholder="user@company.nova"
                        disabled={isLoading}
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
                        disabled={isLoading}
                    />
                </div>

                <Button type="submit" disabled={isLoading} className="w-full h-14 rounded-2xl font-black text-xl gap-4 shadow-xl bg-[#1e1b4b] text-white hover:bg-black transition-all active:scale-95 border-b-4 border-black/30 mt-2">
                    {isLoading ? (
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
                <Button asChild variant="ghost" className="w-full h-12 rounded-2xl border-2 border-white/60 bg-white/20 text-[#1e1b4b] font-black hover:bg-white/40 transition-all gap-2" disabled={isLoading}>
                    <Link href="/register">
                        <Building2 className="h-4 w-4" />
                        سجل منشأتك الآن
                    </Link>
                </Button>
            </div>
        </CardContent>
        
        <div className="bg-[#1e1b4b]/5 py-3 text-center">
            <p className="text-[9px] font-black text-[#1e1b4b]/40 uppercase tracking-[0.4em]">Nova ERP — Sovereign Suite 2026</p>
        </div>
      </Card>
    </div>
  );
}