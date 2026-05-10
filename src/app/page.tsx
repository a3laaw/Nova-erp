
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Lock, ShieldCheck, User, Sparkles, LogIn, Building2, ArrowLeft, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';

export default function UnifiedLoginPage() {
  const { login, user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    identifier: '', 
    password: '',
  });

  // 🛡️ توجيه سيادي فوري عند اكتمال التحقق
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
        await login(formData.identifier, formData.password);
    } catch (error: any) {
        setErrorMessage(error.message);
        setIsLoading(false); 
    }
  };

  const vibrantGlassBackground = "linear-gradient(135deg, #a5f3fc 0%, #818cf8 40%, #c084fc 70%, #f472b6 100%)";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" dir="rtl" style={{ background: vibrantGlassBackground }}>
      <Card className="w-full max-w-md rounded-[3.5rem] border-none shadow-2xl overflow-hidden glass-effect animate-in zoom-in-95 duration-700">
        <CardHeader className="py-12 px-8 text-center border-b border-white/20">
            <div className="bg-white/40 p-5 rounded-[2.2rem] w-fit mx-auto mb-6 backdrop-blur-xl border border-white/60 shadow-xl">
                <ShieldCheck className="h-12 w-12 text-[#1e1b4b]" />
            </div>
            <CardTitle className="text-4xl font-black tracking-tighter text-[#1e1b4b] flex items-center justify-center gap-2">
                Nova ERP
                <Sparkles className="h-5 w-5 text-indigo-600 animate-pulse" />
            </CardTitle>
            <CardDescription className="text-[#1e1b4b]/70 font-bold mt-2 text-sm uppercase tracking-widest">بوابة العبور السيادية</CardDescription>
        </CardHeader>
        
        <CardContent className="p-10 space-y-8">
            {errorMessage && (
                <Alert variant="destructive" className="rounded-2xl border-2 bg-red-50/50">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="font-black text-xs">تعذر الدخول</AlertTitle>
                    <AlertDescription className="text-[11px] font-bold mt-1">
                        {errorMessage}
                    </AlertDescription>
                </Alert>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
                <div className="grid gap-2">
                    <Label className="font-black text-xs pr-1 flex items-center gap-2 text-[#1e1b4b]">
                        <User className="h-3 w-3" /> اسم المستخدم أو البريد (الوهمي)
                    </Label>
                    <Input 
                        type="text" 
                        value={formData.identifier} 
                        onChange={e => setFormData(p => ({...p, identifier: e.target.value}))} 
                        className="h-14 rounded-2xl border-white/40 bg-white/30 backdrop-blur-md dir-ltr font-black text-lg text-[#1e1b4b] shadow-inner focus:bg-white/60 transition-all border-2" 
                        required 
                        placeholder="alaa OR alaa@comp_123.nova"
                        disabled={isLoading}
                    />
                </div>

                <div className="grid gap-2">
                    <Label className="font-black text-xs pr-1 flex items-center gap-2 text-[#1e1b4b]">
                        <Lock className="h-3 w-3" /> كلمة المرور
                    </Label>
                    <Input 
                        type="password" 
                        value={formData.password} 
                        onChange={e => setFormData(p => ({...p, password: e.target.value}))} 
                        className="h-14 rounded-2xl border-white/40 bg-white/30 backdrop-blur-md font-mono font-black text-[#1e1b4b] shadow-inner focus:bg-white/60 transition-all border-2 text-center" 
                        required 
                        placeholder="********"
                        disabled={isLoading}
                    />
                </div>

                <Button type="submit" disabled={isLoading} className="w-full h-16 rounded-3xl font-black text-2xl gap-4 shadow-2xl bg-[#1e1b4b] text-white hover:bg-black transition-all active:scale-95 border-b-8 border-black/40">
                    {isLoading ? (
                        <>
                            <Loader2 className="animate-spin h-8 w-8" />
                            <span>جاري التحقق...</span>
                        </>
                    ) : (
                        <>
                            <LogIn className="h-8 w-8" />
                            <span>دخول للنظام</span>
                        </>
                    )}
                </Button>
            </form>

            <div className="pt-6 border-t border-white/10">
                <Button asChild variant="outline" className="w-full h-14 rounded-3xl border-white/40 bg-white/20 text-[#1e1b4b] font-black hover:bg-white/40 transition-all gap-2" disabled={isLoading}>
                    <Link href="/register">
                        <Building2 className="h-5 w-5" />
                        سجل منشأتك الآن في Nova
                    </Link>
                </Button>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
