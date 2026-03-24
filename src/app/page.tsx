
'use client';

/**
 * @fileOverview بوابة دخول الشركات (Main Client Gateway).
 * تم تصميمها بنمط Glass Pearl لتعكس الفخامة والاحترافية.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import type { Company } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Lock, ShieldCheck, Building2, User, Sparkles, LogIn } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const { login } = useAuth();
  const { firestore: masterFirestore } = useFirebase();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    companyId: ''
  });

  useEffect(() => {
    if (!masterFirestore) return;
    const fetchCompanies = async () => {
        try {
            const q = query(collection(masterFirestore, 'companies'), where('isActive', '==', true), orderBy('name'));
            const snap = await getDocs(q);
            setCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() } as Company)));
        } catch (e) {
            console.error("Master Company Fetch Error:", e);
        } finally {
            setLoadingCompanies(false);
        }
    };
    fetchCompanies();
  }, [masterFirestore]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyId) {
        toast({ variant: 'destructive', title: 'تنبيه إجرائي', description: 'يرجى اختيار المنشأة التابع لها أولاً.' });
        return;
    }
    setIsLoading(true);
    try {
        await login(formData.email, formData.password, formData.companyId);
        toast({ title: 'مرحباً بك في Nova ERP' });
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'فشل تسجيل الدخول', description: error.message || 'تأكد من بيانات الاعتماد.' });
    } finally {
        setIsLoading(false);
    }
  };

  const vibrantGlassBackground = "linear-gradient(135deg, #a5f3fc 0%, #818cf8 40%, #c084fc 70%, #f472b6 100%)";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" dir="rtl" style={{ background: vibrantGlassBackground }}>
      {/* Background Decorative Elements */}
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
            <CardDescription className="text-[#1e1b4b]/70 font-black mt-2 text-sm uppercase tracking-[0.3em]">إدارة الأعمال المتكاملة</CardDescription>
        </CardHeader>
        
        <CardContent className="p-10 space-y-8">
            <form onSubmit={handleLogin} className="space-y-6">
                <div className="grid gap-2">
                    <Label className="font-black text-xs pr-1 flex items-center gap-2 text-[#1e1b4b]">
                        <Building2 className="h-3 w-3" /> اختر منشأتك
                    </Label>
                    <Select value={formData.companyId} onValueChange={(v) => setFormData(p => ({...p, companyId: v}))}>
                        <SelectTrigger className="h-12 rounded-2xl border-white/40 bg-white/30 backdrop-blur-md font-black text-[#1e1b4b] shadow-inner hover:bg-white/50 transition-all border-2">
                            <SelectValue placeholder={loadingCompanies ? "جاري جلب المنشآت..." : "اختر الشركة/المكتب..."} />
                        </SelectTrigger>
                        <SelectContent dir="rtl" className="rounded-2xl border-none shadow-2xl backdrop-blur-xl bg-white/95">
                            {companies.map(c => <SelectItem key={c.id} value={c.id!} className="font-bold py-3">{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid gap-2">
                    <Label className="font-black text-xs pr-1 flex items-center gap-2 text-[#1e1b4b]">
                        <User className="h-3 w-3" /> البريد الإلكتروني للموظف
                    </Label>
                    <Input 
                        type="email" 
                        value={formData.email} 
                        onChange={e => setFormData(p => ({...p, email: e.target.value}))} 
                        className="h-12 rounded-2xl border-white/40 bg-white/30 backdrop-blur-md dir-ltr font-black text-[#1e1b4b] shadow-inner focus:bg-white/60 transition-all border-2" 
                        required 
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
                        className="h-12 rounded-2xl border-white/40 bg-white/30 backdrop-blur-md font-mono font-black text-[#1e1b4b] shadow-inner focus:bg-white/60 transition-all border-2" 
                        required 
                    />
                </div>

                <Button type="submit" disabled={isLoading} className="w-full h-14 rounded-2xl font-black text-xl gap-3 shadow-2xl shadow-indigo-900/20 bg-[#1e1b4b] text-white hover:bg-black transition-all active:scale-95 border-b-4 border-black">
                    {isLoading ? <Loader2 className="animate-spin h-6 w-6" /> : <LogIn className="h-6 w-6" />}
                    دخول المنصة
                </Button>
            </form>
        </CardContent>
        <div className="bg-white/10 p-4 text-center border-t border-white/10">
            <p className="text-[10px] font-black text-[#1e1b4b]/40 uppercase tracking-widest">
                Nova ERP — Future of Business v2.5
            </p>
        </div>
      </Card>
    </div>
  );
}
