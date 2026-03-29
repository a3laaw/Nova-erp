'use client';

import React, { useState, useEffect, useRef } from 'react';
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
    const timer = setTimeout(() => {
        if (loading) setShowRetry(true);
    }, 10000);
    return () => clearTimeout(timer);
  }, [loading]);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  if (loading || !mounted) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-6">
        <div className="relative">
            <div className="h-20 w-20 rounded-full border-4 border-white/20 border-t-white animate-spin" />
            <Loader className="h-8 w-8 text-white absolute inset-0 m-auto animate-pulse" />
        </div>
        <div className="text-center space-y-4">
            <p className="text-white font-black text-xl tracking-tight">Nova ERP Core Booting...</p>
            {showRetry && (
                <Button onClick={() => window.location.reload()} variant="outline" className="glass-effect rounded-xl font-bold gap-2 text-white">
                    <RefreshCcw className="h-4 w-4" /> إعادة محاولة التحميل
                </Button>
            )}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
       <div className="flex h-screen w-full flex-col items-center justify-center gap-4 text-center p-6">
        <AlertCircle className="h-16 w-16 text-white mb-2" />
        <h2 className="text-2xl font-black text-white">جلسة منتهية</h2>
        <Button onClick={handleLogout} className="bg-white text-indigo-950 font-black px-10 rounded-xl h-12">تسجيل الخروج</Button>
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
