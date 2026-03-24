'use client';

import { useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Lock, ShieldCheck, User, Sparkles, Terminal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

/**
 * بوابة دخول المطور (Secret Developer Gateway):
 * مسار مخفي وخاص بالمطور الرئيسي لإدارة المستأجرين.
 */
export default function DeveloperLoginPage() {
  const { login } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
        // تسجيل دخول مطور (بدون companyId)
        await login(formData.email, formData.password);
        toast({ title: 'مرحباً بك أيها المطور' });
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'خطأ في الدخول', description: error.message });
    } finally {
        setIsLoading(false);
    }
  };

  const devBackground = "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" dir="rtl" style={{ background: devBackground }}>
      {/* خلفية تقنية (Matrix-like feel) */}
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
      
      <Card className="w-full max-w-md rounded-[2.5rem] border-none shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden bg-slate-900/80 backdrop-blur-2xl border border-white/10 animate-in slide-in-from-top-4 duration-700">
        <CardHeader className="py-10 px-8 text-center border-b border-white/5">
            <div className="bg-indigo-600 p-5 rounded-[2rem] w-fit mx-auto mb-6 shadow-[0_0_30px_rgba(79,70,229,0.4)] transition-transform hover:rotate-12 duration-500">
                <Terminal className="h-12 w-12 text-white" />
            </div>
            <CardTitle className="text-3xl font-black tracking-tighter text-white flex items-center justify-center gap-2">
                Developer Console
            </CardTitle>
            <CardDescription className="text-indigo-300 font-bold mt-2 text-xs uppercase tracking-widest">Nova ERP Restricted Access</CardDescription>
        </CardHeader>
        
        <CardContent className="p-10 space-y-8">
            <form onSubmit={handleLogin} className="space-y-6">
                <div className="grid gap-2">
                    <Label className="font-black text-xs pr-1 flex items-center gap-2 text-indigo-200">
                        <User className="h-3 w-3" /> بريد المطور (Root)
                    </Label>
                    <Input 
                        type="email" 
                        value={formData.email} 
                        onChange={e => setFormData(p => ({...p, email: e.target.value}))} 
                        className="h-12 rounded-2xl border-white/10 bg-white/5 text-white dir-ltr font-black focus:bg-white/10 transition-all border-2" 
                        required 
                    />
                </div>

                <div className="grid gap-2">
                    <Label className="font-black text-xs pr-1 flex items-center gap-2 text-indigo-200">
                        <Lock className="h-3 w-3" /> كلمة المرور السيادية
                    </Label>
                    <Input 
                        type="password" 
                        value={formData.password} 
                        onChange={e => setFormData(p => ({...p, password: e.target.value}))} 
                        className="h-12 rounded-2xl border-white/10 bg-white/5 text-white font-mono font-black focus:bg-white/10 transition-all border-2" 
                        required 
                    />
                </div>

                <Button type="submit" disabled={isLoading} className="w-full h-14 rounded-2xl font-black text-xl gap-3 shadow-2xl shadow-indigo-900/50 bg-indigo-600 text-white hover:bg-indigo-500 transition-all">
                    {isLoading ? <Loader2 className="animate-spin h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
                    دخول المطور
                </Button>
            </form>
        </CardContent>
        <div className="bg-black/40 p-4 text-center border-t border-white/5">
            <p className="text-[10px] font-black text-indigo-400/60 uppercase tracking-[0.3em]">
                System Administrator Environment
            </p>
        </div>
      </Card>
    </div>
  );
}
