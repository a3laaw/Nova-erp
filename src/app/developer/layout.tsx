'use client';

import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { LogOut, ShieldCheck, Terminal, Building2, UserCog } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user?.role !== 'Developer') {
      router.replace('/developer/login');
    }
  }, [user, loading, router]);

  if (loading || user?.role !== 'Developer') return null;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col relative" dir="rtl">
      {/* الديكور الزجاجي الخلفي */}
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-indigo-600/20 to-transparent pointer-events-none" />
      
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-white/10 px-8 py-4 flex justify-between items-center shadow-2xl">
        <div className="flex items-center gap-4">
            <div className="p-2.5 bg-indigo-600 rounded-2xl shadow-[0_0_20px_rgba(79,70,229,0.4)]">
                <Terminal className="h-6 w-6 text-white" />
            </div>
            <div className="flex flex-col">
                <span className="font-black text-xl text-white tracking-tighter leading-none">Developer Console</span>
                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mt-1">Nova ERP Master Control</span>
            </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-left hidden sm:block">
            <p className="text-xs font-black text-indigo-400">ADMIN ROOT</p>
            <p className="text-[10px] text-white/60 font-mono">{user.email}</p>
          </div>
          <Button onClick={logout} variant="destructive" size="sm" className="h-10 rounded-xl font-black gap-2 shadow-lg shadow-red-900/20 bg-red-600 hover:bg-red-700">
            <LogOut className="h-4 w-4" /> خروج
          </Button>
        </div>
      </header>

      <main className="flex-1 p-8 relative z-10">
        <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
            {children}
        </div>
      </main>

      <footer className="p-6 text-center text-[10px] font-black text-white/20 uppercase tracking-[0.5em]">
        Nova ERP — Multitenancy Engine v2.0
      </footer>
    </div>
  );
}
