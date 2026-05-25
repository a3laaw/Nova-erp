
'use client';

import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { LogOut, Terminal, Activity, ShieldAlert, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * غلاف لوحة تحكم المطور (Master Layout V34.1):
 * تم تحويل الخلفية لتبني النمط اللؤلؤي "Light Cream" لراحة تامة للعين.
 */
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
    <div className="min-h-screen flex flex-col relative text-slate-900 bg-[#FFFDF0]" dir="rtl">
      {/* خلفية تكنو هادئة لؤلؤية */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#FF7A00 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-2xl border-b border-indigo-100 px-10 py-5 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-5">
            <div className="p-3 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-100 border-2 border-white">
                <Terminal className="h-6 w-6 text-white" />
            </div>
            <div className="flex flex-col">
                <span className="font-black text-2xl text-[#1e1b4b] tracking-tighter leading-none">غرفة السيادة المركزية</span>
                <div className="flex items-center gap-2 mt-1.5">
                    <Sparkles className="h-3 w-3 text-indigo-500 animate-pulse" />
                    <span className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.4em]">Master Console</span>
                </div>
            </div>
        </div>
        
        <div className="flex items-center gap-8">
          <div className="text-left hidden sm:block">
            <p className="text-[9px] font-black text-indigo-400 text-left uppercase tracking-widest">Administrator</p>
            <p className="text-xs text-slate-500 font-mono font-bold">alaa.wahib@sovereign</p>
          </div>
          <Button onClick={logout} variant="ghost" size="sm" className="h-11 rounded-2xl font-black gap-2 text-red-600 hover:bg-red-50 hover:text-red-700 transition-all border-none">
            <LogOut className="h-4 w-4" /> خروج آمن
          </Button>
        </div>
      </header>

      <main className="flex-1 p-10 relative z-10 max-w-[1700px] mx-auto w-full animate-in fade-in duration-1000">
        {children}
      </main>

      <footer className="p-8 text-center border-t border-indigo-50 bg-white/40 backdrop-blur-md">
        <div className="flex items-center justify-center gap-3 opacity-30">
            <ShieldAlert className="h-4 w-4 text-indigo-600" />
            <p className="text-[10px] font-black text-indigo-900 uppercase tracking-[0.5em]">
                Nova ERP — Sovereign Infrastructure Core v4.1
            </p>
        </div>
      </footer>
    </div>
  );
}
