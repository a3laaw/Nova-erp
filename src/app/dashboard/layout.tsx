'use client';

import React, { useState, useEffect } from 'react';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { MainNav } from '@/components/layout/main-nav';
import { Header } from '@/components/layout/header';
import { useAuth } from '@/context/auth-context';
import { Loader, AlertCircle, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/language-context';
import { Button } from '@/components/ui/button';
import { OfflineIndicator } from '@/context/sync-context';
import { useBranding } from '@/context/branding-context';
import { cn } from '@/lib/utils';
import { SystemExpertChatWidget } from '@/components/ai/chat-widget';
import { useAppTheme } from '@/context/theme-context';

/**
 * @fileOverview Dashboard layout with enhanced mount protection.
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
  const { theme } = useAppTheme();
  
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  // شاشة التحميل المعززة
  if (loading || !mounted) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-6 bg-[#1e1b4b]">
        <div className="relative">
            <div className="h-20 w-20 rounded-full border-4 border-white/10 border-t-white animate-spin" />
            <Loader className="h-8 w-8 text-white absolute inset-0 m-auto animate-pulse" />
        </div>
        <div className="text-center space-y-2">
            <p className="text-white font-black text-xl tracking-tight">جاري تهيئة بيئة العمل...</p>
            <p className="text-indigo-200/60 text-xs font-bold uppercase tracking-widest">Nova ERP Sovereign Engine</p>
        </div>
      </div>
    );
  }

  // في حال فشل تحميل المستخدم
  if (!user) {
    return (
       <div className="flex h-screen w-full flex-col items-center justify-center gap-4 text-center p-6 bg-slate-50">
        <AlertCircle className="h-16 w-16 text-red-600 mb-2" />
        <h2 className="text-2xl font-black text-slate-900">انتهت صلاحية الجلسة</h2>
        <p className="text-muted-foreground max-w-sm font-bold">
            لم نتمكن من العثور على بيانات مستخدم نشطة. يرجى تسجيل الدخول مجدداً.
        </p>
        <div className="flex gap-3 mt-4">
            <Button onClick={() => window.location.reload()} variant="outline" className="rounded-xl px-8 font-bold">
                إعادة المحاولة
            </Button>
            <Button onClick={handleLogout} className="rounded-xl px-8 font-black bg-red-600 hover:bg-red-700">
                تسجيل الخروج
            </Button>
        </div>
      </div>
    )
  }
  
  const vibrantGlassBackground = "linear-gradient(135deg, #a5f3fc 0%, #818cf8 40%, #c084fc 70%, #f472b6 100%)";
  
  const isGlass = theme === 'glass';
  const hasBackground = !!branding?.system_background_url || isGlass;
  const backgroundStyle = {
    backgroundImage: isGlass ? vibrantGlassBackground : (branding?.system_background_url ? `url(${branding.system_background_url})` : 'none'),
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
  };

  return (
    <div className={cn("relative min-h-screen", isGlass && "theme-glass")} style={backgroundStyle}>
      <SidebarProvider>
          <Sidebar
            side={language === 'ar' ? 'right' : 'left'}
            className={cn(
                "no-print transition-all duration-500",
                isGlass ? "sidebar-glass" : "border-l border-sidebar-border bg-white shadow-sm"
            )}
          >
            <MainNav currentUser={user} onLogout={handleLogout} />
          </Sidebar>
          <SidebarInset className={cn(
            "flex flex-col h-screen min-w-0 w-full transition-all duration-500", 
            isGlass ? "bg-white/5" : (hasBackground ? "bg-background/80 backdrop-blur-sm" : "bg-background")
          )}>
            <Header currentUser={user} onLogout={handleLogout} className="no-print" />
            <main className={cn(
                "flex-1 overflow-y-auto overflow-x-hidden p-2 min-w-0",
                isGlass && "scrollbar-thin scrollbar-thumb-white/20"
            )}>
              {children}
            </main>
            <OfflineIndicator />
            <SystemExpertChatWidget />
          </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
