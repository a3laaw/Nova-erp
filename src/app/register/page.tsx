
'use client';

/**
 * @fileOverview بوابة تسجيل الشركات الجديدة (External Registration).
 * تتيح لأصحاب المكاتب تقديم طلبات الانضمام بنظام الـ SaaS.
 */

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
    Phone, 
    Save, 
    ShieldCheck, 
    ArrowRight,
    Sparkles,
    CheckCircle2
} from 'lucide-react';
import { useFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function RegisterPage() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [formData, setFormData] = useState({
    companyName: '',
    activity: '',
    contactName: '',
    email: '',
    phone: '',
    message: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore) return;

    setIsSaving(true);
    try {
        // تسجيل طلب الشركة في مشروع الماستر (كـ Lead أو Pending Company)
        await addDoc(collection(firestore, 'company_requests'), {
            ...formData,
            status: 'pending',
            createdAt: serverTimestamp(),
        });

        setIsSuccess(true);
        toast({ title: 'تم استلام طلبك', description: 'سيقوم فريق الدعم الفني بالتواصل معك قريباً لتفعيل منشأتك.' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'خطأ في الإرسال', description: 'يرجى المحاولة مرة أخرى لاحقاً.' });
    } finally {
        setIsSaving(false);
    }
  };

  const vibrantGlassBackground = "linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)";

  if (isSuccess) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ background: vibrantGlassBackground }}>
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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" dir="rtl" style={{ background: vibrantGlassBackground }}>
      {/* Background Decor */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-400/20 rounded-full blur-[120px] animate-pulse" />
      
      <Card className="w-full max-w-2xl rounded-[3.5rem] border-none shadow-2xl overflow-hidden glass-effect animate-in slide-in-from-bottom-8 duration-700">
        <CardHeader className="py-10 px-10 border-b border-white/20">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/30 rounded-2xl backdrop-blur-md border border-white/40">
                        <Rocket className="h-8 w-8 text-white" />
                    </div>
                    <div>
                        <CardTitle className="text-3xl font-black text-white tracking-tighter flex items-center gap-2">
                            انضم لمستقبل الإدارة
                            <Sparkles className="h-5 w-5 text-yellow-300" />
                        </CardTitle>
                        <CardDescription className="text-white/70 font-bold">تسجيل منشأة هندسية جديدة في منصة Nova ERP</CardDescription>
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
            <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <h3 className="font-black text-white/90 text-sm border-r-4 border-white/40 pr-3">بيانات المنشأة</h3>
                        <div className="grid gap-4">
                            <div className="grid gap-2">
                                <Label className="text-white/80 font-bold mr-1">اسم المكتب / الشركة *</Label>
                                <div className="relative">
                                    <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                                    <Input 
                                        value={formData.companyName} 
                                        onChange={e => setFormData(p => ({...p, companyName: e.target.value}))} 
                                        className="pr-10 h-11 rounded-xl bg-white/10 border-white/20 text-white placeholder:text-white/30 font-bold" 
                                        placeholder="مثال: شركة الخليج للاستشارات"
                                        required 
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-white/80 font-bold mr-1">نوع النشاط</Label>
                                <Input 
                                    value={formData.activity} 
                                    onChange={e => setFormData(p => ({...p, activity: e.target.value}))} 
                                    className="h-11 rounded-xl bg-white/10 border-white/20 text-white font-bold" 
                                    placeholder="تصميم، إشراف، مقاولات..." 
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <h3 className="font-black text-white/90 text-sm border-r-4 border-white/40 pr-3">بيانات المسؤول</h3>
                        <div className="grid gap-4">
                            <div className="grid gap-2">
                                <Label className="text-white/80 font-bold mr-1">اسم المدير المسؤول *</Label>
                                <div className="relative">
                                    <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                                    <Input 
                                        value={formData.contactName} 
                                        onChange={e => setFormData(p => ({...p, contactName: e.target.value}))} 
                                        className="pr-10 h-11 rounded-xl bg-white/10 border-white/20 text-white font-bold" 
                                        required 
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-white/80 font-bold mr-1">البريد الرسمي *</Label>
                                <div className="relative">
                                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                                    <Input 
                                        type="email" 
                                        value={formData.email} 
                                        onChange={e => setFormData(p => ({...p, email: e.target.value}))} 
                                        className="pr-10 h-11 rounded-xl bg-white/10 border-white/20 text-white dir-ltr font-bold" 
                                        required 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid gap-2">
                    <Label className="text-white/80 font-bold mr-1">رقم التواصل (WhatsApp) *</Label>
                    <div className="relative max-w-sm">
                        <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                        <Input 
                            value={formData.phone} 
                            onChange={e => setFormData(p => ({...p, phone: e.target.value}))} 
                            className="pr-10 h-11 rounded-xl bg-white/10 border-white/20 text-white dir-ltr font-bold" 
                            required 
                        />
                    </div>
                </div>

                <div className="grid gap-2">
                    <Label className="text-white/80 font-bold mr-1">متطلبات خاصة أو استفسارات</Label>
                    <Textarea 
                        value={formData.message} 
                        onChange={e => setFormData(p => ({...p, message: e.target.value}))} 
                        className="rounded-2xl bg-white/10 border-white/20 text-white font-medium p-4" 
                        rows={3} 
                    />
                </div>

                <Button type="submit" disabled={isSaving} className="w-full h-14 rounded-2xl font-black text-xl gap-3 shadow-2xl bg-white text-purple-700 hover:bg-white/90 transition-all border-b-4 border-purple-200">
                    {isSaving ? <Loader2 className="animate-spin h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
                    تقديم طلب التسجيل السيادي
                </Button>
            </form>
        </CardContent>
        <CardFooter className="bg-black/20 p-6 flex justify-center border-t border-white/10">
            <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.5em]">
                Nova ERP — SaaS Infrastructure Layer v2.5
            </p>
        </CardFooter>
      </Card>
    </div>
  );
}
