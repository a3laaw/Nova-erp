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
                <div className="bg-green-500/20 p-6 rounded-full w-fit mx-auto mb-6 border border-green-500/40">
                    <CheckCircle2 className="h-16 w-16 text-white" />
                </div>
                <h2 className="text-3xl font-black text-white mb-4">تم إرسال طلبك بنجاح!</h2>
                <p className="text-white/80 font-bold mb-8">شكراً لثقتك بـ Nova ERP. سيتم مراجعة طلبك وتهيئة بيئة العمل الخاصة بك خلال 24 ساعة.</p>
                <Button asChild className="h-12 px-10 rounded-xl bg-white text-purple-700 font-black hover:bg-white/90">
                    <Link href="/">العودة للرئيسية</Link>
                </Button>
            </Card>
        </div>
      );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" dir="rtl">
      {/* Ambient Lights */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-400/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-pink-400/20 rounded-full blur-[120px] animate-pulse" />

      <Card className="w-full max-w-2xl rounded-[3.5rem] border-none shadow-2xl overflow-hidden glass-effect animate-in slide-in-from-bottom-8 duration-700">
        <CardHeader className="py-10 px-10 border-b border-white/10">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md border border-white/30 shadow-lg">
                        <Rocket className="h-8 w-8 text-white" />
                    </div>
                    <div>
                        <CardTitle className="text-3xl font-black text-white tracking-tighter flex items-center gap-2">
                            انضم لمستقبل الإدارة
                            <Sparkles className="h-5 w-5 text-yellow-300" />
                        </CardTitle>
                        <CardDescription className="text-white/70 font-bold">تسجيل منشأة جديدة في منصة Nova ERP</CardDescription>
                    </div>
                </div>
                <Button asChild variant="ghost" className="text-white hover:bg-white/10 rounded-xl gap-2 font-bold">
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
                    {/* Section 1: Facility Info */}
                    <div className="space-y-6">
                        <h3 className="font-black text-white/90 text-sm border-r-4 border-white/40 pr-3 uppercase tracking-widest flex items-center gap-2">
                            بيانات المنشأة
                        </h3>
                        <div className="grid gap-5">
                            <div className="grid gap-2">
                                <Label className="text-white/80 font-bold mr-1">اسم المكتب / الشركة *</Label>
                                <div className="relative group">
                                    <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 group-focus-within:text-white transition-colors" />
                                    <Input 
                                        value={formData.companyName} 
                                        onChange={e => setFormData(p => ({...p, companyName: e.target.value}))} 
                                        className="pr-10 h-12 glass-input rounded-xl placeholder:text-white/20" 
                                        placeholder="مثال: مكتب الخليج للاستشارات"
                                        required 
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-white/80 font-bold mr-1">نوع النشاط الرئيسي</Label>
                                <Select value={formData.activity} onValueChange={(v) => setFormData(p => ({...p, activity: v}))}>
                                    <SelectTrigger className="h-12 glass-input rounded-xl">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent dir="rtl">
                                        <SelectItem value="consulting">استشارات هندسية</SelectItem>
                                        <SelectItem value="construction">مقاولات وبناء</SelectItem>
                                        <SelectItem value="food_delivery">مطاعم وأغذية</SelectItem>
                                        <SelectItem value="general">تجاري عام</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Admin Info */}
                    <div className="space-y-6">
                        <h3 className="font-black text-white/90 text-sm border-r-4 border-white/40 pr-3 uppercase tracking-widest">بيانات حساب المدير</h3>
                        <div className="grid gap-5">
                            <div className="grid gap-2">
                                <Label className="text-white/80 font-bold mr-1">اسم المدير المسؤول *</Label>
                                <div className="relative group">
                                    <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 group-focus-within:text-white" />
                                    <Input 
                                        value={formData.contactName} 
                                        onChange={e => setFormData(p => ({...p, contactName: e.target.value}))} 
                                        className="pr-10 h-12 glass-input rounded-xl" 
                                        required 
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-white/80 font-bold mr-1">البريد الإلكتروني (للدخول) *</Label>
                                <div className="relative group">
                                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 group-focus-within:text-white" />
                                    <Input 
                                        type="email" 
                                        value={formData.email} 
                                        onChange={e => setFormData(p => ({...p, email: e.target.value}))} 
                                        className="pr-10 h-12 glass-input rounded-xl dir-ltr" 
                                        required 
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-white/80 font-bold mr-1">كلمة المرور المطلوبة *</Label>
                                <div className="relative group">
                                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 group-focus-within:text-white" />
                                    <Input 
                                        type="password" 
                                        value={formData.adminPassword} 
                                        onChange={e => setFormData(p => ({...p, adminPassword: e.target.value}))} 
                                        className="pr-10 h-12 glass-input rounded-xl" 
                                        placeholder="8 أحرف على الأقل"
                                        required 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid gap-2 max-w-sm">
                    <Label className="text-white/80 font-bold mr-1">رقم التواصل (WhatsApp) *</Label>
                    <div className="relative group">
                        <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 group-focus-within:text-white" />
                        <Input 
                            value={formData.phone} 
                            onChange={e => setFormData(p => ({...p, phone: e.target.value}))} 
                            className="pr-10 h-12 glass-input rounded-xl dir-ltr" 
                            required 
                        />
                    </div>
                </div>

                <div className="p-5 bg-white/10 rounded-2xl border border-white/20 flex items-center gap-4 backdrop-blur-sm">
                    <div className="p-2 bg-indigo-500 rounded-lg shadow-lg"><Sparkles className="h-5 w-5 text-white" /></div>
                    <p className="text-xs font-bold text-white/90 leading-relaxed">بمجرد التسجيل، ستحصل على 14 يوماً مجانية لاستكشاف كافة مزايا Nova ERP مع حد أقصى 5 مستخدمين.</p>
                </div>

                <Button type="submit" disabled={isSaving} className="w-full h-16 rounded-2xl font-black text-xl gap-3 shadow-2xl bg-white text-indigo-950 hover:bg-indigo-50 transition-all active:scale-95">
                    {isSaving ? <Loader2 className="animate-spin h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
                    تقديم طلب الانضمام وبدء التجربة
                </Button>
            </form>
        </CardContent>
        <div className="bg-black/20 p-6 text-center border-t border-white/10">
            <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.5em]">
                Nova ERP — Universal Autonomous Gateway
            </p>
        </div>
      </Card>
    </div>
  );
}
