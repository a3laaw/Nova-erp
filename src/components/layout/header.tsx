'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Sparkles, User, Globe, Bell, Languages } from 'lucide-react';
import { useLanguage } from '@/context/language-context';
import type { AuthenticatedUser } from '@/context/auth-context';
import { cn } from '@/lib/utils';
import { Notifications } from './notifications';
import Link from 'next/link';
import { Breadcrumbs } from './breadcrumbs';
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

interface HeaderProps {
    currentUser: AuthenticatedUser;
    onLogout: () => void;
    className?: string;
}

export function Header({ currentUser, onLogout, className }: HeaderProps) {
    const { toggleLanguage, language } = useLanguage();
    const { toggleTheme } = useAppTheme();

    return (
        <header className={cn("sticky top-0 z-30 flex h-20 items-center gap-4 bg-transparent px-8 sm:h-auto sm:border-0 no-print", className)}>
            <div className="flex items-center gap-6">
                <div className="bg-white/60 p-2.5 rounded-2xl border border-white/80 backdrop-blur-xl shadow-lg transition-transform active:scale-95">
                    <SidebarTrigger className="text-[#1e1b4b] size-5" />
                </div>
                <div className="hidden md:flex flex-col gap-1">
                    <Breadcrumbs />
                </div>
            </div>

            <div className="ml-auto flex items-center gap-4">
                <div className="flex items-center bg-white/60 p-1.5 rounded-[1.8rem] border border-white/80 backdrop-blur-2xl gap-1.5 shadow-xl">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={toggleTheme} 
                        className="rounded-full h-10 w-10 text-[#1e1b4b] hover:bg-white/40 transition-all active:scale-90"
                    >
                        <Sparkles className="h-5 w-5" />
                    </Button>
                    
                    <Separator orientation="vertical" className="h-6 bg-[#1e1b4b]/10 mx-1" />

                    <Notifications />

                    <Button 
                        variant="ghost" 
                        onClick={toggleLanguage} 
                        className="h-10 px-4 rounded-full text-[#1e1b4b] hover:bg-primary/5 transition-all flex items-center gap-2 group relative overflow-hidden"
                    >
                        <Globe className="h-4 w-4 opacity-70 group-hover:rotate-12 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-tighter">
                            {language === 'ar' ? 'English' : 'عربي'}
                        </span>
                    </Button>
                </div>

                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-12 w-12 rounded-full p-0 transition-all hover:scale-105 active:scale-95 border-none group focus-visible:ring-0">
                            <Avatar className="h-11 w-11 border border-primary/20 shadow-[0_10px_25px_rgba(0,0,0,0.1)] ring-offset-background transition-all group-hover:ring-2 group-hover:ring-primary/40 overflow-hidden bg-white">
                                <AvatarImage src={currentUser.avatarUrl} alt={`@${currentUser.fullName}`} className="object-cover" />
                                <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black text-xs">
                                    {currentUser.fullName?.charAt(0) || 'N'}
                                </AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-0.5 -left-0.5 h-4 w-4 rounded-full border-2 border-white bg-green-500 shadow-md ring-1 ring-green-600/20" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-64 rounded-[2.2rem] p-2 shadow-[0_25px_60px_rgba(0,0,0,0.2)] bg-white/95 backdrop-blur-2xl border-white/40" align="end" forceMount dir="rtl" style={{ pointerEvents: 'auto' }}>
                        <DropdownMenuLabel className="font-normal p-5">
                            <div className="flex flex-col space-y-2 text-right">
                                <p className="text-sm font-black text-[#1e1b4b] leading-none">{currentUser.fullName}</p>
                                <p className="text-[9px] font-mono text-slate-400 bg-slate-50 p-1.5 rounded-lg border border-slate-100">{currentUser.email}</p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-slate-100 mx-2" />
                        <DropdownMenuItem asChild className="rounded-2xl py-3.5 font-bold cursor-pointer hover:bg-primary/5 mx-1 transition-colors text-[#1e1b4b]">
                            <Link href="/dashboard/settings" className="flex items-center gap-3">
                                <User className="h-4 w-4 opacity-40" />
                                <span>إعدادات الملف الشخصي</span>
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-slate-100 mx-2" />
                        <DropdownMenuItem onClick={onLogout} className="rounded-2xl py-3.5 font-black text-red-600 hover:text-white hover:bg-red-600 focus:bg-red-600 focus:text-white cursor-pointer mx-1 transition-all">
                            <User className="ml-2 h-4 w-4" />
                            <span>تسجيل الخروج الآمن</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}