'use client';

import React, { useState, useEffect } from 'react';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { MainNav } from '@/components/layout/main-nav';
import { Header } from '@/components/layout/header';
import { useAuth } from '@/context/auth-context';
import { Loader } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/language-context';
import { Button } from '@/components/ui/button';
import { OfflineIndicator } from '@/context/sync-context';
import { SystemExpertChatWidget } from '@/components/ai/chat-widget';

/**
 * غلاف لوحة التحكم (User-Friendly UI Implementation V98.0):
 * - تم تفريغ شاشة التحميل لتظهر خلفية النظام الملونة (Transparent Background).
 * - إزالة المسميات التقنية المعقدة لتسهيل التجربة.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const { language } = useLanguage();
  
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSafeExit = () => {
    logout();
    router.replace('/');
  };

  // 1. معالجة حالة التحميل (بألوان النظام المنسابة)
  if (loading || !mounted) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-8 bg-transparent relative overflow-hidden">
        {/* توهج خلفية النظام سيظهر هنا لأن الـ Background شفاف */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
        
        <div className="relative z-10 flex flex-col items-center gap-6">
            <div className="relative">
                <div className="h-20 w-20 rounded-full border-4 border-primary/10 border-t-primary animate-spin shadow-xl" />
                <Loader className="h-8 w-8 text-primary absolute inset-0 m-auto animate-pulse" />
            </div>
            <div className="text-center">
                <p className="text-foreground font-black text-2xl tracking-tighter animate-pulse">جاري التحميل...</p>
            </div>
        </div>
      </div>
    );
  }

  // 2. التحقق من وجود المستخدم
  if (!user) {
    return (
       <div className="flex h-screen w-full flex-col items-center justify-center gap-4 text-center p-6 bg-transparent">
        <h2 className="text-3xl font-black text-foreground tracking-tighter">انتهت جلسة العمل</h2>
        <p className="text-muted-foreground max-w-xs mx-auto font-medium">يرجى تسجيل الدخول مرة أخرى للوصول إلى بياناتك.</p>
        <Button onClick={handleSafeExit} className="px-16 h-14 rounded-2xl mt-8 shadow-2xl transition-all">بوابة الدخول</Button>
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
