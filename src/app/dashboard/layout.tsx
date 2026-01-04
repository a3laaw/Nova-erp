'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { MainNav } from '@/components/layout/main-nav';
import { Header } from '@/components/layout/header';
import { useAuth } from '@/context/auth-context';
import { Skeleton } from '@/components/ui/skeleton';

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
       <div className="flex min-h-screen">
          <div className='p-2 hidden md:block border-r' style={{width: '16rem'}}>
            <div className='flex flex-col h-full'>
              <div className='p-2 flex flex-col gap-2'>
                <Skeleton className="h-10 w-full" />
              </div>
              <div className='p-2 flex-1'>
                <div className='flex flex-col gap-1'>
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </div>
              <div className='p-2'>
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-12 w-full mt-2" />
              </div>
            </div>
          </div>
          <div className="flex flex-col w-full">
            <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-card/80 backdrop-blur-sm px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
                <Skeleton className="h-7 w-7 md:hidden" />
                <Skeleton className="h-6 w-32" />
                <div className='ml-auto flex items-center gap-2'>
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                </div>
            </header>
            <main className="flex-1 p-4 md:p-6 lg:p-8">
               <Skeleton className="h-full w-full" />
            </main>
          </div>
        </div>
    );
  }


  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar>
          <MainNav currentUser={user} onLogout={logout} />
        </Sidebar>
        <div className="flex flex-col w-full">
          <Header currentUser={user} onLogout={logout} />
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


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardContent>
      {children}
    </DashboardContent>
  );
}
