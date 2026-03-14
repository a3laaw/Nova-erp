'use client';

import React from 'react';
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

  if (loading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4">
        <Loader className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">جاري تحميل بيانات المستخدم...</p>
      </div>
    );
  }

  if (!user) {
    return (
       <div className="flex h-screen w-full flex-col items-center justify-center gap-4 text-center">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-bold">فشل تحميل بيانات المستخدم</h2>
        <p className="text-muted-foreground">
            لا يمكن المتابعة بدون معلومات المستخدم. الرجاء المحاولة مرة أخرى.
        </p>
        <Button onClick={() => window.location.reload()} className="mt-4">
            إعادة تحميل الصفحة
        </Button>
      </div>
    )
  }

  const handleLogout = () => {
    logout();
    router.push('/');
  };
  
  // Glass Theme dynamic background enhancement
  const glassBackground = "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)";
  
  const hasBackground = !!branding?.system_background_url || theme === 'glass';
  const backgroundStyle = {
    backgroundImage: theme === 'glass' ? glassBackground : (branding?.system_background_url ? `url(${branding.system_background_url})` : 'none'),
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
  };

  return (
    <div className={cn("relative min-h-screen", theme === 'glass' && "dark")} style={backgroundStyle}>
      <SidebarProvider>
          <Sidebar
            side={language === 'ar' ? 'right' : 'left'}
            className={cn(
                "no-print transition-all duration-500",
                theme === 'glass' ? "sidebar-glass" : "border-l border-sidebar-border bg-white shadow-sm"
            )}
          >
            <MainNav currentUser={user} onLogout={handleLogout} />
          </Sidebar>
          <SidebarInset className={cn(
            "flex flex-col h-screen min-w-0 w-full transition-all duration-500", 
            theme === 'glass' ? "bg-black/20" : (hasBackground ? "bg-background/80 backdrop-blur-sm" : "bg-background")
          )}>
            <Header currentUser={user} onLogout={handleLogout} className="no-print" />
            <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8 min-w-0">
              {children}
            </main>
            <OfflineIndicator />
            <SystemExpertChatWidget />
          </SidebarInset>
      </SidebarProvider>
    </div>
  );
}