'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
    Activity,
    Phone,
    ShieldCheck
} from 'lucide-react';
import { useFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
        toast({ title: 'تم استلام طلبك', description: 'سيقوم فريق الدعم الفني بمراجعة طلبك وتفعيل باقة الـ Demo قريباً.' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'خطأ في الإرسال', description: 'يرجى المحاولة مرة أخرى لاحقاً.' });
    } finally {
        setIsSaving(false);
    }
  };

  if (isSuccess) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <Card className="w-full max-w-md rounded-[3.5rem] border-none shadow-2xl glass-effect p-12 text-center animate-in zoom-in-95 duration-500">
                <div className="bg-green-500/20 p-6 rounded-full w-fit mx-auto mb-6 border border-green-500/40 shadow-inner">
                    <CheckCircle2 className="h-16 w-16 text-green-600" />
                </div>
                <h2 className="text-3xl font-black text-[#1e1b4b] mb-4 tracking-tighter">تم إرسال طلبك بنجاح!</h2>
                <p className="text-[#1e1b4b]/70 font-bold mb-8 leading-relaxed">شكراً لثقتك بـ Nova ERP. سيتم مراجعة طلبك وتهيئة بيئة العمل الخاصة بك خلال 24 ساعة.</p>
                <Button asChild className="h-14 px-12 rounded-2xl bg-[#1e1b4b] text-white font-black hover:bg-black shadow-xl">
                    <Link href="/">العودة للرئيسية</Link>
                </Button>
            </Card>
        </div>
      );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" dir="rtl">
      {/* عناصر الإضاءة الخلفية المطورة */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-400/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-pink-400/20 rounded-full blur-[120px] animate-pulse" />

      <Card className="w-full max-w-2xl rounded-[3.5rem] border-none shadow-2xl overflow-hidden glass-effect animate-in slide-in-from-bottom-8 duration-700">
        <CardHeader className="py-12 px-10 border-b border-black/5 bg-white/20">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-5">
                    <div className="p-4 bg-white/60 rounded-[2rem] backdrop-blur-md border border-white shadow-xl transition-transform hover:scale-110 duration-500">
                        <Rocket className="h-10 w-10 text-[#1e1b4b]" />
                    </div>
                    <div>
                        <CardTitle className="text-3xl font-black text-[#1e1b4b] tracking-tighter flex items-center gap-2">
                            انضم لمستقبل الإدارة
                            <Sparkles className="h-5 w-5 text-indigo-600 animate-pulse" />
                        </CardTitle>
                        <CardDescription className="text-[#1e1b4b]/60 font-black mt-1 text-sm uppercase tracking-widest">تأسيس منشأة جديدة في Nova ERP</CardDescription>
                    </div>
                </div>
                <Button asChild variant="ghost" className="text-[#1e1b4b] hover:bg-white/40 rounded-xl gap-2 font-black">
                    <Link href="/">
                        <ArrowRight className="h-4 w-4 rotate-180" />
                        دخول الموظفين
                    </Link>
                </Button>
            </div>
        </CardHeader>
        
        <CardContent className="p-10">
            <form onSubmit={handleSubmit} className="space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {/* القسم الأول: بيانات المنشأة */}
                    <div className="space-y-6">
                        <h3 className="font-black text-[#1e1b4b] text-xs border-r-4 border-indigo-600 pr-3 uppercase tracking-[0.2em] flex items-center gap-2">
                            بيانات المنشأة الهندسية
                        </h3>
                        <div className="grid gap-5">
                            <div className="grid gap-2">
                                <Label className="text-[#1e1b4b]/80 font-black text-xs mr-1">اسم المكتب / الشركة *</Label>
                                <div className="relative group">
                                    <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-600/40 group-focus-within:text-indigo-600 transition-colors" />
                                    <Input 
                                        value={formData.companyName} 
                                        onChange={e => setFormData(p => ({...p, companyName: e.target.value}))} 
                                        className="pr-10 h-12 rounded-xl bg-white/80 border-2 border-transparent focus:border-indigo-600/20 shadow-inner font-bold text-[#1e1b4b]" 
                                        placeholder="مثال: مكتب الخليج للاستشارات"
                                        required 
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-[#1e1b4b]/80 font-black text-xs mr-1">نوع النشاط الرئيسي</Label>
                                <Select value={formData.activity} onValueChange={(v) => setFormData(p => ({...p, activity: v}))}>
                                    <SelectTrigger className="h-12 rounded-xl bg-white/80 border-2 border-transparent shadow-inner font-bold text-[#1e1b4b]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent dir="rtl" className="rounded-2xl border-none shadow-2xl">
                                        <SelectItem value="consulting" className="font-bold py-3">استشارات هندسية</SelectItem>
                                        <SelectItem value="construction" className="font-bold py-3">مقاولات وبناء</SelectItem>
                                        <SelectItem value="food_delivery" className="font-bold py-3">مطاعم وأغذية</SelectItem>
                                        <SelectItem value="general" className="font-bold py-3">تجاري عام</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* القسم الثاني: بيانات المدير */}
                    <div className="space-y-6">
                        <h3 className="font-black text-[#1e1b4b] text-xs border-r-4 border-indigo-600 pr-3 uppercase tracking-[0.2em]">حساب المدير السيادي</h3>
                        <div className="grid gap-5">
                            <div className="grid gap-2">
                                <Label className="text-[#1e1b4b]/80 font-black text-xs mr-1">اسم المدير المسؤول *</Label>
                                <div className="relative group">
                                    <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-600/40 group-focus-within:text-indigo-600" />
                                    <Input 
                                        value={formData.contactName} 
                                        onChange={e => setFormData(p => ({...p, contactName: e.target.value}))} 
                                        className="pr-10 h-12 rounded-xl bg-white/80 border-2 border-transparent shadow-inner font-bold text-[#1e1b4b]" 
                                        required 
                                        placeholder="الاسم الثلاثي..."
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-[#1e1b4b]/80 font-black text-xs mr-1">البريد الإلكتروني (للدخول) *</Label>
                                <div className="relative group">
                                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-600/40 group-focus-within:text-indigo-600" />
                                    <Input 
                                        type="email" 
                                        value={formData.email} 
                                        onChange={e => setFormData(p => ({...p, email: e.target.value}))} 
                                        className="pr-10 h-12 rounded-xl bg-white/80 border-2 border-transparent shadow-inner font-bold text-[#1e1b4b] dir-ltr" 
                                        required 
                                        placeholder="email@example.com"
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-[#1e1b4b]/80 font-black text-xs mr-1">كلمة المرور المطلوبة *</Label>
                                <div className="relative group">
                                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-600/40 group-focus-within:text-indigo-600" />
                                    <Input 
                                        type="password" 
                                        value={formData.adminPassword} 
                                        onChange={e => setFormData(p => ({...p, adminPassword: e.target.value}))} 
                                        className="pr-10 h-12 rounded-xl bg-white/80 border-2 border-transparent shadow-inner font-bold text-[#1e1b4b]" 
                                        placeholder="8 أحرف على الأقل"
                                        required 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid gap-3 max-w-sm">
                    <Label className="text-[#1e1b4b]/80 font-black text-xs mr-1">رقم التواصل (WhatsApp) *</Label>
                    <div className="relative group">
                        <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-600/40 group-focus-within:text-indigo-600" />
                        <Input 
                            value={formData.phone} 
                            onChange={e => setFormData(p => ({...p, phone: e.target.value}))} 
                            className="pr-10 h-12 rounded-xl bg-white/80 border-2 border-transparent shadow-inner font-bold text-[#1e1b4b] dir-ltr" 
                            required 
                            placeholder="+965 XXXXXXXX"
                        />
                    </div>
                </div>

                <div className="p-6 bg-indigo-600/5 rounded-3xl border-2 border-dashed border-indigo-600/20 flex items-center gap-5 backdrop-blur-sm shadow-inner">
                    <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg animate-bounce">
                        <Sparkles className="h-6 w-6 text-white" />
                    </div>
                    <p className="text-xs font-black text-[#1e1b4b]/80 leading-relaxed">
                        بمجرد إرسال الطلب، سيتم مراجعته وتهيئة <span className="text-indigo-600">رخصة المطور</span> لشركتك. ستحصل على فترة تجريبية كاملة لكافة المزايا السيادية للنظام.
                    </p>
                </div>

                <Button type="submit" disabled={isSaving} className="w-full h-16 rounded-[2.2rem] font-black text-xl gap-4 shadow-2xl bg-[#1e1b4b] text-white hover:bg-black transition-all active:scale-95 border-b-8 border-black/40">
                    {isSaving ? (
                        <>
                            <Loader2 className="animate-spin h-6 w-6" />
                            جاري تأسيس الطلب...
                        </>
                    ) : (
                        <>
                            <ShieldCheck className="h-6 w-6 text-green-400" />
                            اعتماد البيانات وتقديم الطلب
                        </>
                    )}
                </Button>
            </form>
        </CardContent>
        <div className="bg-white/10 p-6 text-center border-t border-black/5">
            <p className="text-[10px] font-black text-[#1e1b4b]/30 uppercase tracking-[0.6em]">
                Nova ERP — Universal Autonomous Gateway
            </p>
        </div>
      </Card>
    </div>
  );
}
