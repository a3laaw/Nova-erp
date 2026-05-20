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
 * تصميم رصين يتوسط قطر دائرة التحميل المتوهجة.
 */
const NovaLogo = () => (
  <svg width="140" height="60" viewBox="0 0 160 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <text 
      x="50%" 
      y="50%" 
      dominantBaseline="middle" 
      textAnchor="middle" 
      fontFamily="inherit" 
      fontWeight="900" 
      fontSize="42" 
      fill="#FF7A00" 
      style={{ filter: 'drop-shadow(0px 0px 8px rgba(255,122,0,0.3))' }}
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

  // معالجة حالة التحميل المعتمدة والموحدة
  if (loading || !mounted) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-8 bg-[#FFFDF0] relative overflow-hidden" dir="rtl">
        <div className="relative flex flex-col items-center">
            {/* 🛡️ حلقة التحميل مع التوهج المداري الفخم 🛡️ */}
            <div className="h-48 w-48 rounded-full border-2 border-primary/5 border-t-primary animate-spin shadow-[0_0_40px_rgba(255,122,0,0.4)]" />
            
            {/* الشعار في المركز الهندسي المطلق للدائرة */}
            <div className="absolute inset-0 flex items-center justify-center">
                <NovaLogo />
            </div>
            
            {/* النص الكحلي المعتمد بالأسفل بوضوح تام */}
            <div className="mt-12 text-center space-y-4">
                <p className="text-[#1e1b4b] font-black text-2xl tracking-tighter">جاري التحميل...</p>
                {showEmergencyExit && (
                    <div className="flex flex-col gap-4 animate-in zoom-in-95 duration-500 max-w-xs mx-auto p-6 glass-effect rounded-3xl border-white/20 shadow-2xl">
                        <Button onClick={() => window.location.reload()} variant="outline" className="h-11 rounded-xl font-bold gap-2 text-[#1e1b4b] border-orange-200">
                            <RefreshCcw className="h-4 w-4" /> تحديث الصفحة
                        </Button>
                        <Button onClick={handleSafeExit} variant="ghost" className="h-11 rounded-xl font-black gap-2 text-red-600 hover:bg-red-50">
                            <LogOut className="h-4 w-4" /> خروج آمن وإصلاح
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
        <AlertCircle className="h-12 w-12 text-red-600 animate-bounce" />
        <h2 className="text-3xl font-black text-[#1e1b4b]">انتهت جلسة العمل</h2>
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