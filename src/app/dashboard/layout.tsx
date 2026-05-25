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
import Image from 'next/image';

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
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#fdfaf3] relative overflow-hidden" dir="rtl">
        {/* BEGIN: محرك السديم المطور المعتمد من المهندس */}
        <main className="relative w-full h-screen flex flex-col items-center justify-center p-6 select-none overflow-hidden">
            <div className="relative flex items-center justify-center">
                <div className="relative z-10 overflow-hidden rounded-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                        alt="Nova Nebula" 
                        className="max-w-[120vw] md:max-w-[800px] h-auto object-contain nova-nebula-img" 
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuDEtNlSBtckngBW_Ee7zv-W5tmEJ6EZBDeaCR6TlVQDGr64SCn8e28U9zGFo9V4IkUKHFNKjJpKWJDmm0Dm70aTBpbOmQZf6UQA0ybHv9-MwgNx_ggEcDJMuTRkrXNatfJzL7PcSVxTZQ32ULGzS5chJStYZuU5UR_UbU52fAlJ36EievnwnvfcpyBNJA9jYr6wELbgtj3XmBrT56mjy5mrBdCum65Ftkl91BG77W6GFbzPAI-6fsiKCJ_7Nb8hFQ8CfvdxHJdiB9-O"
                    />
                </div>
            </div>

            <div className="absolute bottom-20 flex flex-row-reverse items-center gap-2">
                <span className="text-[#333333] text-lg font-black tracking-wide">جاري التحميل</span>
                <div className="flex flex-row-reverse items-center gap-1 mt-1">
                    <span className="w-2 h-2 bg-[#e87c24] rounded-full animate-dot-fade" style={{ animationDelay: '0s' }}></span>
                    <span className="w-2 h-2 bg-[#e87c24] rounded-full animate-dot-fade" style={{ animationDelay: '0.2s' }}></span>
                    <span className="w-2 h-2 bg-[#e87c24] rounded-full animate-dot-fade" style={{ animationDelay: '0.4s' }}></span>
                </div>
            </div>
            
            {showEmergencyExit && (
                <div className="absolute bottom-6 animate-in zoom-in-95 duration-500 glass-effect p-4 rounded-3xl border-2 border-white shadow-xl flex gap-3 z-50">
                    <Button onClick={() => window.location.reload()} variant="outline" size="sm" className="h-9 rounded-xl font-bold text-xs border-slate-200">تحديث</Button>
                    <Button onClick={handleSafeExit} variant="ghost" size="sm" className="h-9 rounded-xl font-bold text-xs text-red-600">خروج</Button>
                </div>
            )}
        </main>
      </div>
    );
  }

  if (!user || !user.currentCompanyId) {
    return (
       <div className="flex h-screen w-full flex-col items-center justify-center gap-4 text-center p-6 bg-[#fdfaf3]" dir="rtl">
        <div className="p-6 bg-red-50/10 rounded-full border-2 border-red-500/20 mb-4">
            <AlertCircle className="h-12 w-12 text-red-400 animate-bounce" />
        </div>
        <h2 className="text-3xl font-black text-[#1e1b4b]">انتهت جلسة العمل</h2>
        <p className="text-slate-500 font-bold max-w-xs mx-auto">يرجى إعادة تسجيل الدخول للوصول لبيانات المنشأة.</p>
        <Button onClick={handleSafeExit} className="bg-[#e87c24] text-white font-black px-16 h-14 rounded-2xl mt-8 shadow-2xl hover:bg-[#d06b1e] active:scale-95 transition-all">دخول</Button>
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