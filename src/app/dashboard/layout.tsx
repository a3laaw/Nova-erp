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
        {/* ✨ محرك السديم المطور المطابق للصورة تماماً ✨ */}
        <div className="nova-nebula-container">
            <div className="nova-dust-field" />
            <div className="nova-nebula-ring" />
            <div className="nova-nebula-core" />
            
            <div className="nova-text-glow">
                <span>NOVA</span>
            </div>
        </div>
        
        {/* نص التحميل في الأسفل */}
        <div className="absolute bottom-20 left-0 right-0 flex flex-col items-center justify-center space-y-6 z-30">
            <div className="flex items-center justify-center gap-4">
                <p className="text-[#FF7A00] font-black text-2xl tracking-tight">جاري التحميل</p>
                <div className="flex gap-2.5 pt-2">
                    <div className="h-3 w-3 bg-[#FFB000] rounded-full animate-bounce shadow-lg shadow-amber-200" style={{ animationDelay: '0s' }} />
                    <div className="h-3 w-3 bg-[#FF7A00] rounded-full animate-bounce shadow-lg shadow-orange-200" style={{ animationDelay: '0.2s' }} />
                    <div className="h-3 w-3 bg-[#E66D00] rounded-full animate-bounce shadow-lg shadow-orange-400" style={{ animationDelay: '0.4s' }} />
                </div>
            </div>
            
            {showEmergencyExit && (
                <div className="animate-in zoom-in-95 duration-500 glass-effect p-6 rounded-[2.5rem] border-2 border-white shadow-2xl max-w-xs mx-auto">
                    <div className="flex gap-3">
                        <Button onClick={() => window.location.reload()} variant="outline" size="sm" className="flex-1 h-11 rounded-2xl font-black text-xs border-slate-200 text-black shadow-sm">تحديث</Button>
                        <Button onClick={handleSafeExit} variant="ghost" size="sm" className="flex-1 h-11 rounded-2xl font-black text-xs text-red-600">خروج</Button>
                    </div>
                </div>
            )}
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