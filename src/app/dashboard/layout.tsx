'use client';

import React from 'react';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { MainNav } from '@/components/layout/main-nav';
import { Header } from '@/components/layout/header';
import { useAuth } from '@/context/auth-context';
import { Loader } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/language-context';

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

  // If there's no user, you might want to redirect to a login page
  // For now, as login is disabled, we'll use a mock user if the main one is absent.
  const currentUser = user || {
      uid: 'mock-admin-uid',
      username: 'admin.user',
      email: 'admin@bmec-kw.local',
      role: 'Admin',
      isActive: true,
      employeeId: 'emp-admin',
      fullName: 'المدير العام',
      avatarUrl: 'https://images.unsplash.com/photo-1557862921-37829c790f19?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw1fHxtYW4lMjBnbGFzc2VzfGVufDB8fHx8MTc2NzIwMzM1MHww&ixlib=rb-4.1.0&q=80&w=1080'
  };


  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar side={language === 'ar' ? 'right' : 'left'} className="no-print">
          <MainNav currentUser={currentUser} onLogout={handleLogout} />
        </Sidebar>
        <div className="flex flex-col w-full">
          <Header currentUser={currentUser} onLogout={handleLogout} className="no-print" />
          <SidebarInset>
            <main className="flex-1 p-4 md:p-6 lg:p-8">
              {children}
            </main>
          </SidebarInset>
        </div>
      </div>
    </SidebarProvider>
  );
}
