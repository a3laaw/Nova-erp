'use client';

import React, { useState, useEffect } from 'react';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { MainNav } from '@/components/layout/main-nav';
import { Header } from '@/components/layout/header';
import { useAuth } from '@/context/auth-context';
import { Loader, AlertCircle, RefreshCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/language-context';
import { Button } from '@/components/ui/button';
import { OfflineIndicator } from '@/context/sync-context';
import { SystemExpertChatWidget } from '@/components/ai/chat-widget';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const { language } = useLanguage();
  
  const [mounted, setMounted] = useState(false);
  const [showRetry, setShowRetry] = useState(false);

  useEffect(() => {
    setMounted(true);
    // إذا استغرق التحميل أكثر من 5 ثوانٍ في هذه الواجهة، نظهر خيارات الطوارئ
    const timer = setTimeout(() => {
        if (loading) setShowRetry(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [loading]);

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  // شاشة التحميل السيادية
  if (loading || !mounted) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-6 bg-[#1e1b4b]">
        <div className="relative">
            <div className="h-20 w-20 rounded-full border-4 border-white/20 border-t-white animate-spin" />
            <Loader className="h-8 w-8 text-white absolute inset-0 m-auto animate-pulse" />
        </div>
        <div className="text-center space-y-4">
            <p className="text-white font-black text-xl tracking-tight">جاري استعادة الجلسة السيادية...</p>
            {showRetry && (
                <div className="flex flex-col gap-3 animate-in fade-in zoom-in duration-500 max-w-xs mx-auto">
                    <Button onClick={() => window.location.reload()} variant="outline" className="glass-effect rounded-xl font-bold gap-2 text-white border-white/40 hover:bg-white/20">
                        <RefreshCcw className="h-4 w-4" /> إعادة محاولة التحميل
                    </Button>
                    <Button onClick={handleLogout} variant="ghost" className="text-white/60 text-xs font-bold hover:text-white">
                        هل تواجه مشكلة؟ سجل خروجك وابدأ من جديد
                    </Button>
                </div>
            )}
        </div>
      </div>
    );
  }

  // إذا انتهى التحميل ولم يتم العثور على مستخدم
  if (!user) {
    return (
       <div className="flex h-screen w-full flex-col items-center justify-center gap-4 text-center p-6 bg-[#1e1b4b]">
        <AlertCircle className="h-16 w-16 text-red-400 mb-2 opacity-60" />
        <h2 className="text-2xl font-black text-white">انتهت جلسة العمل</h2>
        <p className="text-white/60 max-w-xs mx-auto font-medium">يرجى تسجيل الدخول مرة أخرى للوصول إلى بياناتك المعزولة.</p>
        <Button onClick={handleLogout} className="bg-white text-indigo-950 font-black px-12 h-14 rounded-2xl mt-6 shadow-2xl hover:bg-slate-100">بوابة الدخول</Button>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen">
      <SidebarProvider>
          <Sidebar
            side={language === 'ar' ? 'right' : 'left'}
            className="no-print sidebar-glass border-none"
          >
            <MainNav currentUser={user} onLogout={handleLogout} />
          </Sidebar>
          <SidebarInset className="flex flex-col h-screen min-w-0 w-full bg-transparent">
            <Header currentUser={user} onLogout={handleLogout} className="no-print bg-transparent border-none" />
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
