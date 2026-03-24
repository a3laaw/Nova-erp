'use client';

import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { LogOut, Terminal, Activity, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * غلاف لوحة تحكم المطور (Master Layout):
 * يتميز بنمط زجاجي مظلم يعكس قوة التحكم السيادي.
 */
export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user?.role !== 'Developer') {
      router.replace('/developer/login');
    }
  }, [user, loading, router]);

  if (loading || user?.role !== 'Developer') return null;

  const masterBackground = "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)";

  return (
    <div className="min-h-screen flex flex-col relative text-white" dir="rtl" style={{ background: masterBackground }}>
      {/* خلفية تكنو زجاجية */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      
      <header className="sticky top-0 z-50 bg-slate-950/60 backdrop-blur-2xl border-b border-white/10 px-8 py-4 flex justify-between items-center shadow-2xl">
        <div className="flex items-center gap-4">
            <div className="p-2.5 bg-indigo-600 rounded-2xl shadow-[0_0_20px_rgba(79,70,229,0.4)]">
                <Terminal className="h-6 w-6 text-white" />
            </div>
            <div className="flex flex-col">
                <span className="font-black text-xl text-white tracking-tighter leading-none">Developer Console</span>
                <div className="flex items-center gap-2 mt-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                    <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Sovereign Admin Environment</span>
                </div>
            </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-left hidden sm:block">
            <p className="text-[10px] font-black text-indigo-400 text-left uppercase">Root Session</p>
            <p className="text-xs text-white/60 font-mono font-bold">{user.email}</p>
          </div>
          <Button onClick={logout} variant="destructive" size="sm" className="h-10 rounded-xl font-black gap-2 shadow-lg shadow-red-900/40 bg-red-600 hover:bg-red-700 border-b-4 border-red-900">
            <LogOut className="h-4 w-4" /> خروج آمن
          </Button>
        </div>
      </header>

      <main className="flex-1 p-8 relative z-10 max-w-[1600px] mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
        {children}
      </main>

      <footer className="p-6 text-center border-t border-white/5 bg-black/20">
        <div className="flex items-center justify-center gap-2 opacity-30 group hover:opacity-100 transition-opacity">
            <ShieldAlert className="h-3 w-3 text-indigo-400" />
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.5em]">
                Nova ERP — Master Infrastructure Core v2.5
            </p>
        </div>
      </footer>
    </div>
  );
}
