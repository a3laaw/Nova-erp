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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const { language } = useLanguage();

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

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar side={language === 'ar' ? 'right' : 'left'} className="no-print">
          <MainNav currentUser={user} onLogout={handleLogout} />
        </Sidebar>
        <SidebarInset>
          <Header currentUser={user} onLogout={onLogout} className="no-print" />
          <main className="flex-1 p-4 md:p-6 lg:p-8">
            {children}
          </main>
          <OfflineIndicator />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
