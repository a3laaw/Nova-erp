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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const { language } = useLanguage();
  const { branding } = useBranding();

  if (loading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4">
        <Loader className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">جاري تحميل بيانات المستخدم...</p>
      </div>
    );
  }

  // If there's no user after loading, it's a critical error.
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
  
  const hasBackground = !!branding?.system_background_url;
  const backgroundStyle = hasBackground ? {
    backgroundImage: `url(${branding.system_background_url})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
  } : {};

  return (
    <div className="relative min-h-screen" style={backgroundStyle}>
      <SidebarProvider>
        <div className="flex min-h-screen">
          <Sidebar
            side={language === 'ar' ? 'right' : 'left'}
            className={cn(
                "no-print",
                hasBackground && "border-r-white/10 bg-card/80 backdrop-blur-sm"
            )}
          >
            <MainNav currentUser={user} onLogout={handleLogout} />
          </Sidebar>
          <SidebarInset className={cn("flex flex-col h-screen", hasBackground && "bg-background/80 backdrop-blur-sm")}>
            <Header currentUser={user} onLogout={handleLogout} className="no-print" />
            <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
              {children}
            </main>
            <OfflineIndicator />
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}
