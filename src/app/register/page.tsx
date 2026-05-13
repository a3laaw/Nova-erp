
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
    Loader2, 
    Rocket, 
    Building2, 
    ArrowRight,
    CheckCircle2,
    ShieldCheck,
    Users
} from 'lucide-react';
import { useFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * بوابة تسجيل المنشآت (Sovereign Registration Gateway v8.0)
 * تم تصفير حقول الأمان (تلقائية بالكامل) وإضافة حقل حجم المنشأة.
 */
export default function RegisterPage() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [formData, setFormData] = useState({
    companyName: '',
    activity: 'consulting',
    employeeCountRange: '1-5', // القيمة الافتراضية
    contactName: '',
    username: '', 
    phone: '', 
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore) return;

    if (!formData.username.trim()) {
        toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'يرجى اختيار اسم مستخدم (ID) لتأسيس حسابك.' });
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

  if (isSuccess) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <Card className="w-full max-w-md rounded-[3.5rem] border-none shadow-2xl glass-effect p-12 text-center animate-in zoom-in-95">
                <div className="bg-green-500/20 p-6 rounded-full w-fit mx-auto mb-6 border border-green-500/40 shadow-inner">
                    <CheckCircle2 className="h-16 w-16 text-green-600" />
                </div>
                <h2 className="text-3xl font-black text-[#1e1b4b] mb-4 tracking-tighter">تم استلام طلبك!</h2>
                <p className="text-[#1e1b4b]/70 font-bold mb-8 leading-relaxed">
                    فريق Nova ERP سيقوم بمراجعة طلبك وتهيئة نظامك السحابي المعزول وتوليد رابط تفعيلك خلال ساعات.
                </p>
                <Button asChild className="h-14 px-12 rounded-2xl bg-[#1e1b4b] text-white font-black hover:bg-black shadow-xl">
                    <Link href="/">العودة للرئيسية</Link>
                </Button>
            </Card>
        </div>
      );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" dir="rtl">
      <Card className="w-full max-w-2xl rounded-[3.5rem] border-none shadow-2xl overflow-hidden glass-effect relative z-10 animate-in fade-in duration-700">
        <CardHeader className="py-10 px-10 border-b border-black/5 bg-white/20">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-5">
                    <div className="p-4 bg-[#1e1b4b] rounded-[2rem] shadow-xl"><Rocket className="h-8 w-8 text-white" /></div>
                    <div className="text-right">
                        <CardTitle className="text-2xl font-black text-[#1e1b4b] tracking-tighter">سجل منشأتك الآن</CardTitle>
                        <CardDescription className="text-[#1e1b4b]/60 font-black mt-1 text-[10px] uppercase tracking-widest">انضم إلى مجتمع Nova ERP السيادي</CardDescription>
                    </div>
                </div>
                <Button asChild variant="ghost" className="text-[#1e1b4b] hover:bg-white/40 rounded-xl gap-2 font-black h-10 px-4">
                    <Link href="/"><ArrowRight className="h-4 w-4 rotate-180" />دخول الموظفين</Link>
                </Button>
            </div>
        </CardHeader>
        
        <CardContent className="p-10">
            <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <h3 className="font-black text-[#1e1b4b] text-[10px] border-r-4 border-indigo-600 pr-3 uppercase tracking-widest">بيانات الشركة</h3>
                        <div className="grid gap-4">
                            <div className="grid gap-1.5">
                                <Label htmlFor="companyName" className="text-[#1e1b4b] font-black text-[11px] pr-1">اسم المكتب / الشركة *</Label>
                                <Input 
                                    id="companyName"
                                    value={formData.companyName} 
                                    onChange={e => setFormData(p => ({...p, companyName: e.target.value}))} 
                                    className="h-11 rounded-xl bg-white border-2 font-bold text-[#1e1b4b]" 
                                    required 
                                    placeholder="أدخل الاسم التجاري..." 
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="grid gap-1.5">
                                    <Label className="text-[#1e1b4b] font-black text-[11px] pr-1">نوع النشاط</Label>
                                    <Select value={formData.activity} onValueChange={(v) => setFormData(p => ({...p, activity: v}))}>
                                        <SelectTrigger className="h-11 rounded-xl bg-white border-2 font-black text-[#1e1b4b]">
                                            <SelectValue placeholder="النشاط..." />
                                        </SelectTrigger>
                                        <SelectContent dir="rtl">
                                            <SelectItem value="consulting">استشارات هندسية</SelectItem>
                                            <SelectItem value="construction">مقاولات وبناء</SelectItem>
                                            <SelectItem value="general">تجارة عامة</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-1.5">
                                    <Label className="text-[#1e1b4b] font-black text-[11px] pr-1">حجم الشركة</Label>
                                    <Select value={formData.employeeCountRange} onValueChange={(v) => setFormData(p => ({...p, employeeCountRange: v}))}>
                                        <SelectTrigger className="h-11 rounded-xl bg-white border-2 font-black text-[#1e1b4b]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent dir="rtl">
                                            <SelectItem value="1-5">1 - 5 موظف</SelectItem>
                                            <SelectItem value="5-11">5 - 11 موظف</SelectItem>
                                            <SelectItem value="11-50">11 - 50 موظف</SelectItem>
                                            <SelectItem value="100+">فوق 100 موظف</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <h3 className="font-black text-[#1e1b4b] text-[10px] border-r-4 border-indigo-600 pr-3 uppercase tracking-widest">بيانات التواصل والمدير</h3>
                        <div className="grid gap-4">
                            <div className="grid gap-1.5">
                                <Label htmlFor="contactName" className="text-[#1e1b4b] font-black text-[11px] pr-1">اسم المدير المسؤول *</Label>
                                <Input 
                                    id="contactName"
                                    value={formData.contactName} 
                                    onChange={e => setFormData(p => ({...p, contactName: e.target.value}))} 
                                    className="h-11 rounded-xl bg-white border-2 font-black text-[#1e1b4b]" 
                                    required 
                                    placeholder="الاسم الثلاثي..." 
                                />
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="phone" className="text-[#1e1b4b] font-black text-[11px] pr-1">رقم الهاتف (WhatsApp) *</Label>
                                <Input 
                                    id="phone" 
                                    value={formData.phone} 
                                    onChange={e => setFormData(p => ({...p, phone: e.target.value}))} 
                                    className="h-11 rounded-xl bg-white border-2 font-black dir-ltr text-right" 
                                    required 
                                    placeholder="965+ XXXX XXXX" 
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <h3 className="font-black text-[#1e1b4b] text-[10px] border-r-4 border-purple-600 pr-3 uppercase tracking-widest">إعدادات حساب دخول المالك</h3>
                    <div className="grid gap-1.5">
                        <Label htmlFor="username" className="text-[#1e1b4b] font-black text-[11px] pr-1">اسم المستخدم (Login ID) *</Label>
                        <div className="relative">
                            <Input 
                                id="username"
                                value={formData.username} 
                                onChange={e => setFormData(p => ({...p, username: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '')}))} 
                                className="h-12 rounded-xl border-2 border-slate-200 bg-white font-black text-primary dir-ltr" 
                                required 
                                autoComplete="off"
                                placeholder="مثال: alaa" 
                            />
                        </div>
                        <p className="text-[9px] text-muted-foreground font-bold pr-1">هذا هو المعرف الذي ستستخدمه دائماً للدخول إلى نظامك.</p>
                    </div>
                </div>
            </form>
        </CardContent>
        <CardFooter className="p-8 border-t bg-black/5">
            <Button onClick={handleSubmit} disabled={isSaving} className="w-full h-16 rounded-[2rem] font-black text-xl gap-4 shadow-2xl bg-[#1e1b4b] text-white hover:bg-black transition-all border-b-8 border-black/40 active:translate-y-1 active:border-b-0">
                {isSaving ? <Loader2 className="animate-spin h-6 w-6" /> : <ShieldCheck className="h-6 w-6 text-green-400" />}
                إرسال طلب التأسيس السيادي
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
