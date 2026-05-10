
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
    CheckCircle2,
    Phone,
    ShieldCheck
} from 'lucide-react';
import { useFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

/**
 * صفحة طلب انضمام شركة جديدة.
 * تم تصحيح الحجم ليكون max-w-xl لضمان مظهر متناسق.
 */
export default function RegisterPage() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [formData, setFormData] = useState({
    companyName: '',
    activity: 'consulting',
    contactName: '',
    email: '', // البريد الحقيقي للتواصل
    username: '', // اسم المستخدم للدخول (ID)
    phone: '', // رقم الجوال (WhatsApp)
    adminPassword: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore) return;

    if (formData.adminPassword.length < 8) {
        toast({ variant: 'destructive', title: 'كلمة مرور ضعيفة', description: 'يجب أن لا تقل كلمة المرور عن 8 أحرف لضمان أمان حسابك.' });
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
        toast({ variant: 'destructive', title: 'خطأ في الإرسال', description: 'يرجى المحاولة مرة أخرى لاحقاً.' });
    } finally {
        setIsSaving(false);
    }
  };

  const vibrantGlassBackground = "linear-gradient(135deg, #a5f3fc 0%, #818cf8 40%, #c084fc 70%, #f472b6 100%)";

  if (isSuccess) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ background: vibrantGlassBackground }}>
            <Card className="w-full max-w-md rounded-[3.5rem] border-none shadow-2xl glass-effect p-12 text-center animate-in zoom-in-95">
                <div className="bg-green-500/20 p-6 rounded-full w-fit mx-auto mb-6 border border-green-500/40">
                    <CheckCircle2 className="h-16 w-16 text-green-600" />
                </div>
                <h2 className="text-3xl font-black text-[#1e1b4b] mb-4">تم استلام طلبك!</h2>
                <p className="text-[#1e1b4b]/70 font-bold mb-8 leading-relaxed">
                    فريق Nova ERP سيقوم بمراجعة بياناتك وتهيئة نظامك الخاص خلال 24 ساعة كحد أقصى.
                </p>
                <Button asChild className="h-14 px-12 rounded-2xl bg-[#1e1b4b] text-white font-black hover:bg-black shadow-xl">
                    <Link href="/">العودة للرئيسية</Link>
                </Button>
            </Card>
        </div>
      );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" dir="rtl" style={{ background: vibrantGlassBackground }}>
      {/* 🛡️ الحجم المثالي لنموذج التسجيل هو max-w-xl 🛡️ */}
      <Card className="w-full max-w-xl rounded-[3.5rem] border-none shadow-2xl overflow-hidden glass-effect">
        <CardHeader className="py-12 px-10 border-b border-black/5 bg-white/20">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-5">
                    <div className="p-4 bg-[#1e1b4b] rounded-[2rem] shadow-xl"><Rocket className="h-10 w-10 text-white" /></div>
                    <div className="text-right">
                        <CardTitle className="text-3xl font-black text-[#1e1b4b] tracking-tighter">سجل منشأتك الآن</CardTitle>
                        <CardDescription className="text-[#1e1b4b]/60 font-black mt-1 text-sm uppercase tracking-widest">انضم إلى مجتمع Nova ERP</CardDescription>
                    </div>
                </div>
                <Button asChild variant="ghost" className="text-[#1e1b4b] hover:bg-white/40 rounded-xl gap-2 font-black">
                    <Link href="/"><ArrowRight className="h-4 w-4 rotate-180" />دخول الموظفين</Link>
                </Button>
            </div>
        </CardHeader>
        
        <CardContent className="p-10">
            <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <h3 className="font-black text-[#1e1b4b] text-xs border-r-4 border-indigo-600 pr-3 uppercase">بيانات الشركة</h3>
                        <div className="grid gap-4">
                            <div className="grid gap-1.5">
                                <Label className="text-[#1e1b4b] font-black text-xs pr-1">اسم المكتب / الشركة *</Label>
                                <Input 
                                    value={formData.companyName} 
                                    onChange={e => setFormData(p => ({...p, companyName: e.target.value}))} 
                                    className="h-11 rounded-xl bg-white border-2 font-bold text-[#1e1b4b]" 
                                    required 
                                    placeholder="أدخل الاسم التجاري..." 
                                />
                            </div>
                            <div className="grid gap-1.5">
                                <Label className="text-[#1e1b4b] font-black text-xs pr-1">نوع النشاط</Label>
                                <Select value={formData.activity} onValueChange={(v) => setFormData(p => ({...p, activity: v}))}>
                                    <SelectTrigger className="h-11 rounded-xl bg-white border-2 font-black text-[#1e1b4b]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent dir="rtl">
                                        <SelectItem value="consulting">استشارات هندسية</SelectItem>
                                        <SelectItem value="construction">مقاولات وبناء</SelectItem>
                                        <SelectItem value="general">تجارة عامة / مبيعات</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <h3 className="font-black text-[#1e1b4b] text-xs border-r-4 border-indigo-600 pr-3 uppercase">بيانات التواصل والمدير</h3>
                        <div className="grid gap-4">
                            <div className="grid gap-1.5">
                                <Label className="text-[#1e1b4b] font-black text-xs pr-1">اسم المدير المسؤول *</Label>
                                <Input 
                                    value={formData.contactName} 
                                    onChange={e => setFormData(p => ({...p, contactName: e.target.value}))} 
                                    className="h-11 rounded-xl bg-white border-2 font-black text-[#1e1b4b]" 
                                    required 
                                    placeholder="الاسم الثلاثي..." 
                                />
                            </div>
                            <div className="grid gap-1.5">
                                <Label className="text-[#1e1b4b] font-black text-xs pr-1">البريد الإلكتروني (للتواصل) *</Label>
                                <Input 
                                    type="email" 
                                    value={formData.email} 
                                    onChange={e => setFormData(p => ({...p, email: e.target.value}))} 
                                    className="h-11 rounded-xl bg-white border-2 font-bold dir-ltr" 
                                    required 
                                    placeholder="your@email.com" 
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <Separator />

                <div className="space-y-6">
                    <h3 className="font-black text-[#1e1b4b] text-xs border-r-4 border-purple-600 pr-3 uppercase">إعدادات حساب الدخول</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="grid gap-1.5">
                            <Label className="text-[#1e1b4b] font-black text-xs pr-1">اسم المستخدم (Login ID) *</Label>
                            <Input 
                                value={formData.username} 
                                onChange={e => setFormData(p => ({...p, username: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '')}))} 
                                className="h-11 rounded-xl bg-white border-2 font-black text-primary dir-ltr" 
                                required 
                                placeholder="example: alaa" 
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label className="text-[#1e1b4b] font-black text-xs pr-1">رقم الهاتف (WhatsApp) *</Label>
                            <Input 
                                value={formData.phone} 
                                onChange={e => setFormData(p => ({...p, phone: e.target.value}))} 
                                className="h-11 rounded-xl bg-white border-2 font-black dir-ltr" 
                                required 
                                placeholder="+965 XXXX XXXX" 
                            />
                        </div>
                        <div className="grid gap-1.5 md:col-span-2">
                            <Label className="text-[#1e1b4b] font-black text-xs pr-1">كلمة المرور *</Label>
                            <Input 
                                type="password" 
                                value={formData.adminPassword} 
                                onChange={e => setFormData(p => ({...p, adminPassword: e.target.value}))} 
                                className="h-11 rounded-xl bg-white border-2 font-bold" 
                                required 
                                placeholder="********" 
                            />
                        </div>
                    </div>
                </div>

                <Button type="submit" disabled={isSaving} className="w-full h-16 rounded-[2.2rem] font-black text-xl gap-4 shadow-2xl bg-[#1e1b4b] text-white hover:bg-black transition-all border-b-8 border-black/40 active:translate-y-1 active:border-b-0 mt-4">
                    {isSaving ? <Loader2 className="animate-spin h-6 w-6" /> : <ShieldCheck className="h-6 w-6 text-green-400" />}
                    إرسال طلب التأسيس
                </Button>
            </form>
        </CardContent>
      </Card>
    </div>
  );
}
