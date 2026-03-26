
'use client';

import { useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Lock, ShieldCheck, User, Sparkles, LogIn, Building2, ArrowLeft, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function UnifiedLoginPage() {
  const { login } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setErrorMessage(null);
    try {
        await login(formData.email, formData.password);
        toast({ title: 'تم الدخول بنجاح' });
    } catch (error: any) {
        setErrorMessage(error.message);
        toast({ 
            variant: 'destructive', 
            title: 'فشل تسجيل الدخول', 
            description: error.message 
        });
        setIsLoading(false); 
    }
  };

  const vibrantGlassBackground = "linear-gradient(135deg, #a5f3fc 0%, #818cf8 40%, #c084fc 70%, #f472b6 100%)";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" dir="rtl" style={{ background: vibrantGlassBackground }}>
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-white/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-500/20 rounded-full blur-[120px] animate-pulse" />

      <Card className="w-full max-w-md rounded-[3.5rem] border-none shadow-2xl overflow-hidden glass-effect animate-in zoom-in-95 duration-700">
        <CardHeader className="py-12 px-8 text-center relative border-b border-white/20">
            <div className="bg-white/40 p-5 rounded-[2rem] w-fit mx-auto mb-6 backdrop-blur-xl border border-white/60 shadow-xl transition-transform hover:scale-110 duration-500">
                <ShieldCheck className="h-12 w-12 text-[#1e1b4b]" />
            </div>
            <CardTitle className="text-4xl font-black tracking-tighter text-[#1e1b4b] flex items-center justify-center gap-2">
                Nova ERP
                <Sparkles className="h-5 w-5 text-indigo-600 animate-pulse" />
            </CardTitle>
            <CardDescription className="text-[#1e1b4b]/70 font-black mt-2 text-sm uppercase tracking-[0.3em]">بوابة الدخول الذكية الموحدة</CardDescription>
        </CardHeader>
        
        <CardContent className="p-10 space-y-8">
            {errorMessage && (
                <Alert variant="destructive" className="rounded-2xl border-2 bg-red-50/50 animate-in shake duration-500">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="font-black text-xs">تنبيه بالخطأ</AlertTitle>
                    <AlertDescription className="text-[10px] font-bold mt-1 leading-relaxed">
                        {errorMessage}
                    </AlertDescription>
                </Alert>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
                <div className="grid gap-2">
                    <Label className="font-black text-xs pr-1 flex items-center gap-2 text-[#1e1b4b]">
                        <User className="h-3 w-3" /> البريد الإلكتروني المعتمد
                    </Label>
                    <Input 
                        type="email" 
                        value={formData.email} 
                        onChange={e => setFormData(p => ({...p, email: e.target.value}))} 
                        className="h-12 rounded-2xl border-white/40 bg-white/30 backdrop-blur-md dir-ltr font-black text-[#1e1b4b] shadow-inner focus:bg-white/60 transition-all border-2" 
                        required 
                        placeholder="user@company.com"
                        disabled={isLoading}
                    />
                </div>

                <div className="grid gap-2">
                    <Label className="font-black text-xs pr-1 flex items-center gap-2 text-[#1e1b4b]">
                        <Lock className="h-3 w-3" /> كلمة المرور السيادية
                    </Label>
                    <Input 
                        type="password" 
                        value={formData.password} 
                        onChange={e => setFormData(p => ({...p, password: e.target.value}))} 
                        className="h-12 rounded-2xl border-white/40 bg-white/30 backdrop-blur-md font-mono font-black text-[#1e1b4b] shadow-inner focus:bg-white/60 transition-all border-2" 
                        required 
                        disabled={isLoading}
                    />
                </div>

                <Button type="submit" disabled={isLoading} className="w-full h-14 rounded-2xl font-black text-xl gap-3 shadow-2xl shadow-indigo-900/20 bg-[#1e1b4b] text-white hover:bg-black transition-all active:scale-95 border-b-4 border-black">
                    {isLoading ? (
                        <>
                            <Loader2 className="animate-spin h-6 w-6" />
                            جاري التحقق...
                        </>
                    ) : (
                        <>
                            <LogIn className="h-6 w-6" />
                            دخول المنصة
                        </>
                    )}
                </Button>
            </form>

            <div className="pt-4 border-t border-white/10 flex flex-col gap-4">
                <p className="text-center text-xs font-bold text-[#1e1b4b]/60 uppercase tracking-widest">— هل تملك مكتباً هندسياً؟ —</p>
                <Button asChild variant="outline" className="h-12 rounded-2xl border-white/40 bg-white/20 text-[#1e1b4b] font-black hover:bg-white/40 transition-all gap-2" disabled={isLoading}>
                    <Link href={isLoading ? '#' : '/register'}>
                        <Building2 className="h-4 w-4" />
                        سجل شركتك الآن في Nova
                        <ArrowLeft className="h-4 w-4 mr-auto" />
                    </Link>
                </Button>
            </div>
        </CardContent>
        <div className="bg-white/10 p-4 text-center border-t border-white/10">
            <p className="text-[10px] font-black text-[#1e1b4b]/40 uppercase tracking-widest">
                Nova ERP — Universal Autonomous Gateway
            </p>
        </div>
      </Card>
    </div>
  );
}
