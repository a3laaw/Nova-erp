
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldCheck, LogIn, Building2, Sparkles, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

/**
 * بوابة العبور السيادية (Sovereign Gateway):
 * تم تحصينها بمحرك توجيه ذكي ومعالجة فورية للأخطاء.
 */
export default function LoginPage() {
  const { login, user, loading, error: authError } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [localLoading, setLocalLoading] = useState(false);

  // 🛡️ محرك التوجيه التلقائي المعتمد على الحالة السيادية
  useEffect(() => {
    if (user && !loading) {
        const target = user.role === 'Developer' ? '/developer' : '/dashboard';
        router.replace(target);
    }
  }, [user, loading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (localLoading) return;
    
    setLocalLoading(true);
    try {
        await login(formData.email, formData.password);
        // في حال النجاح، سيقوم useEffect أعلاه بالتوجيه آلياً
    } catch (error: any) {
        setLocalLoading(false);
        toast({
            variant: 'destructive',
            title: 'خطأ في الدخول',
            description: error.message || 'فشل التحقق من بيانات الاعتماد.'
        });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" dir="rtl">
      {/* الخلفية اللؤلؤية المتحركة */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 50%, #818cf8 0%, transparent 50%)' }} />
      
      <Card className="w-full max-w-md rounded-[2.5rem] border-none shadow-2xl overflow-hidden glass-effect animate-in zoom-in-95 duration-500 relative z-10">
        <CardHeader className="py-10 px-8 text-center border-b border-white/40 bg-white/20">
            <div className="bg-white/60 p-4 rounded-3xl w-fit mx-auto mb-4 border border-white shadow-lg">
                <ShieldCheck className="h-10 w-10 text-[#1e1b4b]" />
            </div>
            <CardTitle className="text-3xl font-black tracking-tighter text-[#1e1b4b] flex items-center justify-center gap-2">
                Nova ERP
                <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            </CardTitle>
            <CardDescription className="text-[#1e1b4b]/60 font-bold mt-1 uppercase tracking-widest text-[10px]">بوابة العبور السيادية</CardDescription>
        </CardHeader>
        
        <CardContent className="p-8 space-y-6">
            {(authError) && (
                <Alert variant="destructive" className="rounded-2xl border-2 bg-red-50/50">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="font-black text-xs">تنبيه النظام</AlertTitle>
                    <AlertDescription className="text-[11px] font-bold mt-1">{authError}</AlertDescription>
                </Alert>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
                <div className="grid gap-2">
                    <Label className="font-black text-[10px] pr-1 uppercase tracking-widest text-[#1e1b4b]">البريد الإلكتروني الفني</Label>
                    <Input 
                        type="email" 
                        value={formData.email} 
                        onChange={e => setFormData(p => ({...p, email: e.target.value}))} 
                        className="h-12 rounded-xl border-white/60 bg-white/40 dir-ltr font-black text-base shadow-inner border-2 focus:border-primary/50 transition-all" 
                        required 
                        placeholder="user@comp-id.nova"
                        disabled={localLoading || loading}
                    />
                </div>

                <div className="grid gap-2">
                    <Label className="font-black text-[10px] pr-1 uppercase tracking-widest text-[#1e1b4b]">كلمة المرور</Label>
                    <Input 
                        type="password" 
                        value={formData.password} 
                        onChange={e => setFormData(p => ({...p, password: e.target.value}))} 
                        className="h-12 rounded-xl border-white/60 bg-white/40 font-mono font-black text-center shadow-inner border-2 focus:border-primary/50 transition-all" 
                        required 
                        placeholder="********"
                        disabled={localLoading || loading}
                    />
                </div>

                <Button 
                    type="submit" 
                    disabled={localLoading || loading} 
                    className="w-full h-14 rounded-2xl font-black text-xl gap-4 shadow-xl bg-[#1e1b4b] text-white hover:bg-black transition-all border-b-4 border-black/30 mt-2 active:translate-y-1 active:border-b-0"
                >
                    {localLoading || loading ? (
                        <>
                            <Loader2 className="animate-spin h-6 w-6" />
                            <span>جاري التحقق...</span>
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
                <p className="text-[10px] font-bold text-slate-500 mb-3 uppercase">ليس لديك منشأة مسجلة؟</p>
                <Button asChild variant="ghost" className="w-full h-12 rounded-2xl border-2 border-white/60 bg-white/20 text-[#1e1b4b] font-black hover:bg-white/40 gap-2">
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
