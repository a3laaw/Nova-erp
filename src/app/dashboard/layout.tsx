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
 * جزيئات غبار النجوم (Stardust Blast Engine):
 * توليد جسيمات تنطلق من المركز بمحاكاة عشوائية.
 */
const Stardust = () => {
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {Array.from({ length: 24 }).map((_, i) => (
                <div 
                    key={i} 
                    className="stardust-particle"
                    style={{
                        top: '50%',
                        left: '50%',
                        '--tw-translate-x': `${(Math.random() - 0.5) * 600}px`,
                        '--tw-translate-y': `${(Math.random() - 0.5) * 600}px`,
                        animationDelay: `${Math.random() * 3}s`,
                        width: `${Math.random() * 3 + 1}px`,
                        height: `${Math.random() * 3 + 1}px`
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

  // 🛡️ شاشة التحميل "انفجار النوفا" (Nova Blast Loading V3.5) 🛡️
  if (loading || !mounted) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#FFFDF0] relative overflow-hidden" dir="rtl">
        {/* هالة السديم النبضية */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] nova-glow-nebula rounded-full" />
        
        {/* جزيئات الانفجار (Sparks) */}
        <Stardust />

        <div className="relative flex flex-col items-center justify-center">
            {/* 🌟 وحدة النواة والمدار 🌟 */}
            <div className="relative flex items-center justify-center w-72 h-72 scale-110 sm:scale-125">
                {/* الدوائر المدارية المتوهجة */}
                <div className="absolute inset-0 rounded-full border-[1px] border-slate-200/50" />
                <div className="nova-plasma-ring" />
                
                {/* شعار NOVA السيادي المضيء */}
                <div className="relative z-20 nova-text-glow">
                    <span className="text-6xl font-black tracking-tighter text-[#FF7A00]">
                      NOVA
                    </span>
                </div>
            </div>
            
            <div className="mt-20 text-center space-y-6">
                <div className="flex flex-col items-center gap-4">
                    <div className="flex items-center gap-3">
                        <p className="text-[#1e1b4b] font-black text-2xl tracking-tighter opacity-90">جاري التحميل</p>
                        <div className="flex gap-2">
                            <div className="h-2 w-2 bg-[#FF7A00] rounded-full animate-bounce-dots" style={{ animationDelay: '0s' }} />
                            <div className="h-2 w-2 bg-[#FF7A00] rounded-full animate-bounce-dots" style={{ animationDelay: '0.2s' }} />
                            <div className="h-2 w-2 bg-[#FF7A00] rounded-full animate-bounce-dots" style={{ animationDelay: '0.4s' }} />
                        </div>
                    </div>
                </div>
                
                {showEmergencyExit && (
                    <div className="mt-8 animate-in zoom-in-95 duration-500 glass-effect p-6 rounded-[2.5rem] border-2 border-white shadow-2xl max-w-xs mx-auto">
                        <p className="text-[10px] font-black text-slate-400 mb-4 uppercase tracking-widest">تأخر في الاستجابة السحابية</p>
                        <div className="flex gap-3">
                            <Button onClick={() => window.location.reload()} variant="outline" size="sm" className="flex-1 h-11 rounded-xl font-black text-[10px] gap-2 border-slate-200">
                                <RefreshCcw className="h-3 w-3" /> تحديث
                            </Button>
                            <Button onClick={handleSafeExit} variant="ghost" size="sm" className="flex-1 h-11 rounded-xl font-black text-[10px] gap-2 text-red-600">
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