'use client';

import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { LogOut, ShieldCheck } from 'lucide-react';

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user?.role !== 'Developer') {
      router.replace('/');
    }
  }, [user, loading, router]);

  if (loading || user?.role !== 'Developer') return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col" dir="rtl">
      <header className="bg-slate-900 text-white px-8 py-4 flex justify-between items-center shadow-lg border-b border-white/10">
        <div className="flex items-center gap-4">
            <div className="p-2 bg-blue-600 rounded-xl">
                <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <span className="font-black text-xl tracking-tight">Nova ERP — Developer Console</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-left">
            <p className="text-xs font-black text-blue-400">@{user.username}</p>
            <p className="text-[10px] opacity-60 font-mono">{user.email}</p>
          </div>
          <Button onClick={logout} variant="destructive" size="sm" className="h-9 rounded-xl font-bold gap-2">
            <LogOut className="h-4 w-4" /> خروج
          </Button>
        </div>
      </header>
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
            {children}
        </div>
      </main>
    </div>
  );
}
