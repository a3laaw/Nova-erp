'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { MainNav } from '@/components/layout/main-nav';
import { Header } from '@/components/layout/header';
import { useAuth } from '@/context/auth-context';
import { Loader, AlertCircle, LogOut, RefreshCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/language-context';
import { Button } from '@/components/ui/button';
import { OfflineIndicator } from '@/context/sync-context';
import { useBranding } from '@/context/branding-context';
import { cn } from '@/lib/utils';
import { SystemExpertChatWidget } from '@/components/ai/chat-widget';

/**
 * @fileOverview Dashboard layout with professional clean style and recovery options.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const { language } = useLanguage();
  const { branding } = useBranding();
  
  const [mounted, setMounted] = useState(false);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showRetry, setShowRetry] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    loadingTimeoutRef.current = setTimeout(() => {
        if (loading) setShowRetry(true);
    }, 10000);

    return () => {
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    };
  }, [loading]);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  if (loading || !mounted) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-6 bg-slate-50">
        <div className="relative">
            <div className="h-20 w-20 rounded-full border-4 border-primary/10 border-t-primary animate-spin" />
            <Loader className="h-8 w-8 text-primary absolute inset-0 m-auto animate-pulse" />
        </div>
        <div className="text-center space-y-4">
            <p className="text-slate-900 font-black text-xl tracking-tight">جاري تهيئة بيئة العمل...</p>
            {showRetry && (
                <Button onClick={() => window.location.reload()} variant="outline" className="rounded-xl font-bold gap-2">
                    <RefreshCcw className="h-4 w-4" /> إعادة محاولة التحميل
                </Button>
            )}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
       <div className="flex h-screen w-full flex-col items-center justify-center gap-4 text-center p-6 bg-slate-50">
        <AlertCircle className="h-16 w-16 text-red-600 mb-2" />
        <h2 className="text-2xl font-black text-slate-900">انتهت صلاحية الجلسة أو حدث خطأ</h2>
        <div className="flex gap-3 mt-4">
            <Button onClick={() => window.location.reload()} variant="outline">إعادة المحاولة</Button>
            <Button onClick={handleLogout} variant="destructive">تسجيل الخروج</Button>
        </div>
      </div>
    )
  }
  
  return (
    <div className="relative min-h-screen">
      <SidebarProvider>
          <Sidebar
            side={language === 'ar' ? 'right' : 'left'}
            className="no-print glass-sidebar"
          >
            <MainNav currentUser={user} onLogout={handleLogout} />
          </Sidebar>
          <SidebarInset className="flex flex-col h-screen min-w-0 w-full bg-background/80 backdrop-blur-sm">
            <Header currentUser={user} onLogout={handleLogout} className="no-print" />
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
