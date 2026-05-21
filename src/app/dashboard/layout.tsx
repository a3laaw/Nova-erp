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

/**
 * شعار نوفا المعتمد (NOVA Text Logo):
 * تم تحسينه لضمان التمركز المطلق.
 */
const NovaLogo = () => (
  <svg width="100" height="40" viewBox="0 0 100 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <text 
      x="50%" 
      y="55%" 
      dominantBaseline="middle" 
      textAnchor="middle" 
      fontFamily="inherit" 
      fontWeight="900" 
      fontSize="32" 
      fill="#FF7A00"
    >
      NOVA
    </text>
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
    }, 8000); // Increased timeout for lighter feel
    return () => clearTimeout(timer);
  }, []);

  const handleSafeExit = () => {
    logout();
    router.replace('/');
  };

  // 🛡️ شاشة التحميل المعتمدة والمحدثة (Optimized Performance)
  if (loading || !mounted) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-12 bg-[#FFFDF0] relative overflow-hidden" dir="rtl">
        <div className="relative flex items-center justify-center w-48 h-48">
            {/* 🌟 الدائرة الخارجية (دوران بسيط وخفيف) 🌟 */}
            <div className="absolute inset-0 rounded-full border-2 border-slate-100 border-t-[#FF7A00] animate-spin-glow" />
            
            {/* الهالة الذهبية الخفيفة */}
            <div className="absolute h-24 w-24 gold-glow-filter animate-gold-reverse rounded-full" />
            
            {/* الشعار المتمركز تماماً */}
            <div className="relative z-10">
                <NovaLogo />
            </div>
            
            <div className="absolute -bottom-16 text-center w-64">
                <p className="text-[#1e1b4b] font-black text-xl tracking-tighter">جاري التحميل...</p>
                {showEmergencyExit && (
                    <div className="mt-4 flex flex-col gap-2 animate-in zoom-in-95 duration-500 bg-white/40 backdrop-blur-sm p-3 rounded-2xl border border-white/20 shadow-lg">
                        <Button onClick={() => window.location.reload()} variant="outline" className="h-8 rounded-xl font-bold gap-2 text-[#1e1b4b] border-orange-200 text-[10px]">
                            <RefreshCcw className="h-3 w-3" /> تحديث الصفحة
                        </Button>
                        <Button onClick={handleSafeExit} variant="ghost" className="h-8 rounded-xl font-black gap-2 text-red-600 hover:bg-red-50 text-[10px]">
                            <LogOut className="h-3 w-3" /> خروج آمن
                        </Button>
                    </div>
                )}
            </div>
        </div>
      </div>
    );
  }

  if (!user || !user.currentCompanyId) {
    return (
       <div className="flex h-screen w-full flex-col items-center justify-center gap-4 text-center p-6 bg-[#FFFDF0]" dir="rtl">
        <AlertCircle className="h-12 w-12 text-red-600 animate-bounce" />
        <h2 className="text-3xl font-black text-[#1e1b4b]">انتهت جلسة العمل</h2>
        <p className="text-slate-500 font-bold">يرجى تسجيل الدخول مرة أخرى للوصول إلى بيانات المنشأة.</p>
        <Button onClick={handleSafeExit} className="bg-primary text-white font-black px-16 h-14 rounded-2xl mt-8 shadow-2xl">بوابة الدخول</Button>
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
