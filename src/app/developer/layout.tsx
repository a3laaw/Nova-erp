'use client';

import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { LogOut, Terminal, Activity, ShieldAlert, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * غلاف لوحة تحكم المطور (Master Layout V34.0):
 * تم تفتيح الواجهة بالكامل لتبني النمط اللؤلؤي المريح للعين.
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

  // ✨ تدرج لؤلؤي فاتح وفخم ✨
  const masterBackground = "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)";

  return (
    <div className="min-h-screen flex flex-col relative text-slate-900" dir="rtl" style={{ background: masterBackground }}>
      {/* خلفية تكنو هادئة */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#6366f1 1px, transparent 1px)', backgroundSize: '50px 50px' }} />
      
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-2xl border-b border-indigo-100 px-8 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
            <div className="p-2.5 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-100 border-2 border-white">
                <Terminal className="h-6 w-6 text-white" />
            </div>
            <div className="flex flex-col">
                <span className="font-black text-xl text-[#1e1b4b] tracking-tighter leading-none">غرفة التحكم الرئيسية</span>
                <div className="flex items-center gap-2 mt-1">
                    <Sparkles className="h-3 w-3 text-indigo-500 animate-pulse" />
                    <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Master Environment</span>
                </div>
            </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-left hidden sm:block">
            <p className="text-[10px] font-black text-indigo-400 text-left uppercase">Root Session</p>
            <p className="text-xs text-slate-500 font-mono font-bold">{user.email}</p>
          </div>
          <Button onClick={logout} variant="ghost" size="sm" className="h-10 rounded-xl font-black gap-2 text-red-600 hover:bg-red-50">
            <LogOut className="h-4 w-4" /> خروج
          </Button>
        </div>
      </header>

      <main className="flex-1 p-8 relative z-10 max-w-[1600px] mx-auto w-full animate-in fade-in duration-1000">
        {children}
      </main>

      <footer className="p-6 text-center border-t border-indigo-50 bg-white/20">
        <div className="flex items-center justify-center gap-2 opacity-30">
            <ShieldAlert className="h-3 w-3 text-indigo-600" />
            <p className="text-[10px] font-black text-indigo-900 uppercase tracking-[0.5em]">
                Nova ERP — Master Infrastructure Core v3.0
            </p>
        </div>
      </footer>
    </div>
  );
}
