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
    Clock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * بوابة طلب الانضمام (Sovereign Request Gateway v15.0)
 * تم ترميمها لتكون أكثر استقراراً في معالجة الأخطاء السحابية.
 */
export default function RegisterPage() {
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
    
    if (!formData.username.trim() || !formData.email.trim() || !formData.companyName.trim()) {
        toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'يرجى تعبئة كافة الحقول المطلوبة.' });
        return;
    }

    setIsSaving(true);
    try {
        const response = await fetch('/api/manage-tenant-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'add_request',
                ...formData
            })
        });

        const result = await response.json();
        
        if (result.success) {
            setIsSubmitted(true);
            toast({ title: '✅ تم إرسال طلبك بنجاح' });
        } else {
            // معالجة خطأ غياب ملف الأمان بشكل سيادي
            if (result.error === 'MISSING_CONFIG') {
                throw new Error(result.message);
            }
            throw new Error(result.error || result.message);
        }
    } catch (error: any) {
        toast({ 
            variant: 'destructive', 
            title: 'تنبيه إداري', 
            description: error.message || 'يرجى مراجعة مدير النظام لإتمام الإعدادات.' 
        });
    } finally {
        setIsSaving(false);
    }
  };

  if (isSubmitted) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <Card className="w-full max-w-lg rounded-[3.5rem] border-none shadow-2xl glass-effect p-12 text-center animate-in zoom-in-95">
                <div className="bg-indigo-500/20 p-6 rounded-full w-fit mx-auto mb-6 border border-indigo-500/40 shadow-inner">
                    <Clock className="h-16 w-16 text-indigo-600 animate-pulse" />
                </div>
                <h2 className="text-3xl font-black text-[#1e1b4b] mb-2 tracking-tighter">طلبك قيد المراجعة السيادية</h2>
                <p className="text-[#1e1b4b]/70 font-bold mb-8 leading-relaxed">
                    شكراً لاهتمامك بـ Nova ERP. تم استلام بيانات منشأة **{formData.companyName}**.
                    <br/>
                    سيقوم فريقنا بمراجعة الطلب وتفعيل حسابك خلال دقائق، وستصلك رسالة التفعيل على بريدك الإلكتروني.
                </p>
                
                <div className="p-6 bg-white/60 rounded-3xl border-2 border-dashed border-indigo-500/30 mb-8 space-y-2">
                    <p className="text-xs font-black text-indigo-700 uppercase tracking-widest flex items-center justify-center gap-2">
                        <Sparkles className="h-4 w-4" /> ماذا يحدث الآن؟
                    </p>
                    <p className="text-[11px] text-muted-foreground font-medium italic leading-loose">
                        1. يقوم المدير باعتماد طلبك. <br/>
                        2. ستصلك دعوة رسمية لتعيين كلمة المرور. <br/>
                        3. يمكنك الدخول وبدء العمل فوراً.
                    </p>
                </div>

                <div className="flex flex-col gap-3">
                    <Button asChild variant="outline" className="h-14 rounded-2xl border-2 border-[#1e1b4b] text-[#1e1b4b] font-black hover:bg-indigo-50 shadow-sm">
                        <Link href="/">العودة لصفحة الدخول</Link>
                    </Button>
                </div>
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
                    <div className="p-4 bg-[#1e1b4b] rounded-[2rem] shadow-xl"><MessageSquare className="h-8 w-8 text-white" /></div>
                    <div className="text-right">
                        <CardTitle className="text-2xl font-black text-[#1e1b4b] tracking-tighter">طلب انضمام للمنظومة</CardTitle>
                        <CardDescription className="text-[#1e1b4b]/60 font-black mt-1 text-[10px] uppercase tracking-widest">تأسيس منشأة سحابية معزولة باحترافية SaaS</CardDescription>
                    </div>
                </div>
                <Button asChild variant="ghost" className="text-[#1e1b4b] hover:bg-white/40 rounded-xl gap-2 font-black h-10 px-4">
                    <Link href="/"><ArrowRight className="h-4 w-4 rotate-180" />دخول الموظفين</Link>
                </Button>
            </div>
        </CardHeader>
        
        <CardContent className="p-10">
            <form onSubmit={handleSubmit} className="space-y-8" autoComplete="off">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <h3 className="font-black text-[#1e1b4b] text-[10px] border-r-4 border-indigo-600 pr-3 uppercase tracking-widest">هوية المنشأة</h3>
                        <div className="grid gap-4">
                            <div className="grid gap-1.5">
                                <Label htmlFor="companyName" className="text-[#1e1b4b] font-black text-[11px] pr-1">اسم المكتب / الشركة *</Label>
                                <Input 
                                    id="companyName"
                                    value={formData.companyName} 
                                    onChange={e => setFormData(p => ({...p, companyName: e.target.value}))} 
                                    className="h-11 rounded-xl bg-white border-2 font-bold" 
                                    required 
                                    placeholder="أدخل الاسم التجاري..." 
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="grid gap-1.5">
                                    <Label className="text-[#1e1b4b] font-black text-[11px] pr-1">نوع النشاط</Label>
                                    <Select value={formData.activity} onValueChange={(v) => setFormData(p => ({...p, activity: v}))}>
                                        <SelectTrigger className="h-11 rounded-xl bg-white border-2 font-black">
                                            <SelectValue />
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
                                        <SelectTrigger className="h-11 rounded-xl bg-white border-2 font-black">
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
                        <h3 className="font-black text-[#1e1b4b] text-[10px] border-r-4 border-indigo-600 pr-3 uppercase tracking-widest">بيانات المالك</h3>
                        <div className="grid gap-4">
                            <div className="grid gap-1.5">
                                <Label htmlFor="contactName" className="text-[#1e1b4b] font-black text-[11px] pr-1">اسم المالك المسؤول *</Label>
                                <Input 
                                    id="contactName"
                                    value={formData.contactName} 
                                    onChange={e => setFormData(p => ({...p, contactName: e.target.value}))} 
                                    className="h-11 rounded-xl bg-white border-2 font-bold" 
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
                    <h3 className="font-black text-[#1e1b4b] text-[10px] border-r-4 border-purple-600 pr-3 uppercase tracking-widest">إعدادات العبور والأمان</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="grid gap-1.5">
                            <Label htmlFor="email" className="text-[#1e1b4b] font-black text-[11px] pr-1">البريد الحقيقي للتفعيل *</Label>
                            <div className="relative group">
                                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                                <Input 
                                    id="email"
                                    type="email"
                                    value={formData.email} 
                                    onChange={e => setFormData(p => ({...p, email: e.target.value}))} 
                                    className="h-12 rounded-xl border-2 bg-white pr-10 dir-ltr font-bold" 
                                    required 
                                    autoComplete="off"
                                    placeholder="your@email.com" 
                                />
                            </div>
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="username" className="text-[#1e1b4b] font-black text-[11px] pr-1">اسم المستخدم للدخول (ID) *</Label>
                            <div className="relative group">
                                <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                                <Input 
                                    id="username"
                                    value={formData.username} 
                                    onChange={e => setFormData(p => ({...p, username: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '')}))} 
                                    className="h-12 rounded-xl border-2 bg-white pr-10 dir-ltr font-black text-primary" 
                                    required 
                                    autoComplete="off"
                                    placeholder="e.g. alaa" 
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </CardContent>
        <CardFooter className="p-8 border-t bg-black/5">
            <Button onClick={handleSubmit} disabled={isSaving} className="w-full h-16 rounded-[2rem] font-black text-xl gap-4 shadow-2xl bg-[#1e1b4b] text-white hover:bg-black transition-all border-b-8 border-black/40 active:translate-y-1 active:border-b-0">
                {isSaving ? <Loader2 className="animate-spin h-6 w-6" /> : <Rocket className="h-6 w-6 text-green-400" />}
                إرسال طلب الانضمام للتدقيق
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
