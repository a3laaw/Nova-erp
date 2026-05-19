'use client';

import React, { useState, useEffect } from 'react';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { MainNav } from '@/components/layout/main-nav';
import { Header } from '@/components/layout/header';
import { useAuth } from '@/context/auth-context';
import { AlertCircle, RefreshCcw, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/language-context';
import { Button } from '@/components/ui/button';
import { OfflineIndicator } from '@/context/sync-context';
import { SystemExpertChatWidget } from '@/components/ai/chat-widget';

const NovaLogo = () => (
  <svg width="160" height="60" viewBox="0 0 160 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-pulse">
    <text 
      x="50%" 
      y="60%" 
      dominantBaseline="middle" 
      textAnchor="middle" 
      fontFamily="inherit" 
      fontWeight="900" 
      fontSize="42" 
      fill="url(#novaLoadingGradient)" 
      style={{ filter: 'drop-shadow(0px 0px 12px rgba(255,122,0,0.4))' }}
    >
      NOVA
    </text>
    <defs>
      <linearGradient id="novaLoadingGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#FFB000" />
        <stop offset="100%" stopColor="#FF7A00" />
      </linearGradient>
    </defs>
  </svg>
);

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

  if (loading || !mounted) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-8 bg-[#FFFDF0] relative overflow-hidden" dir="rtl">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] bg-[#FF7A00]/10 rounded-full blur-[120px] animate-pulse" />
        
        <div className="relative z-10 flex flex-col items-center gap-6">
            <div className="relative flex flex-col items-center">
                <div className="h-32 w-32 rounded-full border-4 border-primary/5 border-t-primary animate-spin shadow-[0_0_40px_rgba(255,122,0,0.15)] mb-4" />
                <div className="absolute inset-0 m-auto flex flex-col items-center justify-center">
                    <NovaLogo />
                </div>
            </div>
            <div className="text-center space-y-2">
                <p className="text-[#1e1b4b] font-black text-2xl tracking-tighter">جاري فتح جلسة العمل...</p>
                {showEmergencyExit && (
                    <div className="flex flex-col gap-4 animate-in zoom-in-95 duration-500 max-w-xs mx-auto p-6 glass-effect rounded-3xl border-white/20 shadow-2xl bg-white/40 mt-6">
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
        <div className="p-6 bg-red-50/10 rounded-full border-2 border-red-500/20 mb-4">
            <AlertCircle className="h-12 w-12 text-red-600 animate-bounce" />
        </div>
        <h2 className="text-3xl font-black text-[#1e1b4b] tracking-tighter">انتهت الجلسة</h2>
        <p className="text-slate-500 max-w-xs mx-auto font-medium">يرجى تسجيل الدخول مرة أخرى للوصول إلى البيانات.</p>
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