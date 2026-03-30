'use client';

import React, { useState, useEffect } from 'react';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { MainNav } from '@/components/layout/main-nav';
import { Header } from '@/components/layout/header';
import { useAuth } from '@/context/auth-context';
import { Loader, AlertCircle, RefreshCcw, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/language-context';
import { Button } from '@/components/ui/button';
import { OfflineIndicator } from '@/context/sync-context';
import { SystemExpertChatWidget } from '@/components/ai/chat-widget';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const { language } = useLanguage();
  
  const [mounted, setMounted] = useState(false);
  const [showEmergencyExit, setShowEmergencyExit] = useState(false);

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
    </div>
  );
}
