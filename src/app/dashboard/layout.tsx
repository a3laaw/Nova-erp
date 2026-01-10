'use client';

import React from 'react';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { MainNav } from '@/components/layout/main-nav';
import { Header } from '@/components/layout/header';
import type { AuthenticatedUser } from '@/context/auth-context';

// Mock user with Admin role to ensure all features are accessible
const mockUser: AuthenticatedUser = {
  uid: 'mock-admin-uid',
  username: 'admin.user',
  email: 'admin@bmec-kw.local',
  role: 'Admin',
  isActive: true,
  employeeId: 'emp-admin',
  fullName: 'المدير العام',
  avatarUrl: 'https://images.unsplash.com/photo-1557862921-37829c790f19?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw1fHxtYW4lMjBnbGFzc2VzfGVufDB8fHx8MTc2NzIwMzM1MHww&ixlib=rb-4.1.0&q=80&w=1080'
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  const handleLogout = () => {
    // In a real app, this would clear session, etc.
    // For now, it does nothing as there is no login.
    console.log("Logout action triggered.");
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar>
          <MainNav currentUser={mockUser} onLogout={handleLogout} />
        </Sidebar>
        <div className="flex flex-col w-full">
          <Header currentUser={mockUser} onLogout={handleLogout} />
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
