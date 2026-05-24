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
 * محاكاة للجسيمات المتطايرة في الصورة المرجعية.
 */
const Stardust = () => {
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {Array.from({ length: 25 }).map((_, i) => (
                <div 
                    key={i} 
                    className="stardust-particle"
                    style={{
                        top: '50%',
                        left: '50%',
                        '--tw-translate-x': `${(Math.random() - 0.5) * 600}px`,
                        '--tw-translate-y': `${(Math.random() - 0.5) * 600}px`,
                        animationDelay: `${Math.random() * 4}s`,
                        width: `${Math.random() * 2 + 1}px`,
                        height: `${Math.random() * 2 + 1}px`
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

  // 🛡️ شاشة التحميل المطابقة للصورة المرجعية (Nova Blast V4.0) 🛡️
  if (loading || !mounted) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#FFFDF0] relative overflow-hidden" dir="rtl">
        {/* هالة السديم النبضية (Background Glow) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] nova-glow-nebula rounded-full" />
        
        {/* جزيئات الانفجار (Sparkles) */}
        <Stardust />

        <div className="relative flex flex-col items-center justify-center">
            {/* 🌟 وحدة النواة والمدار 🌟 */}
            <div className="relative flex items-center justify-center w-64 h-64">
                {/* الدوائر المدارية (Thin Rings) */}
                <div className="absolute inset-0 rounded-full border-[1px] border-slate-200/40" />
                <div className="absolute inset-4 rounded-full border-[0.5px] border-slate-100/30" />
                
                {/* الحلقة البلازمية المتوهجة (The Main Ring) */}
                <div className="nova-plasma-ring" />
                
                {/* شعار NOVA السيادي المضيء */}
                <div className="relative z-20 nova-text-glow">
                    <span className="text-5xl font-black tracking-widest text-[#FF7A00] select-none drop-shadow-lg">
                      NOVA
                    </span>
                </div>
            </div>
            
            {/* مؤشر التحميل السفلي المطابق للصورة */}
            <div className="mt-20 text-center space-y-4 relative z-10">
                <div className="flex items-center justify-center gap-3">
                    <div className="flex gap-1.5 order-2">
                        <div className="h-2 w-2 bg-[#FF7A00] rounded-full animate-bounce-dots" style={{ animationDelay: '0s' }} />
                        <div className="h-2 w-2 bg-[#FFB000] rounded-full animate-bounce-dots" style={{ animationDelay: '0.2s' }} />
                        <div className="h-2 w-2 bg-[#E66D00] rounded-full animate-bounce-dots" style={{ animationDelay: '0.4s' }} />
                    </div>
                    <p className="text-[#1e1b4b] font-black text-xl tracking-tight opacity-90 order-1">جاري التحميل</p>
                </div>
                
                {showEmergencyExit && (
                    <div className="mt-8 animate-in zoom-in-95 duration-500 glass-effect p-6 rounded-[2.5rem] border-2 border-white shadow-2xl max-w-xs mx-auto">
                        <p className="text-[10px] font-black text-slate-400 mb-4 uppercase tracking-widest text-center">تأخر في الاستجابة السحابية</p>
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