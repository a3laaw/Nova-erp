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
 * شعار نوفا السيادي (The Sovereign NOVA Logo):
 * تصميم عريض وبوليد يحاكي لقطة الشاشة تماماً مع نبض داخلي.
 */
const NovaLogo = () => (
  <div className="relative flex items-center justify-center animate-in zoom-in-50 duration-1000">
    <span className="text-6xl font-black tracking-tighter text-[#FF7A00] drop-shadow-[0_0_15px_rgba(255,122,0,0.3)] select-none z-10">
      NOVA
    </span>
  </div>
);

/**
 * جزيئات غبار النجوم (Stardust Particles):
 * جزيئات تنطلق من المركز لمحاكاة الانفجار الكوني.
 */
const Stardust = () => {
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {Array.from({ length: 12 }).map((_, i) => (
                <div 
                    key={i} 
                    className="stardust-particle"
                    style={{
                        top: '50%',
                        left: '50%',
                        '--tw-translate-x': `${(Math.random() - 0.5) * 400}px`,
                        '--tw-translate-y': `${(Math.random() - 0.5) * 400}px`,
                        animationDelay: `${Math.random() * 2}s`,
                    } as any}
                />
            ))}
        </div>
    );
};

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

  // 🛡️ شاشة التحميل "انفجار النوفا" (Nova Explosion Engine V3.0) 🛡️
  if (loading || !mounted) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#FFFDF0] relative overflow-hidden" dir="rtl">
        {/* خلفية سديمية نابضة */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] nova-glow-nebula rounded-full" />
        
        {/* جزيئات الانفجار */}
        <Stardust />

        <div className="relative flex flex-col items-center justify-center scale-110 sm:scale-125">
            {/* 🌟 محرك النوفا الدوار 🌟 */}
            <div className="relative flex items-center justify-center w-64 h-64">
                {/* الحلقة الخلفية */}
                <div className="absolute inset-0 rounded-full border-[1.5px] border-slate-200/30" />
                
                {/* الحلقة المدارية السريعة */}
                <div className="absolute inset-0 rounded-full border-[4px] border-transparent border-t-[#FF7A00] animate-nova-spin shadow-[0_0_30px_rgba(255,122,0,0.1)]" />
                
                {/* الشعار المضيء */}
                <div className="relative z-20">
                    <NovaLogo />
                </div>
            </div>
            
            <div className="mt-16 text-center space-y-4">
                <div className="flex items-center justify-center gap-3">
                    <p className="text-[#1e1b4b] font-black text-xl tracking-tight opacity-80">جاري الاستعادة</p>
                    <div className="flex gap-1.5 pt-2">
                        <div className="h-1.5 w-1.5 bg-[#FF7A00] rounded-full animate-bounce-dots" style={{ animationDelay: '0s' }} />
                        <div className="h-1.5 w-1.5 bg-[#FF7A00] rounded-full animate-bounce-dots" style={{ animationDelay: '0.2s' }} />
                        <div className="h-1.5 w-1.5 bg-[#FF7A00] rounded-full animate-bounce-dots" style={{ animationDelay: '0.4s' }} />
                    </div>
                </div>
                
                {showEmergencyExit && (
                    <div className="mt-6 animate-in zoom-in-95 duration-500 glass-effect p-5 rounded-[2rem] border-2 border-white shadow-2xl max-w-xs mx-auto">
                        <p className="text-[10px] font-bold text-slate-400 mb-3">تأخر في الاستجابة السحابية</p>
                        <div className="flex gap-2">
                            <Button onClick={() => window.location.reload()} variant="outline" size="sm" className="flex-1 h-10 rounded-xl font-black text-[10px] gap-1.5 border-slate-200">
                                <RefreshCcw className="h-3 w-3" /> تحديث
                            </Button>
                            <Button onClick={handleSafeExit} variant="ghost" size="sm" className="flex-1 h-10 rounded-xl font-black text-[10px] gap-1.5 text-red-600">
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