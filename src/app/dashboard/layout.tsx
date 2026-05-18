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
    const timer = setTimeout(() => {
      setShowEmergencyExit(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const handleSafeExit = () => {
    logout();
    router.replace('/');
  };

  // 🎨 شاشة التحميل بالهوية الذهبية والبرتقالية 🎨
  if (loading || !mounted) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-8 bg-[#FFFDF0] relative overflow-hidden" dir="rtl">
        {/* هالة التوهج الذهبي-البرتقالي */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-primary/20 rounded-full blur-[100px] animate-pulse" />
        
        <div className="relative z-10 flex flex-col items-center gap-6">
            <div className="relative">
                <div className="h-24 w-24 rounded-full border-4 border-primary/10 border-t-primary animate-spin shadow-[0_0_40px_rgba(255,122,0,0.2)]" />
                <Loader className="h-10 w-10 text-primary absolute inset-0 m-auto animate-pulse" />
            </div>
            <div className="text-center space-y-4">
                <p className="text-[#1e1b4b] font-black text-2xl tracking-tighter">جاري الدخول للمنظومة...</p>
                {showEmergencyExit && (
                    <div className="flex flex-col gap-4 animate-in zoom-in-95 duration-500 max-w-xs mx-auto p-6 glass-effect rounded-3xl border-white/20 shadow-2xl bg-white/40">
                        <div className="flex items-center gap-2 text-primary justify-center mb-2">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">تأخر في الاستجابة</span>
                        </div>
                        <Button onClick={() => window.location.reload()} variant="outline" className="h-11 rounded-xl font-bold gap-2 border-primary/20 hover:bg-primary/5">
                            <RefreshCcw className="h-4 w-4" /> تحديث الصفحة
                        </Button>
                        <Button onClick={handleSafeExit} variant="ghost" className="h-11 rounded-xl font-black gap-2 text-red-600 hover:bg-red-50">
                            <LogOut className="h-4 w-4" /> خروج وإعادة محاولة
                        </Button>
                    </div>
                )}
            </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
       <div className="flex h-screen w-full flex-col items-center justify-center gap-4 text-center p-6 bg-[#FFFDF0]" dir="rtl">
        <div className="p-6 bg-red-500/10 rounded-full border-2 border-red-500/20 mb-4">
            <AlertCircle className="h-12 w-12 text-red-600 animate-bounce" />
        </div>
        <h2 className="text-3xl font-black text-[#1e1b4b] tracking-tighter">انتهت جلسة العمل</h2>
        <p className="text-slate-500 max-w-xs mx-auto font-medium">يرجى تسجيل الدخول مرة أخرى للوصول إلى بيانات منشأتك.</p>
        <Button onClick={handleSafeExit} className="bg-primary text-white font-black px-16 h-14 rounded-2xl mt-8 shadow-2xl hover:scale-105 transition-all">بوابة الدخول</Button>
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
