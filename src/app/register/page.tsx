'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
    Loader2, 
    Rocket, 
    Building2, 
    User, 
    Mail, 
    Lock, 
    ArrowRight,
    Sparkles,
    CheckCircle2,
    Phone,
    ShieldCheck
} from 'lucide-react';
import { useFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export default function RegisterPage() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [formData, setFormData] = useState({
    companyName: '',
    activity: 'consulting',
    contactName: '',
    email: '',
    phone: '',
    adminPassword: '',
    message: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore) return;

    if (formData.adminPassword.length < 8) {
        toast({ variant: 'destructive', title: 'كلمة مرور ضعيفة', description: 'يجب أن لا تقل كلمة المرور عن 8 أحرف.' });
        return;
    }

    setIsSaving(true);
    try {
        await addDoc(collection(firestore, 'company_requests'), {
            ...formData,
            status: 'pending',
            createdAt: serverTimestamp(),
        });
        setIsSuccess(true);
    } catch (error) {
        toast({ variant: 'destructive', title: 'خطأ في الإرسال' });
    } finally {
        setIsSaving(false);
    }
  };

  if (isSuccess) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <Card className="w-full max-w-md rounded-[3.5rem] border-none shadow-2xl glass-effect p-12 text-center animate-in zoom-in-95">
                <div className="bg-green-500/20 p-6 rounded-full w-fit mx-auto mb-6 border border-green-500/40"><CheckCircle2 className="h-16 w-16 text-green-600" /></div>
                <h2 className="text-3xl font-black text-[#1e1b4b] mb-4">تم الإرسال بنجاح!</h2>
                <p className="text-[#1e1b4b]/70 font-bold mb-8">سيتم مراجعة طلبك وتهيئة بيئة العمل الخاصة بك خلال 24 ساعة.</p>
                <Button asChild className="h-14 px-12 rounded-2xl bg-[#1e1b4b] text-white font-black hover:bg-black shadow-xl"><Link href="/">العودة للرئيسية</Link></Button>
            </Card>
        </div>
      );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" dir="rtl">
      <Card className="w-full max-w-2xl rounded-[3.5rem] border-none shadow-2xl overflow-hidden glass-effect">
        <CardHeader className="py-12 px-10 border-b border-black/5 bg-white/20">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-5">
                    <div className="p-4 bg-[#1e1b4b] rounded-[2rem] shadow-xl"><Rocket className="h-10 w-10 text-white" /></div>
                    <div>
                        <CardTitle className="text-3xl font-black text-[#1e1b4b] tracking-tighter">انضم لـ Nova ERP</CardTitle>
                        <CardDescription className="text-[#1e1b4b]/60 font-black mt-1 text-sm uppercase tracking-widest">تأسيس منشأة جديدة</CardDescription>
                    </div>
                </div>
                <Button asChild variant="ghost" className="text-[#1e1b4b] hover:bg-white/40 rounded-xl gap-2 font-black"><Link href="/"><ArrowRight className="h-4 w-4 rotate-180" />دخول الموظفين</Link></Button>
            </div>
        </CardHeader>
        
        <CardContent className="p-10">
            <form onSubmit={handleSubmit} className="space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                        <h3 className="font-black text-[#1e1b4b] text-xs border-r-4 border-indigo-600 pr-3 uppercase">بيانات المنشأة</h3>
                        <div className="grid gap-5">
                            <div className="grid gap-2">
                                <Label className="text-[#1e1b4b] font-black text-xs">اسم المكتب / الشركة *</Label>
                                <div className="relative group">
                                    <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-600" />
                                    <Input value={formData.companyName} onChange={e => setFormData(p => ({...p, companyName: e.target.value}))} className="pr-10 h-12 rounded-xl bg-white border-2 border-slate-200 shadow-inner font-black text-[#1e1b4b]" required />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-[#1e1b4b] font-black text-xs">نوع النشاط الرئيسي</Label>
                                <Select value={formData.activity} onValueChange={(v) => setFormData(p => ({...p, activity: v}))}>
                                    <SelectTrigger className="h-12 rounded-xl bg-white border-2 border-slate-200 font-black text-[#1e1b4b]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent dir="rtl">
                                        <SelectItem value="consulting">استشارات هندسية</SelectItem>
                                        <SelectItem value="construction">مقاولات وبناء</SelectItem>
                                        <SelectItem value="food_delivery">مطاعم وأغذية</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <h3 className="font-black text-[#1e1b4b] text-xs border-r-4 border-indigo-600 pr-3 uppercase">بيانات المدير</h3>
                        <div className="grid gap-5">
                            <div className="grid gap-2">
                                <Label className="text-[#1e1b4b] font-black text-xs">اسم المدير المسؤول *</Label>
                                <Input value={formData.contactName} onChange={e => setFormData(p => ({...p, contactName: e.target.value}))} className="h-12 rounded-xl bg-white border-2 border-slate-200 font-black text-[#1e1b4b]" required />
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-[#1e1b4b] font-black text-xs">البريد الإلكتروني *</Label>
                                <Input type="email" value={formData.email} onChange={e => setFormData(p => ({...p, email: e.target.value}))} className="h-12 rounded-xl bg-white border-2 border-slate-200 font-black text-[#1e1b4b] dir-ltr" required />
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-[#1e1b4b] font-black text-xs">كلمة المرور المطلوبة *</Label>
                                <Input type="password" value={formData.adminPassword} onChange={e => setFormData(p => ({...p, adminPassword: e.target.value}))} className="h-12 rounded-xl bg-white border-2 border-slate-200 font-black text-[#1e1b4b]" required />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid gap-3 max-w-sm">
                    <Label className="text-[#1e1b4b] font-black text-xs">رقم التواصل (WhatsApp) *</Label>
                    <Input value={formData.phone} onChange={e => setFormData(p => ({...p, phone: e.target.value}))} className="h-12 rounded-xl bg-white border-2 border-slate-200 font-black text-[#1e1b4b] dir-ltr" required />
                </div>

                <Button type="submit" disabled={isSaving} className="w-full h-16 rounded-[2.2rem] font-black text-xl gap-4 shadow-2xl bg-[#1e1b4b] text-white hover:bg-black transition-all border-b-8 border-black/40">
                    {isSaving ? <Loader2 className="animate-spin h-6 w-6" /> : <ShieldCheck className="h-6 w-6 text-green-400" />}
                    اعتماد البيانات وتقديم الطلب
                </Button>
            </form>
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