'use client';

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
import { Loader2, Lock, ShieldCheck, Building2, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const { login } = useAuth();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [isDevMode, setIsDevMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    companyId: ''
  });

  useEffect(() => {
    if (!firestore) return;
    const fetchCompanies = async () => {
        try {
            const q = query(collection(firestore, 'companies'), where('isActive', '==', true), orderBy('name'));
            const snap = await getDocs(q);
            setCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() } as Company)));
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingCompanies(false);
        }
    };
    fetchCompanies();
  }, [firestore]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
        await login(formData.email, formData.password, isDevMode ? undefined : formData.companyId);
        toast({ title: 'تم الدخول بنجاح' });
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'فشل الدخول', description: error.message });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4" dir="rtl">
      <Card className="w-full max-w-md rounded-[2.5rem] shadow-2xl border-none overflow-hidden">
        <CardHeader className="bg-slate-900 text-white p-8 text-center">
            <div className="bg-white/10 p-4 rounded-3xl w-fit mx-auto mb-4 backdrop-blur-md">
                <ShieldCheck className="h-10 w-10 text-white" />
            </div>
            <CardTitle className="text-3xl font-black tracking-tight">Nova ERP</CardTitle>
            <CardDescription className="text-slate-400 font-bold mt-2">نظام الإدارة المتكامل متعدد الشركات</CardDescription>
        </CardHeader>
        
        <CardContent className="p-8 space-y-6 bg-white">
            <form onSubmit={handleLogin} className="space-y-6">
                {!isDevMode && (
                    <div className="grid gap-2">
                        <Label className="font-black text-xs pr-1 flex items-center gap-2">
                            <Building2 className="h-3 w-3" /> اختر الشركة
                        </Label>
                        <Select value={formData.companyId} onValueChange={(v) => setFormData(p => ({...p, companyId: v}))}>
                            <SelectTrigger className="h-12 rounded-2xl border-2 font-bold">
                                <SelectValue placeholder={loadingCompanies ? "جاري جلب الشركات..." : "اختر شركتك..."} />
                            </SelectTrigger>
                            <SelectContent dir="rtl">
                                {companies.map(c => <SelectItem key={c.id} value={c.id!}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                <div className="grid gap-2">
                    <Label className="font-black text-xs pr-1 flex items-center gap-2">
                        <User className="h-3 w-3" /> البريد الإلكتروني
                    </Label>
                    <Input 
                        type="email" 
                        value={formData.email} 
                        onChange={e => setFormData(p => ({...p, email: e.target.value}))} 
                        className="h-12 rounded-2xl border-2 dir-ltr font-bold" 
                        required 
                    />
                </div>

                <div className="grid gap-2">
                    <Label className="font-black text-xs pr-1 flex items-center gap-2">
                        <Lock className="h-3 w-3" /> كلمة المرور
                    </Label>
                    <Input 
                        type="password" 
                        value={formData.password} 
                        onChange={e => setFormData(p => ({...p, password: e.target.value}))} 
                        className="h-12 rounded-2xl border-2 font-mono" 
                        required 
                    />
                </div>

                <Button type="submit" disabled={isLoading} className="w-full h-12 rounded-2xl font-black text-lg gap-2">
                    {isLoading ? <Loader2 className="animate-spin" /> : "تسجيل الدخول"}
                </Button>
            </form>

            <div className="text-center pt-4">
                <Button 
                    variant="link" 
                    size="sm" 
                    onClick={() => setIsDevMode(!isDevMode)} 
                    className="text-muted-foreground text-xs font-bold"
                >
                    {isDevMode ? "العودة لدخول الشركات" : "دخول المطورين (Developer Mode)"}
                </Button>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
