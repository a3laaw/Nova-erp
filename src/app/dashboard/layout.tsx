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
 * تصميم عريض وبوليد يحاكي لقطة الشاشة تماماً.
 */
const NovaLogo = () => (
  <div className="relative flex items-center justify-center">
    <span className="text-5xl font-black tracking-tighter text-[#FF7A00] drop-shadow-sm select-none">
      NOVA
    </span>
  </div>
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

  // 🛡️ شاشة الموشن جرافيك السيادية المحدثة (Motion Engine V3.0)
  if (loading || !mounted) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-16 bg-[#FFFDF0] relative overflow-hidden" dir="rtl">
        {/* هالات خلفية ناعمة */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-orange-100/20 rounded-full blur-[120px] animate-float-slow" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-orange-200/10 rounded-full blur-[100px] animate-float-slow" style={{ animationDelay: '3s' }} />

        <div className="relative flex flex-col items-center justify-center">
            {/* 🌟 محرك الحلقة الدوارة الخاطفة 🌟 */}
            <div className="relative flex items-center justify-center w-64 h-64">
                {/* الحلقة الرمادية الخلفية */}
                <div className="absolute inset-0 rounded-full border-[1.5px] border-slate-200/40" />
                
                {/* الحلقة البرتقالية الدوارة (سريعة + تدرج لوني) */}
                <div className="absolute inset-0 rounded-full border-[3.5px] border-transparent border-t-[#FF7A00] animate-spin-sovereign shadow-[0_0_20px_rgba(255,122,0,0.05)]" />
                
                {/* الهالة النبضية */}
                <div className="absolute h-40 w-40 gold-glow-filter animate-gold-pulse rounded-full" />
                
                {/* الشعار المتمركز */}
                <div className="relative z-10">
                    <NovaLogo />
                </div>
            </div>
            
            <div className="mt-12 text-center space-y-4">
                <div className="flex items-center justify-center gap-3">
                    <p className="text-[#1e1b4b] font-black text-xl tracking-tight">جاري التحميل</p>
                    <div className="flex gap-1.5 pt-2">
                        <div className="h-1.5 w-1.5 bg-[#FF7A00] rounded-full animate-bounce-dots" style={{ animationDelay: '0s' }} />
                        <div className="h-1.5 w-1.5 bg-[#FF7A00] rounded-full animate-bounce-dots" style={{ animationDelay: '0.2s' }} />
                        <div className="h-1.5 w-1.5 bg-[#FF7A00] rounded-full animate-bounce-dots" style={{ animationDelay: '0.4s' }} />
                    </div>
                </div>
                
                {showEmergencyExit && (
                    <div className="mt-4 animate-in zoom-in-95 duration-500 bg-white/40 backdrop-blur-sm p-4 rounded-3xl border-2 border-white shadow-xl max-w-xs mx-auto">
                        <p className="text-[10px] font-bold text-slate-400 mb-2">استغرق التحميل وقتاً طويلاً</p>
                        <div className="flex gap-2">
                            <Button onClick={() => window.location.reload()} variant="outline" size="sm" className="flex-1 h-9 rounded-xl font-black text-[10px] gap-1.5 text-[#1e1b4b]">
                                <RefreshCcw className="h-3 w-3" /> تحديث
                            </Button>
                            <Button onClick={handleSafeExit} variant="ghost" size="sm" className="flex-1 h-9 rounded-xl font-black text-[10px] gap-1.5 text-red-600">
                                <LogOut className="h-3 w-3" /> خروج
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