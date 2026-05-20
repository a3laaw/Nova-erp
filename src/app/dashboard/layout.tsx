'use client';

import React, { useState, useEffect } from 'react';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { MainNav } from '@/components/layout/main-nav';
import { Header } from '@/components/layout/header';
import { useAuth } from '@/context/auth-context';
import { AlertCircle, RefreshCcw, LogOut, Loader } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/language-context';
import { Button } from '@/components/ui/button';
import { OfflineIndicator } from '@/context/sync-context';
import { SystemExpertChatWidget } from '@/components/ai/chat-widget';

/**
 * شعار نوفا المعتمد (NOVA Text Logo):
 * تم تكبير الخط بنسبة 25% (من 32 إلى 40) لمركزية أعمق.
 */
const NovaLogo = () => (
  <svg width="120" height="50" viewBox="0 0 120 50" fill="none" xmlns="http://www.w3.org/2000/svg">
    <text 
      x="50%" 
      y="50%" 
      dominantBaseline="middle" 
      textAnchor="middle" 
      fontFamily="inherit" 
      fontWeight="900" 
      fontSize="40" 
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
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const handleSafeExit = () => {
    logout();
    router.replace('/');
  };

  // 🛡️ شاشة التحميل المعتمدة والمحدثة (Golden Reverse Glow)
  if (loading || !mounted) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-12 bg-[#FFFDF0] relative overflow-hidden" dir="rtl">
        <div className="relative flex flex-col items-center justify-center">
            {/* 🌟 الدائرة المصغرة والمتوهجة (تدور مع عقارب الساعة) 🌟 */}
            <div className="h-40 w-40 rounded-full border-4 border-slate-100 border-t-[#FF7A00] animate-spin-glow shadow-[0_0_30px_rgba(255,122,0,0.2)]" />
            
            {/* التمركز المطلق لاسم NOVA مع التوهج الذهبي العكسي */}
            <div className="absolute inset-0 flex items-center justify-center">
                {/* الهالة الذهبية (تدور عكس عقارب الساعة) */}
                <div className="absolute h-24 w-24 gold-glow-filter animate-gold-reverse rounded-full" />
                
                <div className="relative z-10">
                    <NovaLogo />
                </div>
            </div>
            
            <div className="absolute -bottom-16 text-center w-64">
                <p className="text-[#1e1b4b] font-black text-2xl tracking-tighter mt-12">جاري التحميل...</p>
                {showEmergencyExit && (
                    <div className="mt-4 flex flex-col gap-2 animate-in zoom-in-95 duration-500 glass-effect p-4 rounded-2xl border-white/20 shadow-xl">
                        <Button onClick={() => window.location.reload()} variant="outline" className="h-9 rounded-xl font-bold gap-2 text-[#1e1b4b] border-orange-200 text-xs">
                            <RefreshCcw className="h-3 w-3" /> تحديث الصفحة
                        </Button>
                        <Button onClick={handleSafeExit} variant="ghost" className="h-9 rounded-xl font-black gap-2 text-red-600 hover:bg-red-50 text-xs">
                            <LogOut className="h-3 w-3" /> خروج آمن وإصلاح
                        </Button>
                    </div>
                )}
            </div>
        </div>
      </div>
    );
  }

  // 🛡️ الحماية القصوى للمنشأة الموحدة
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
