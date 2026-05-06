'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Languages, LogOut, Sparkles } from 'lucide-react';
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
        <header className={cn("sticky top-0 z-30 flex h-20 items-center gap-4 bg-transparent px-8 sm:h-auto sm:border-0", className)}>
            <div className="flex items-center gap-6">
                <div className="bg-white/40 p-2 rounded-2xl border border-white/60 backdrop-blur-xl shadow-lg">
                    <SidebarTrigger className="text-[#1e1b4b]" />
                </div>
                <div className="hidden md:flex flex-col gap-1">
                    <Breadcrumbs />
                </div>
            </div>

            <div className="ml-auto flex items-center gap-4">
                <div className="flex items-center bg-white/40 p-1.5 rounded-2xl border border-white/60 backdrop-blur-xl gap-2 shadow-lg">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={toggleTheme} 
                        className="rounded-xl h-10 w-10 text-[#1e1b4b] hover:bg-white/40 transition-all active:scale-90"
                    >
                        <Sparkles className="h-5 w-5" />
                    </Button>
                    
                    <Separator orientation="vertical" className="h-6 bg-[#1e1b4b]/10" />

                    <Notifications />

                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={toggleLanguage} 
                        className="h-10 w-10 rounded-xl text-[#1e1b4b] hover:bg-white/40 transition-all flex items-center justify-center gap-1 group"
                    >
                        <Languages className="h-4 w-4 group-hover:rotate-12 transition-transform" />
                        <span className="text-[10px] font-black uppercase">{language === 'ar' ? 'EN' : 'AD'}</span>
                    </Button>
                </div>

                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-12 w-12 rounded-[1.2rem] p-0 hover:scale-105 transition-transform border-none">
                            <Avatar className="h-12 w-12 border-4 border-white/60 shadow-xl">
                                <AvatarImage src={currentUser.avatarUrl} alt={`@${currentUser.fullName}`} />
                                <AvatarFallback className="bg-white text-[#1e1b4b] font-black">{currentUser.fullName?.charAt(0)}</AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-64 rounded-[2rem] p-2 shadow-2xl bg-white/95 backdrop-blur-2xl border-none" align="end" forceMount dir="rtl">
                        <DropdownMenuLabel className="font-normal p-4">
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-black text-[#1e1b4b] leading-none">{currentUser.fullName}</p>
                                <p className="text-[10px] font-mono text-slate-400">{currentUser.email}</p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-slate-100" />
                        <DropdownMenuItem asChild className="rounded-xl py-3 font-bold cursor-pointer">
                            <Link href="/dashboard/settings">الملف الشخصي</Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-slate-100" />
                        <DropdownMenuItem onClick={onLogout} className="rounded-xl py-3 font-black text-red-600 hover:text-red-700 focus:bg-red-50 cursor-pointer">
                            <LogOut className="ml-2 h-4 w-4" />
                            <span>تسجيل الخروج</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}
