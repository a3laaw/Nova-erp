'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldCheck, Mail, Sparkles, LogIn, Building2, AlertCircle, RefreshCcw, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';

/**
 * بوابة الدخول السيادية (The Sovereign Gate v4.0):
 * - علاج حلقة التحميل (Loading Loop) عبر صمام أمان زمني.
 * - تحسين توازن الأبعاد البصرية لتكون رشيقة (max-w-md).
 * - معالجة خطأ الدخول الفوري مع تأخير ذكي للمزامنة.
 */
export default function UnifiedLoginPage() {
  const { login, user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showEmergencyExit, setShowEmergencyExit] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '', 
    password: '',
  });

  // 🛡️ صمام أمان محلي: إذا استمر التحميل أكثر من 6 ثوانٍ، نعيد السيطرة للمستخدم
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isLoading) {
        timer = setTimeout(() => {
            setShowEmergencyExit(true);
            setIsLoading(false);
            setErrorMessage("استغرقت الاستجابة وقتاً طويلاً. يرجى تحديث الصفحة أو التأكد من بيانات الدخول.");
        }, 6000);
    }
    return () => clearTimeout(timer);
  }, [isLoading]);

  // التوجيه التلقائي الآمن مع تأخير ذكي للمزامنة
  useEffect(() => {
    if (!authLoading && user) {
        const targetPath = user.role === 'Developer' ? '/developer' : '/dashboard';
        // 🚀 تأخير سيادي (100ms) لضمان استقرار الكوكيز في المتصفح قبل التوجيه
        const timer = setTimeout(() => {
            router.replace(targetPath);
        }, 100);
        return () => clearTimeout(timer);
    }
  }, [user, authLoading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setErrorMessage(null);
    setShowEmergencyExit(false);

    try {
        await login(formData.email, formData.password);
        // التوجيه سيحدث عبر useEffect بمجرد تحديث حالة المستخدم في السياق
    } catch (error: any) {
        setErrorMessage(error.message);
        setIsLoading(false); 
    }
  };

  const vibrantGlassBackground = "linear-gradient(135deg, #f3f4f6 0%, #e0e7ff 40%, #f3e8ff 70%, #fce7f3 100%)";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" dir="rtl" style={{ background: vibrantGlassBackground }}>
      {/* عناصر جمالية في الخلفية */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-indigo-400/10 rounded-full blur-[100px]" />
      
      <Card className="w-full max-w-md rounded-[3rem] border-none shadow-2xl overflow-hidden glass-effect animate-in zoom-in-95 duration-700 relative z-10">
        <CardHeader className="py-10 px-8 text-center border-b border-white/40">
            <div className="bg-white/60 p-4 rounded-[1.8rem] w-fit mx-auto mb-4 backdrop-blur-xl border border-white shadow-lg">
                <ShieldCheck className="h-10 w-10 text-[#1e1b4b]" />
            </div>
            <CardTitle className="text-3xl font-black tracking-tighter text-[#1e1b4b] flex items-center justify-center gap-2">
                Nova ERP
                <Sparkles className="h-5 w-5 text-indigo-600 animate-pulse" />
            </CardTitle>
            <CardDescription className="text-[#1e1b4b]/60 font-bold mt-1 text-xs uppercase tracking-widest">بوابة العبور السيادية</CardDescription>
        </CardHeader>
        
        <CardContent className="p-8 space-y-6">
            {errorMessage && (
                <div className="space-y-4 animate-in shake-100">
                    <Alert variant="destructive" className="rounded-2xl border-2 bg-red-50/50">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle className="font-black text-xs">تعذر العبور</AlertTitle>
                        <AlertDescription className="text-[11px] font-bold mt-1">
                            {errorMessage}
                        </AlertDescription>
                    </Alert>
                    
                    {showEmergencyExit && (
                        <Button 
                            variant="outline" 
                            type="button"
                            onClick={() => window.location.reload()} 
                            className="w-full h-11 rounded-xl font-black gap-2 text-indigo-900 border-indigo-200 bg-white hover:bg-indigo-50"
                        >
                            <RefreshCcw className="h-4 w-4" /> تحديث الصفحة والمحاولة مجدداً
                        </Button>
                    )}
                </div>
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
                        className="h-12 rounded-xl border-white/60 bg-white/40 backdrop-blur-md dir-ltr font-black text-base text-[#1e1b4b] shadow-inner focus:bg-white/80 transition-all border-2" 
                        required 
                        placeholder="username@company.nova"
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
                        className="h-12 rounded-xl border-white/60 bg-white/40 backdrop-blur-md font-mono font-black text-[#1e1b4b] shadow-inner focus:bg-white/80 transition-all border-2 text-center" 
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
