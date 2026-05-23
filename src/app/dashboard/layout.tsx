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
 * تم تحسينه لضمان التمركز المطلق مع أنيميشن النبض.
 */
const NovaLogo = () => (
  <svg width="120" height="60" viewBox="0 0 100 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-pulse">
    <text 
      x="50%" 
      y="55%" 
      dominantBaseline="middle" 
      textAnchor="middle" 
      fontFamily="inherit" 
      fontWeight="900" 
      fontSize="36" 
      fill="#FF7A00"
      style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
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
    }, 8000); 
    return () => clearTimeout(timer);
  }, []);

  const handleSafeExit = () => {
    logout();
    router.replace('/');
  };

  // 🛡️ شاشة الموشن جرافيك المعتمدة والمحدثة (Motion Engine V2.0)
  if (loading || !mounted) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-16 bg-[#FFFDF0] relative overflow-hidden" dir="rtl">
        {/* هالات خلفية طافية */}
        <div className="absolute top-20 right-20 w-64 h-64 bg-orange-100/30 rounded-full blur-[80px] animate-float-slow" />
        <div className="absolute bottom-20 left-20 w-80 h-80 bg-orange-200/20 rounded-full blur-[100px] animate-float-slow" style={{ animationDelay: '2s' }} />

        <div className="relative flex flex-col items-center justify-center">
            {/* 🌟 محرك الحلقة الدوارة المحصن 🌟 */}
            <div className="relative flex items-center justify-center w-56 h-56">
                <div className="absolute inset-0 rounded-full border-[3px] border-slate-100 border-t-[#FF7A00] animate-spin-glow shadow-[0_0_15px_rgba(255,122,0,0.1)]" />
                
                {/* الهالة الذهبية الخفيفة المتغيرة */}
                <div className="absolute h-32 w-32 gold-glow-filter animate-gold-reverse rounded-full" />
                
                {/* الشعار المتمركز تماماً مع نبض هادئ */}
                <div className="relative z-10 scale-110">
                    <NovaLogo />
                </div>
            </div>
            
            <div className="mt-12 text-center space-y-4">
                <div className="flex items-center justify-center gap-2">
                    <p className="text-[#1e1b4b] font-black text-2xl tracking-tighter">جاري التحميل</p>
                    <span className="flex gap-1 pt-2">
                        <span className="h-1.5 w-1.5 bg-[#FF7A00] rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                        <span className="h-1.5 w-1.5 bg-[#FF7A00] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                        <span className="h-1.5 w-1.5 bg-[#FF7A00] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                    </span>
                </div>
                
                {showEmergencyExit && (
                    <div className="mt-4 flex flex-col gap-2 animate-in zoom-in-95 duration-500 bg-white/60 backdrop-blur-sm p-4 rounded-3xl border-2 border-white shadow-xl">
                        <p className="text-[10px] font-bold text-slate-400 mb-1">استغرق التحميل وقتاً أطول من المعتاد</p>
                        <div className="flex gap-2">
                            <Button onClick={() => window.location.reload()} variant="outline" className="h-9 rounded-xl font-black gap-2 text-[#1e1b4b] border-orange-200 text-xs px-4">
                                <RefreshCcw className="h-3 w-3" /> تحديث الصفحة
                            </Button>
                            <Button onClick={handleSafeExit} variant="ghost" className="h-9 rounded-xl font-black gap-2 text-red-600 hover:bg-red-50 text-xs px-4">
                                <LogOut className="h-3 w-3" /> خروج آمن
                            </Button>
                        </div>
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