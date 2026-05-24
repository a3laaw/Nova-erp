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
 * جزيئات غبار النجوم الصامتة (Silent Stardust Engine):
 * محاكاة للجسيمات المتطايرة بحركة هادئة جداً لضمان فخامة تجربة "النوفا".
 */
const Stardust = () => {
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {Array.from({ length: 20 }).map((_, i) => (
                <div 
                    key={i} 
                    className="stardust-particle"
                    style={{
                        top: '50%',
                        left: '50%',
                        '--tw-translate-x': `${(Math.random() - 0.5) * 400}px`,
                        '--tw-translate-y': `${(Math.random() - 0.5) * 400}px`,
                        animationDelay: `${Math.random() * 5}s`,
                        width: `${Math.random() * 1.5 + 0.5}px`,
                        height: `${Math.random() * 1.5 + 0.5}px`
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
    // 🛡️ صمام أمان: إذا استمر التحميل أكثر من 10 ثوانٍ، نظهر خيار الخروج الطارئ والإصلاح
    const timer = setTimeout(() => {
      setShowEmergencyExit(true);
    }, 10000); 
    return () => clearTimeout(timer);
  }, []);

  const handleSafeExit = () => {
    logout();
    router.replace('/');
  };

  // 🛡️ شاشة التحميل "النوفا الصامتة V4.0" 🛡️
  if (loading || !mounted) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#FFFDF0] relative overflow-hidden" dir="rtl">
        {/* هالة السديم النبضية الهادئة */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] nova-glow-nebula rounded-full" />
        
        {/* جزيئات الانفجار الهادئة */}
        <Stardust />

        <div className="relative flex flex-col items-center justify-center scale-90">
            <div className="relative flex items-center justify-center w-64 h-64">
                <div className="absolute inset-0 rounded-full border-[0.5px] border-slate-200/20" />
                
                {/* المدار البلازمي الرقيق */}
                <div className="nova-plasma-ring" />
                
                {/* شعار NOVA الصامت */}
                <div className="relative z-20 nova-text-glow">
                    <span className="text-6xl font-black tracking-[0.2em] text-[#FF7A00] select-none drop-shadow-sm">
                      NOVA
                    </span>
                </div>
            </div>
            
            <div className="mt-16 text-center space-y-4 relative z-10">
                <div className="flex items-center justify-center gap-3">
                    <div className="flex gap-1 order-2">
                        <div className="h-1.5 w-1.5 bg-[#FF7A00] rounded-full animate-bounce-dots" style={{ animationDelay: '0s' }} />
                        <div className="h-1.5 w-1.5 bg-[#FFB000] rounded-full animate-bounce-dots" style={{ animationDelay: '0.2s' }} />
                        <div className="h-1.5 w-1.5 bg-[#E66D00] rounded-full animate-bounce-dots" style={{ animationDelay: '0.4s' }} />
                    </div>
                    <p className="text-[#1e1b4b] font-black text-lg tracking-tight opacity-70 order-1">جاري استعادة الجلسة السيادية</p>
                </div>
                
                {showEmergencyExit && (
                    <div className="mt-8 animate-in zoom-in-95 duration-500 glass-effect p-6 rounded-[2.5rem] border-2 border-white shadow-2xl max-w-xs mx-auto">
                        <div className="flex gap-3">
                            <Button onClick={() => window.location.reload()} variant="outline" size="sm" className="flex-1 h-10 rounded-xl font-black text-[10px] border-slate-200">تحديث الصفحة</Button>
                            <Button onClick={handleSafeExit} variant="ghost" size="sm" className="flex-1 h-10 rounded-xl font-black text-[10px] text-red-600">خروج وإصلاح</Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>
    );
  }

  // 🛡️ حماية المسار السيادي
  if (!user || !user.currentCompanyId) {
    return (
       <div className="flex h-screen w-full flex-col items-center justify-center gap-4 text-center p-6 bg-[#FFFDF0]" dir="rtl">
        <div className="p-6 bg-red-500/10 rounded-full border-2 border-red-500/20 mb-4">
            <AlertCircle className="h-12 w-12 text-red-400 animate-bounce" />
        </div>
        <h2 className="text-3xl font-black text-[#1e1b4b]">انتهت جلسة العمل</h2>
        <p className="text-slate-500 font-bold max-w-xs mx-auto">يرجى تسجيل الدخول مرة أخرى للوصول إلى بياناتك المعزولة.</p>
        <Button onClick={handleSafeExit} className="bg-[#FF7A00] text-white font-black px-16 h-14 rounded-2xl mt-8 shadow-2xl hover:bg-[#E66D00] active:scale-95 transition-all">بوابة الدخول</Button>
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