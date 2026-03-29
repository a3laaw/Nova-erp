'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Languages, Calendar, LogOut, Palette, Sparkles, ShieldAlert, ArrowRight, Zap } from 'lucide-react';
import { useLanguage } from '@/context/language-context';
import type { AuthenticatedUser } from '@/context/auth-context';
import { cn } from '@/lib/utils';
import { Notifications } from './notifications';
import Link from 'next/link';
import { Breadcrumbs } from './breadcrumbs';
import { useBranding } from '@/context/branding-context';
import { UpdateIndicator } from '@/context/sync-context';
import { useAppTheme } from '@/context/theme-context';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';

interface HeaderProps {
    currentUser: AuthenticatedUser;
    onLogout: () => void;
    className?: string;
}

export function Header({ currentUser, onLogout, className }: HeaderProps) {
    const { toggleLanguage } = useLanguage();
    const { branding } = useBranding();
    const { theme, toggleTheme } = useAppTheme();
    const { auth } = useFirebase();
    const { toast } = useToast();
    const isGlass = theme === 'glass';

    const handleExitImpersonation = async () => {
        if (!auth?.currentUser) return;
        try {
            await fetch('/api/switch-company', {
                method: 'POST',
                body: JSON.stringify({ uid: auth.currentUser.uid, companyId: null })
            });
            document.cookie = 'nova-user-session=; max-age=0; path=/';
            await auth.currentUser.getIdToken(true);
            toast({ title: 'تم إنهاء التقمص', description: 'عدت الآن بوضع المطور العام.' });
            window.location.href = '/developer';
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ في التراجع' });
        }
    };

    return (
        <header className={cn("sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-white/5 bg-transparent px-4 sm:static sm:h-auto sm:border-0 sm:px-6", className)}>
            <div className="flex items-center gap-4">
                <div className="bg-slate-950/40 p-1 rounded-full border border-white/10 backdrop-blur-md">
                    <SidebarTrigger className="text-white/80 hover:text-white" />
                </div>
                <div className="hidden md:flex flex-col gap-1">
                    <Breadcrumbs />
                    <UpdateIndicator />
                </div>
            </div>

            <div className="ml-auto flex items-center gap-3">
                {/* 🛡️ Impersonation Alert - Neon Orange */}
                {currentUser.isSuperAdmin && currentUser.currentCompanyId && (
                    <div className="flex items-center gap-2 px-4 h-10 bg-orange-600 text-white rounded-2xl shadow-[0_0_20px_rgba(234,88,12,0.4)] animate-in slide-in-from-top-2 border border-white/20">
                        <ShieldAlert className="h-4 w-4 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">
                            Root Access: {currentUser.companyName || 'Tenant'}
                        </span>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={handleExitImpersonation}
                            className="h-7 px-3 bg-white/20 hover:bg-white/40 text-white rounded-xl font-black text-[9px] gap-1"
                        >
                            Exit <ArrowRight className="h-2 w-2" />
                        </Button>
                    </div>
                )}

                <div className="flex items-center bg-slate-950/40 p-1.5 rounded-2xl border border-white/10 backdrop-blur-md gap-2 shadow-2xl">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={toggleTheme} 
                        title="تبديل السمة"
                        className="rounded-xl h-9 w-9 text-white/60 hover:text-white hover:bg-white/10"
                    >
                        {isGlass ? <Sparkles className="h-4 w-4 animate-pulse text-primary" /> : <Palette className="h-4 w-4" />}
                    </Button>
                    
                    <Separator orientation="vertical" className="h-6 bg-white/10" />

                    <Button variant="ghost" size="icon" asChild className="h-9 w-9 rounded-xl text-white/60 hover:text-white hover:bg-white/10">
                      <Link href="/dashboard/appointments">
                        <Calendar className="h-4 w-4" />
                      </Link>
                    </Button>

                    <Notifications />

                    <Button variant="ghost" size="icon" onClick={toggleLanguage} className="h-9 w-9 rounded-xl text-white/60 hover:text-white hover:bg-white/10">
                        <Languages className="h-4 w-4" />
                    </Button>
                </div>

                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-10 w-10 rounded-2xl p-0 hover:scale-105 transition-transform border-none">
                            <Avatar className="h-10 w-10 border-2 border-primary/40 shadow-lg neon-glow-blue">
                                <AvatarImage src={currentUser.avatarUrl} alt={`@${currentUser.fullName}`} />
                                <AvatarFallback className="bg-slate-900 text-white font-black">{currentUser.fullName?.charAt(0)}</AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-64 rounded-3xl p-2 shadow-2xl bg-slate-950/95 backdrop-blur-2xl border-white/10" align="end" forceMount dir="rtl">
                        <DropdownMenuLabel className="font-normal p-4">
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-black text-white leading-none">{currentUser.fullName}</p>
                                <p className="text-[10px] font-mono text-white/40">{currentUser.email}</p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-white/5" />
                        <DropdownMenuItem asChild className="rounded-xl py-3 font-bold cursor-pointer">
                            <Link href="/dashboard/settings">إعدادات الملف الشخصي</Link>
                        </DropdownMenuItem>
                        {currentUser.isSuperAdmin && (
                            <DropdownMenuItem asChild className="rounded-xl py-3 font-black text-primary bg-primary/5 cursor-pointer mt-1">
                                <Link href="/developer" className="flex items-center gap-2"><Zap className="h-4 w-4"/> لوحة المطور الرئيسي</Link>
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator className="bg-white/5" />
                        <DropdownMenuItem onClick={onLogout} className="rounded-xl py-3 font-black text-red-400 hover:text-red-300 focus:bg-red-500/10 cursor-pointer">
                            <LogOut className="ml-2 h-4 w-4" />
                            <span>تسجيل الخروج الآمن</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}
