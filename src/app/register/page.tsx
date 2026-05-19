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
    Mail,
    User,
    Sparkles,
    MessageSquare,
    Smartphone
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * بوابة طلب الانضمام (Registration Gateway):
 * تم تبسيط اللغة لتكون مهنية وودودة (بيانات الحساب، بريد الإدارة).
 */
export default function RegisterPage() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const [formData, setFormData] = useState({
    companyName: '',
    activity: 'consulting',
    employeeCountRange: '1-5',
    contactName: '',
    email: '', 
    username: '', 
    phone: '', 
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore) return;
    
    if (!formData.username.trim() || !formData.email.trim() || !formData.companyName.trim()) {
        toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'يرجى تعبئة كافة الحقول المطلوبة.' });
        return;
    }

    setIsSaving(true);
    try {
        await addDoc(collection(firestore, 'company_requests'), {
            ...formData,
            status: 'pending',
            createdAt: serverTimestamp()
        });

        setIsSubmitted(true);
        toast({ title: '✅ تم إرسال طلبك بنجاح' });
    } catch (error: any) {
        toast({ 
            variant: 'destructive', 
            title: 'فشل الإرسال', 
            description: 'حدث خطأ أثناء محاولة إرسال الطلب. يرجى المحاولة لاحقاً.' 
        });
    } finally {
        setIsSaving(false);
    }
  };

  if (isSubmitted) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-[#FFFDF0]">
            <Card className="w-full max-w-lg rounded-[3.5rem] border-none shadow-2xl bg-white p-12 text-center animate-in zoom-in-95">
                <div className="bg-orange-500/10 p-6 rounded-[2.5rem] w-fit mx-auto mb-6 border border-orange-500/20 shadow-inner">
                    <CheckCircle2 className="h-16 w-16 text-[#FF7A00] animate-bounce" />
                </div>
                <h2 className="text-3xl font-black text-[#1e1b4b] mb-4 tracking-tighter">طلبك قيد المراجعة</h2>
                <p className="text-slate-500 font-bold mb-10 leading-relaxed text-lg">
                    شكراً لاهتمامك بـ Nova ERP. تم استلام بيانات منشأة <span className="text-[#FF7A00] font-black">{formData.companyName}</span>.
                    <br/><br/>
                    سيقوم فريقنا بمراجعة الطلب وتفعيل حسابك قريباً، وستصلك رسالة التفعيل على بريدك الإلكتروني.
                </p>
                
                <Button asChild variant="outline" className="h-14 rounded-2xl border-2 border-orange-200 text-[#FF7A00] font-black hover:bg-orange-50 shadow-sm w-full">
                    <Link href="/">العودة لصفحة الدخول</Link>
                </Button>
            </Card>
        </div>
      );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#FFFDF0]" dir="rtl">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-orange-200/20 to-transparent rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-amber-200/20 to-transparent rounded-full blur-[120px] pointer-events-none" />

      <Card className="w-full max-w-2xl rounded-[3.5rem] border-none shadow-2xl overflow-hidden bg-white/80 backdrop-blur-3xl relative z-10 animate-in fade-in duration-1000 border-white/60">
        <CardHeader className="py-10 px-10 border-b border-orange-100/30 bg-gradient-to-l from-orange-50/50 to-white/50">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-5">
                    <div className="p-4 bg-gradient-to-br from-[#FFB000] to-[#FF7A00] rounded-[2rem] shadow-xl border-4 border-white">
                        <MessageSquare className="h-8 w-8 text-white" />
                    </div>
                    <div className="text-right">
                        <CardTitle className="text-2xl font-black text-[#1e1b4b] tracking-tighter">طلب انضمام للمنظومة</CardTitle>
                        <CardDescription className="text-orange-600 font-black mt-1 text-[10px] uppercase tracking-widest flex items-center gap-2">
                            <Sparkles className="h-3 w-3 animate-pulse" />
                            تأسيس منشأة سحابية جديدة
                        </CardDescription>
                    </div>
                </div>
                <Button asChild variant="ghost" className="text-slate-500 hover:bg-orange-50 hover:text-[#FF7A00] rounded-xl gap-2 font-black h-10 px-4">
                    <Link href="/"><ArrowRight className="h-4 w-4 rotate-180" /> دخول الموظفين</Link>
                </Button>
            </div>
        </CardHeader>
        
        <CardContent className="p-10">
            <form onSubmit={handleSubmit} className="space-y-10" autoComplete="off">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 border-r-4 border-[#FF7A00] pr-4">
                            <h3 className="font-black text-[#1e1b4b] text-xs uppercase tracking-widest">بيانات المنشأة</h3>
                        </div>
                        <div className="grid gap-5">
                            <div className="grid gap-2">
                                <Label htmlFor="companyName" className="text-slate-500 font-black text-[11px] pr-1">اسم المكتب / الشركة *</Label>
                                <div className="relative group">
                                    <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-orange-500 transition-colors" />
                                    <Input 
                                        id="companyName"
                                        value={formData.companyName} 
                                        onChange={e => setFormData(p => ({...p, companyName: e.target.value}))} 
                                        className="h-11 rounded-xl border-2 bg-white/50 focus:bg-white transition-all font-bold pr-10 shadow-sm" 
                                        required 
                                        placeholder="الاسم التجاري..." 
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label className="text-slate-500 font-black text-[11px] pr-1">نوع النشاط</Label>
                                    <Select value={formData.activity} onValueChange={(v) => setFormData(p => ({...p, activity: v}))}>
                                        <SelectTrigger className="h-11 rounded-xl border-2 bg-white/50 font-black text-xs shadow-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent dir="rtl">
                                            <SelectItem value="consulting">استشارات هندسية</SelectItem>
                                            <SelectItem value="construction">مقاولات وبناء</SelectItem>
                                            <SelectItem value="general">تجارة عامة</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label className="text-slate-500 font-black text-[11px] pr-1">حجم الشركة</Label>
                                    <Select value={formData.employeeCountRange} onValueChange={(v) => setFormData(p => ({...p, employeeCountRange: v}))}>
                                        <SelectTrigger className="h-11 rounded-xl border-2 bg-white/50 font-black text-xs shadow-sm">
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
                        <div className="flex items-center gap-3 border-r-4 border-[#FF7A00] pr-4">
                            <h3 className="font-black text-[#1e1b4b] text-xs uppercase tracking-widest">بيانات التواصل</h3>
                        </div>
                        <div className="grid gap-5">
                            <div className="grid gap-2">
                                <Label htmlFor="contactName" className="text-slate-500 font-black text-[11px] pr-1">اسم المالك المسؤول *</Label>
                                <div className="relative group">
                                    <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-orange-500 transition-colors" />
                                    <Input 
                                        id="contactName"
                                        value={formData.contactName} 
                                        onChange={e => setFormData(p => ({...p, contactName: e.target.value}))} 
                                        className="h-11 rounded-xl border-2 bg-white/50 focus:bg-white transition-all font-bold pr-10 shadow-sm" 
                                        required 
                                        placeholder="الاسم الثلاثي..." 
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="phone" className="text-slate-500 font-black text-[11px] pr-1">رقم الهاتف (WhatsApp) *</Label>
                                <div className="relative group">
                                    <Smartphone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-orange-500 transition-colors" />
                                    <Input 
                                        id="phone" 
                                        value={formData.phone} 
                                        onChange={e => setFormData(p => ({...p, phone: e.target.value}))} 
                                        className="h-11 rounded-xl border-2 bg-white/50 focus:bg-white transition-all font-black dir-ltr text-right pr-10 shadow-sm" 
                                        required 
                                        placeholder="965+ XXXX XXXX" 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6 pt-4">
                    <div className="flex items-center gap-3 border-r-4 border-indigo-500 pr-4">
                        <h3 className="font-black text-[#1e1b4b] text-xs uppercase tracking-widest">بيانات الحساب والمدير</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="grid gap-2">
                            <Label htmlFor="email" className="text-slate-500 font-black text-[11px] pr-1">البريد الإلكتروني للإدارة *</Label>
                            <div className="relative group">
                                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                                <Input 
                                    id="email"
                                    type="email"
                                    value={formData.email} 
                                    onChange={e => setFormData(p => ({...p, email: e.target.value}))} 
                                    className="h-12 rounded-xl border-2 bg-white pr-10 dir-ltr font-bold shadow-sm" 
                                    required 
                                    placeholder="your@email.com" 
                                />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="username" className="text-slate-500 font-black text-[11px] pr-1">اسم المستخدم المقترح (ID) *</Label>
                            <div className="relative group">
                                <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                                <Input 
                                    id="username"
                                    value={formData.username} 
                                    onChange={e => setFormData(p => ({...p, username: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '')}))} 
                                    className="h-12 rounded-xl border-2 bg-white pr-10 dir-ltr font-black text-[#FF7A00] shadow-sm" 
                                    required 
                                    placeholder="e.g. alaa" 
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </CardContent>
        <CardFooter className="p-10 border-t bg-muted/10">
            <Button 
                onClick={handleSubmit} 
                disabled={isSaving} 
                className="w-full h-16 rounded-[2.2rem] font-black text-xl gap-4 shadow-2xl bg-gradient-to-r from-[#FF7A00] to-[#FFB000] text-white border-none transition-all active:scale-95 group"
            >
                {isSaving ? <Loader2 className="animate-spin h-6 w-6" /> : <Rocket className="h-6 w-6 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />}
                إرسال طلب الانضمام
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
