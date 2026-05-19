'use client';

import React, { useState, useEffect } from 'react';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { MainNav } from '@/components/layout/main-nav';
import { Header } from '@/components/layout/header';
import { useAuth } from '@/context/auth-context';
import { AlertCircle, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/language-context';
import { Button } from '@/components/ui/button';
import { OfflineIndicator } from '@/context/sync-context';
import { SystemExpertChatWidget } from '@/components/ai/chat-widget';

const NovaLogo = () => (
  <svg width="120" height="40" viewBox="0 0 160 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-pulse">
    <text 
      x="50%" 
      y="60%" 
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

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSafeExit = () => {
    logout();
    router.replace('/');
  };

  if (loading || !mounted) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-6 bg-[#FFFDF0] relative overflow-hidden" dir="rtl">
        <div className="relative flex flex-col items-center gap-4">
            <div className="h-20 w-20 rounded-full border-4 border-primary/5 border-t-primary animate-spin" />
            <div className="absolute inset-0 m-auto flex items-center justify-center">
                <NovaLogo />
            </div>
            <p className="text-[#1e1b4b] font-black text-xl tracking-tighter">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
       <div className="flex h-screen w-full flex-col items-center justify-center gap-4 text-center p-6 bg-[#FFFDF0]" dir="rtl">
        <AlertCircle className="h-12 w-12 text-red-600 animate-bounce" />
        <h2 className="text-3xl font-black text-[#1e1b4b]">انتهت الجلسة</h2>
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
