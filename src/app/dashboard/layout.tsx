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
    }, 10000); 
    return () => clearTimeout(timer);
  }, []);

  const handleSafeExit = () => {
    logout();
    router.replace('/');
  };

  if (loading || !mounted) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#FFFDF0] relative overflow-hidden" dir="rtl">
        <div className="nova-nebula-glow top-1/2 left-1/2" />
        
        <div className="relative flex flex-col items-center justify-center z-10">
            <div className="nova-text-glow">
                <span className="text-8xl font-black tracking-[0.4em] select-none">
                  NOVA
                </span>
            </div>
            
            <div className="mt-20 text-center space-y-4">
                <div className="flex items-center justify-center gap-3">
                    <p className="text-[#1e1b4b] font-black text-xl tracking-tight opacity-70">جاري فتح النظام...</p>
                    <div className="flex gap-2 pt-2">
                        <div className="h-2.5 w-2.5 bg-[#FFB000] rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                        <div className="h-2.5 w-2.5 bg-[#FF7A00] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                        <div className="h-2.5 w-2.5 bg-[#E66D00] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                    </div>
                </div>
                
                {showEmergencyExit && (
                    <div className="mt-12 animate-in zoom-in-95 duration-500 glass-effect p-6 rounded-[2.5rem] border-2 border-white shadow-2xl max-w-xs mx-auto">
                        <div className="flex gap-3">
                            <Button onClick={() => window.location.reload()} variant="outline" size="sm" className="flex-1 h-10 rounded-xl font-black text-[10px] border-slate-200 text-black">تحديث</Button>
                            <Button onClick={handleSafeExit} variant="ghost" size="sm" className="flex-1 h-10 rounded-xl font-black text-[10px] text-red-600">خروج</Button>
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
        <div className="p-6 bg-red-50/10 rounded-full border-2 border-red-500/20 mb-4">
            <AlertCircle className="h-12 w-12 text-red-400 animate-bounce" />
        </div>
        <h2 className="text-3xl font-black text-[#1e1b4b]">انتهى وقت الدخول</h2>
        <p className="text-slate-500 font-bold max-w-xs mx-auto">يرجى إعادة الدخول للوصول لبياناتك.</p>
        <Button onClick={handleSafeExit} className="bg-[#FF7A00] text-white font-black px-16 h-14 rounded-2xl mt-8 shadow-2xl hover:bg-[#E66D00] active:scale-95 transition-all">دخول</Button>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <SidebarProvider>
          <Sidebar side={language === 'ar' ? 'right' : 'left'} className="no-print sidebar-glass border-none">
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
