
'use client';

/**
 * @fileOverview بوابة دخول المطور السيادي (Master Login).
 * تتميز بنمط "Dark Techno Glass" لتعكس السيطرة والقوة البرمجية.
 */

import { useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Lock, ShieldCheck, User, Terminal, Activity } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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
        await login(formData.email, formData.password);
        toast({ title: 'مرحباً بك في مركز التحكم السيادي' });
    } catch (error: any) {
        toast({ 
            variant: 'destructive', 
            title: 'فشل الدخول السيادي', 
            description: 'تأكد من بيانات الاعتماد في مشروع الماستر.' 
        });
    } finally {
        setIsLoading(false);
    }
  };

  const masterBackground = "linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #0f172a 100%)";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden text-white" dir="rtl" style={{ background: masterBackground }}>
      {/* Techno Aura Elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse" />
      
      <Card className="w-full max-w-md rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white/5 backdrop-blur-3xl border border-white/10 animate-in zoom-in-95 duration-700">
        <CardHeader className="py-12 px-8 text-center border-b border-white/5">
            <div className="bg-indigo-600/40 p-5 rounded-[2.5rem] w-fit mx-auto mb-6 backdrop-blur-xl border border-white/40 shadow-[0_0_40px_rgba(79,70,229,0.3)] transition-transform hover:rotate-6 duration-500">
                <Terminal className="h-12 w-12 text-white" />
            </div>
            <CardTitle className="text-3xl font-black tracking-tighter text-white flex items-center justify-center gap-3">
                Master Console
                <Activity className="h-5 w-5 text-blue-400 animate-pulse" />
            </CardTitle>
            <CardDescription className="text-indigo-200/50 font-black mt-2 text-[10px] uppercase tracking-[0.4em]">Nova ERP - Root Access Only</CardDescription>
        </CardHeader>
        
        <CardContent className="p-10 space-y-8">
            <form onSubmit={handleLogin} className="space-y-6">
                <div className="grid gap-2">
                    <Label className="font-black text-xs pr-1 flex items-center gap-2 text-indigo-200/70">
                        <User className="h-3 w-3" /> بريد المطور الرئيسي
                    </Label>
                    <Input 
                        type="email" 
                        value={formData.email} 
                        onChange={e => setFormData(p => ({...p, email: e.target.value}))} 
                        className="h-12 rounded-2xl border-white/10 bg-white/5 text-white dir-ltr font-black focus:bg-white/10 transition-all border-2 shadow-inner" 
                        placeholder="root@nova-erp.local"
                        required 
                    />
                </div>

                <div className="grid gap-2">
                    <Label className="font-black text-xs pr-1 flex items-center gap-2 text-indigo-200/70">
                        <Lock className="h-3 w-3" /> كلمة المرور السيادية
                    </Label>
                    <Input 
                        type="password" 
                        value={formData.password} 
                        onChange={e => setFormData(p => ({...p, password: e.target.value}))} 
                        className="h-12 rounded-2xl border-white/10 bg-white/5 text-white font-mono font-black focus:bg-white/10 transition-all border-2 shadow-inner" 
                        required 
                    />
                </div>

                <Button type="submit" disabled={isLoading} className="w-full h-14 rounded-2xl font-black text-xl gap-3 shadow-2xl shadow-indigo-900/50 bg-indigo-600 text-white hover:bg-indigo-500 transition-all active:scale-95 border-b-4 border-indigo-900">
                    {isLoading ? <Loader2 className="animate-spin h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
                    دخول المطور
                </Button>
            </form>
        </CardContent>
        <div className="bg-black/30 p-4 text-center border-t border-white/5">
            <p className="text-[10px] font-black text-indigo-400/60 uppercase tracking-[0.5em]">
                System Sovereign Environment v2.5
            </p>
        </div>
      </Card>
    </div>
  );
}
