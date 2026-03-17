'use client';

import React, { useState, useEffect } from 'react';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { MainNav } from '@/components/layout/main-nav';
import { Header } from '@/components/layout/header';
import { useAuth } from '@/context/auth-context';
import { Loader, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/language-context';
import { Button } from '@/components/ui/button';
import { OfflineIndicator } from '@/context/sync-context';
import { useBranding } from '@/context/branding-context';
import { cn } from '@/lib/utils';
import { SystemExpertChatWidget } from '@/components/ai/chat-widget';
import { useAppTheme } from '@/context/theme-context';

/**
 * @fileOverview Dashboard layout with enhanced mount protection to avoid ChunkLoadErrors.
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

  if (loading || !mounted) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4">
        <Loader className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground font-bold">جاري تحميل لوحة التحكم...</p>
      </div>
    );
  }

  if (!user) {
    return (
       <div className="flex h-screen w-full flex-col items-center justify-center gap-4 text-center p-6">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-bold">فشل تحميل بيانات المستخدم</h2>
        <p className="text-muted-foreground max-w-sm">
            لا يمكن المتابعة بدون معلومات المستخدم النشطة. يرجى إعادة الدخول للنظام.
        </p>
        <Button onClick={() => window.location.reload()} className="mt-4 rounded-xl px-8">
            إعادة تحميل الصفحة
        </Button>
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
