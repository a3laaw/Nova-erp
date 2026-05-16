'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { MainNav } from '@/components/layout/main-nav';
import { Header } from '@/components/layout/header';
import { useAuth } from '@/context/auth-context';
import { 
    Loader, 
    AlertCircle, 
    RefreshCcw, 
    LogOut, 
    Wallet, 
    ShieldAlert, 
    AlertTriangle,
    CheckCircle2,
    CalendarClock,
    Zap,
    DatabaseZap
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/language-context';
import { Button } from '@/components/ui/button';
import { OfflineIndicator } from '@/context/sync-context';
import { SystemExpertChatWidget } from '@/components/ai/chat-widget';
import { isPast, differenceInDays } from 'date-fns';
import { toFirestoreDate } from '@/services/date-converter';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

/**
 * غلاف لوحة التحكم (Sovereign Shield Implementation V78.0):
 * تم تحديثه ليشمل تحذير مسح البيانات بعد شهر للنسخ الديمو والأساسية.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, company, loading, logout } = useAuth();
  const router = useRouter();
  const { language } = useLanguage();
  
  const [mounted, setMounted] = useState(false);
  const [showEmergencyExit, setShowEmergencyExit] = useState(false);
  const [hasAcknowledgedWarning, setHasAcknowledgedWarning] = useState(false);

  useEffect(() => {
    setMounted(true);
    // 🛡️ صمام أمان محلي: إذا استمر التحميل أكثر من 5 ثوانٍ، نظهر خيارات الإصلاح
    const timer = setTimeout(() => {
      setShowEmergencyExit(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const handleSafeExit = () => {
    logout();
    router.replace('/');
  };

  // 🛡️ حسابات الحالة المالية للشركة
  const { isExpired, isExpiringSoon, daysLeft, expiryDateFormatted, isTrial } = useMemo(() => {
    if (!company?.subscriptionExpiryDate) return { isExpired: false, isExpiringSoon: false, daysLeft: 999, isTrial: false };
    
    const expiry = toFirestoreDate(company.subscriptionExpiryDate);
    if (!expiry) return { isExpired: false, isExpiringSoon: false, daysLeft: 999, isTrial: false };

    const today = new Date();
    const expired = isPast(expiry);
    const diff = differenceInDays(expiry, today);
    
    return {
      isExpired: expired,
      isExpiringSoon: !expired && diff <= 7,
      daysLeft: diff,
      expiryDateFormatted: expiry.toLocaleDateString('en-GB'),
      isTrial: company.subscriptionType === 'trial'
    };
  }, [company]);

  // المطور السيادي لا يخضع للحظر أو الإنذار
  const isDev = user?.role === 'Developer' || user?.email === 'alaawaaheeb@gmail.com';

  // 1. معالجة حالة التحميل
  if (loading || !mounted) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-8 bg-[#1e1b4b] relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
        
        <div className="relative z-10 flex flex-col items-center gap-6">
            <div className="relative">
                <div className="h-24 w-24 rounded-full border-4 border-white/10 border-t-white animate-spin shadow-[0_0_30px_rgba(255,255,255,0.1)]" />
                <Loader className="h-10 w-10 text-white absolute inset-0 m-auto animate-pulse" />
            </div>
            <div className="text-center space-y-4">
                <p className="text-white font-black text-2xl tracking-tighter">جاري استعادة الجلسة السيادية...</p>
                {showEmergencyExit && (
                    <div className="flex flex-col gap-4 animate-in zoom-in-95 duration-500 max-w-xs mx-auto p-6 glass-effect rounded-3xl border-white/20 shadow-2xl">
                        <div className="flex items-center gap-2 text-orange-400 justify-center mb-2">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">تأخر في الاستجابة</span>
                        </div>
                        <Button onClick={() => window.location.reload()} variant="outline" className="h-11 rounded-xl font-bold gap-2 text-white border-white/40 hover:bg-white/20">
                            <RefreshCcw className="h-4 w-4" /> تحديث الصفحة
                        </Button>
                        <Button onClick={handleSafeExit} variant="ghost" className="h-11 rounded-xl font-black gap-2 text-red-400 hover:bg-red-500/10">
                            <LogOut className="h-4 w-4" /> خروج آمن وإصلاح
                        </Button>
                    </div>
                )}
            </div>
        </div>
      </div>
    );
  }

  // 2. التحقق من وجود المستخدم
  if (!user) {
    return (
       <div className="flex h-screen w-full flex-col items-center justify-center gap-4 text-center p-6 bg-[#1e1b4b]">
        <div className="p-6 bg-red-500/10 rounded-full border-2 border-red-500/20 mb-4">
            <AlertCircle className="h-12 w-12 text-red-400 animate-bounce" />
        </div>
        <h2 className="text-3xl font-black text-white tracking-tighter">انتهت جلسة العمل</h2>
        <p className="text-white/60 max-w-xs mx-auto font-medium">يرجى تسجيل الدخول مرة أخرى للوصول إلى بياناتك المعزولة.</p>
        <Button onClick={handleSafeExit} className="bg-white text-indigo-950 font-black px-16 h-14 rounded-2xl mt-8 shadow-2xl hover:bg-slate-100 active:scale-95 transition-all">بوابة الدخول</Button>
      </div>
    );
  }

  // 🛡️ درع الحظر المالي (Hard Block)
  if (!isDev && (isExpired || company?.isActive === false)) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center p-8 bg-slate-950 text-white text-center" dir="rtl">
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          
          <Card className="max-w-lg rounded-[3rem] border-red-500/20 bg-red-500/5 shadow-2xl p-12 relative z-10 animate-in zoom-in-95 duration-500">
              <div className="bg-red-600 p-6 rounded-full w-fit mx-auto mb-8 shadow-xl shadow-red-900/40">
                  <Wallet className="h-12 w-12 text-white" />
              </div>
              <h2 className="text-3xl font-black mb-4 tracking-tighter">تنبيه: توقف الخدمة مؤقتاً</h2>
              <p className="text-slate-300 font-bold mb-8 leading-relaxed">
                  نأسف لإبلاغكم بأن جلسة العمل لمنشأة <span className="text-red-400">"{company?.name}"</span> قد تم تجميدها آلياً لتجاوز موعد السداد.
                  <br/><br/>
                  <span className="text-red-500 font-black">تنبيه حماية البيانات:</span> سيتم الاحتفاظ ببياناتكم مشفرة لمدة 30 يوماً فقط من تاريخ الانتهاء ({expiryDateFormatted})، وبعد ذلك سيتم مسحها نهائياً من خوادمنا. يرجى المبادرة بالتسوية لضمان عدم ضياع الأرشيف الفني.
              </p>
              
              <div className="grid gap-4">
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                          <ShieldAlert className="h-5 w-5 text-red-400" />
                          <span className="text-xs font-black">إدارة المنظومة</span>
                      </div>
                      <span className="font-mono text-sm tracking-widest">Sovereign Support</span>
                  </div>
                  <Button onClick={handleSafeExit} variant="outline" className="h-12 rounded-xl font-black text-white border-white/20 hover:bg-white/10">
                      العودة لصفحة الدخول
                  </Button>
              </div>
          </Card>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <SidebarProvider>
          <Sidebar
            side={language === 'ar' ? 'right' : 'left'}
            className="no-print sidebar-glass border-none"
          >
            <MainNav currentUser={user} onLogout={handleSafeExit} />
          </Sidebar>
          <SidebarInset className="flex flex-col h-screen min-w-0 w-full bg-transparent">
            <Header currentUser={user} onLogout={handleSafeExit} className="no-print bg-transparent border-none" />
            <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 min-w-0">
              {children}
            </main>
            <OfflineIndicator />
            <SystemExpertChatWidget />
          </SidebarInset>
      </SidebarProvider>

      {/* 🛡️ نافذة الإنذار المبكر (Soft Block) - تظهر قبل 7 أيام من الانتهاء */}
      {!isDev && isExpiringSoon && !hasAcknowledgedWarning && (
        <Dialog open={true} onOpenChange={() => {}}>
            <DialogContent className="max-w-md rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white" dir="rtl">
                <div className="p-8 bg-amber-500 text-white text-right relative overflow-hidden">
                    <div className="absolute top-0 left-0 opacity-10">
                        <CalendarClock className="h-40 w-40 -translate-x-10 translate-y-10" />
                    </div>
                    <div className="relative z-10 flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md border border-white/30">
                            <AlertTriangle className="h-8 w-8 text-white" />
                        </div>
                        <div>
                            <DialogTitle className="text-2xl font-black text-white">تنبيه: اقتراب انتهاء المهلة</DialogTitle>
                            <DialogDescription className="text-amber-100 font-bold">إشعار {isTrial ? 'النسخة التجريبية' : 'الاشتراك السنوي'}</DialogDescription>
                        </div>
                    </div>
                </div>

                <div className="p-10 space-y-8">
                    <div className="space-y-6">
                        <p className="text-slate-700 font-bold leading-relaxed text-lg text-center">
                            نود إحاطتكم علماً بأن اشتراك منشأة <span className="text-amber-600">"{company?.name}"</span> 
                            سوف ينتهي خلال أقل من <span className="underline decoration-2 underline-offset-4">{daysLeft} أيام</span>.
                        </p>
                        
                        <div className="flex justify-between items-center p-6 bg-slate-50 rounded-[2rem] border-2 border-dashed border-amber-200 shadow-inner">
                            <div className="text-right">
                                <Label className="text-[10px] font-black uppercase text-slate-400">تاريخ الانتهاء المحدد</Label>
                                <p className="text-2xl font-black text-slate-900 font-mono">{expiryDateFormatted}</p>
                            </div>
                            <div className="bg-amber-100 p-3 rounded-2xl text-amber-600">
                                <Zap className="h-6 w-6" />
                            </div>
                        </div>

                        <div className="bg-red-50 p-4 rounded-2xl border border-red-100 flex gap-3">
                            <DatabaseZap className="h-5 w-5 text-red-600 shrink-0 mt-1" />
                            <div className="space-y-1">
                                <p className="text-xs font-black text-red-800">تحذير هام بخصوص بياناتكم:</p>
                                <p className="text-[10px] font-bold text-red-700 leading-normal">
                                    بمجرد انتهاء الاشتراك، ستظل بياناتكم محفوظة لدينا لمدة **شهر واحد فقط** كمهلة سداد، وبعدها سيتم مسح كافة الأرشيف الفني والمالي نهائياً من خوادم النظام لضمان خصوصية البيانات. يرجى المبادرة بالتسوية لضمان عدم ضياع الأرشيف الفني.
                                </p>
                            </div>
                        </div>
                    </div>

                    <Button 
                        onClick={() => setHasAcknowledgedWarning(true)}
                        className="w-full h-14 rounded-2xl font-black text-xl bg-amber-500 hover:bg-amber-600 text-white shadow-xl shadow-amber-100 gap-3"
                    >
                        <CheckCircle2 className="h-6 w-6" />
                        أقرأ وأفهم، دخول للنظام
                    </Button>
                </div>
                
                <div className="p-4 bg-muted/30 text-center border-t">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.4em]">Nova ERP - Sovereign Subscription Shield</p>
                </div>
            </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
