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
 * مكون الجسيمات المتطايرة (Sovereign Particle Renderer)
 */
function ParticleBackground() {
    const [particles, setParticles] = useState<any[]>([]);
    
    useEffect(() => {
        const p = Array.from({ length: 25 }).map((_, i) => ({
            id: i,
            size: Math.random() * 3 + 1 + 'px',
            left: Math.random() * 100 + '%',
            top: Math.random() * 100 + '%',
            duration: Math.random() * 5 + 5 + 's',
            delay: Math.random() * 5 + 's',
        }));
        setParticles(p);
    }, []);

    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
            {particles.map((p) => (
                <div 
                    key={p.id}
                    className="particle"
                    style={{
                        width: p.size,
                        height: p.size,
                        left: p.left,
                        top: p.top,
                        animation: `float-particle ${p.duration} linear infinite`,
                        animationDelay: p.delay
                    }}
                />
            ))}
        </div>
    );
}

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
        <ParticleBackground />
        
        <main className="relative z-10 flex flex-col items-center justify-center w-full px-6 pointer-events-none">
            <div className="nova-image-container animate-pulse-nova relative w-full max-w-md aspect-square flex items-center justify-center pointer-events-auto">
                <img 
                    alt="Nova Nebula" 
                    className="w-full h-auto object-contain" 
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAAwUtP2b2CToLjUJ8eDO6iwFczMu5EfgTZXtRhviSqh4p1FZk1EdVK4Mt4nVqBsE5dqYeVMu8ZKJccZdK7tbyOKef7DJvuqjqe3C91u1shEfJJuzX7cQxegYjwyQSlROGi81TaZaihR3hTDDdmUNS0FDGQ03jl0t-q9xzfNX45G0VAEsH9UjbL1QtLp57Dea6Tfs2ENlRLLWbeZoAkkxautawwahzzBFDgFtEH18arUAkbMW9w5QAyhMiJrflIscMibtocPoyrR_o8"
                />
            </div>
        </main>

        <footer className="fixed bottom-16 flex flex-col items-center gap-4 z-10">
            <div className="flex items-center gap-3">
                <span className="text-[#ea580c] text-xl font-bold tracking-wide">جاري تحميل نظام Nova...</span>
                <div className="dot-loader flex gap-1 pt-1">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        </footer>
        
        {showEmergencyExit && (
            <div className="absolute bottom-6 animate-in zoom-in-95 duration-500 glass-effect p-4 rounded-3xl border-2 border-white shadow-xl flex gap-3 z-50">
                <Button onClick={() => window.location.reload()} variant="outline" size="sm" className="h-9 rounded-xl font-bold text-xs border-slate-200 text-black">تحديث</Button>
                <Button onClick={handleSafeExit} variant="ghost" size="sm" className="h-9 rounded-xl font-bold text-xs text-red-600">خروج</Button>
            </div>
        )}
      </div>
    );
  }

  // 🛡️ تصحيح منطق المطور: السماح بدخول الداشبورد للمطور حتى لو لم يكن مرتبطاً بشركة
  const hasAccess = user && (user.currentCompanyId || user.role === 'Developer');

  if (!hasAccess) {
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