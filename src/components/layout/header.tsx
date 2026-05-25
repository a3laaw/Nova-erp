'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { 
    User, 
    Globe, 
    CalendarDays, 
    Moon, 
    Sun,
    ListTodo,
    Bookmark,
    LogOut,
    Settings,
    Building2,
    Sparkles,
    ChevronDown,
    Palette
} from 'lucide-react';
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
    const { toggleTheme, theme } = useAppTheme();

    return (
        <header className={cn("sticky top-0 z-30 flex h-20 items-center gap-4 bg-transparent px-8 sm:h-auto sm:border-0 no-print", className)}>
            <div className="flex items-center gap-6">
                <div className="bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-2xl border border-white/80 dark:border-white/10 backdrop-blur-xl shadow-lg transition-transform active:scale-95 group">
                    <SidebarTrigger className="text-foreground size-5 group-hover:text-primary transition-colors" />
                </div>
                <div className="hidden md:flex flex-col gap-1">
                    <Breadcrumbs />
                </div>
            </div>

            <div className="ml-auto flex items-center">
                <div className="flex items-center bg-white/70 dark:bg-slate-900/80 p-1.5 rounded-[2.2rem] border-2 border-white/80 dark:border-white/10 backdrop-blur-2xl gap-1.5 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)]">
                    
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="relative h-11 w-11 rounded-full p-0 transition-all hover:scale-105 active:scale-95 border-none group focus-visible:ring-0">
                                <Avatar className="h-10 w-10 border-2 border-primary/20 shadow-md ring-offset-background transition-all group-hover:ring-2 group-hover:ring-primary/40 overflow-hidden bg-white">
                                    <AvatarImage src={currentUser.avatarUrl} alt={currentUser.fullName} className="object-cover" />
                                    <AvatarFallback className="bg-primary text-white font-black text-xs">
                                        {currentUser.fullName?.charAt(0) || 'N'}
                                    </AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-64 rounded-[2.2rem] p-2 shadow-2xl bg-white/95 border-none mt-2" align="start" dir="rtl">
                            <DropdownMenuLabel className="font-normal p-5">
                                <div className="flex flex-col space-y-2 text-right">
                                    <p className="text-sm font-black text-[#1e1b4b] leading-none">{currentUser.fullName}</p>
                                    <p className="text-[9px] font-mono text-slate-500 bg-slate-50 p-1.5 rounded-lg border border-slate-100">{currentUser.email}</p>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-slate-100 mx-2" />
                            <DropdownMenuItem asChild className="rounded-2xl py-3.5 font-black cursor-pointer hover:bg-primary/5 mx-1 text-black">
                                <Link href="/dashboard/settings/profile" className="flex items-center gap-3">
                                    <User className="h-4 w-4 text-primary opacity-60" />
                                    <span>ملفي الشخصي</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild className="rounded-2xl py-3.5 font-black cursor-pointer hover:bg-primary/5 mx-1 text-black">
                                <Link href="/dashboard/settings" className="flex items-center gap-3">
                                    <Settings className="h-4 w-4 text-primary opacity-60" />
                                    <span>إعدادات النظام</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-slate-100 mx-2" />
                            <DropdownMenuItem onClick={onLogout} className="rounded-2xl py-3.5 font-black text-red-600 hover:text-white hover:bg-red-600 cursor-pointer mx-1 transition-all">
                                <LogOut className="ml-2 h-4 w-4" />
                                <span>خروج</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Separator orientation="vertical" className="h-6 bg-slate-200 mx-1" />

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 text-foreground hover:bg-primary/10 hover:text-primary transition-all active:scale-90 group relative">
                                <CalendarDays className="h-5 w-5" />
                                <ChevronDown className="absolute -bottom-1 h-3 w-3 opacity-20 group-hover:opacity-100 transition-opacity" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="center" className="w-60 rounded-[1.8rem] p-2 shadow-2xl bg-white border-none mt-2" dir="rtl">
                            <DropdownMenuLabel className="font-black text-[10px] text-slate-400 uppercase tracking-widest px-4 py-3 text-right">رادار المواعيد</DropdownMenuLabel>
                            <DropdownMenuItem asChild className="rounded-xl py-3.5 px-4 font-black cursor-pointer group mb-1 text-black">
                                <Link href="/dashboard/appointments?tab=architectural" className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-orange-50 rounded-xl text-[#FF7A00] group-hover:bg-[#FF7A00] group-hover:text-white transition-colors">
                                            <CalendarDays className="h-4 w-4" />
                                        </div>
                                        <span>مواعيد المعماري</span>
                                    </div>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild className="rounded-xl py-3.5 px-4 font-black cursor-pointer group text-black">
                                <Link href="/dashboard/appointments?tab=rooms" className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-50 rounded-xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                            <Building2 className="h-4 w-4" />
                                        </div>
                                        <span>حجز القاعات</span>
                                    </div>
                                </Link>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 text-foreground hover:bg-primary/10 hover:text-primary">
                                <Sparkles className="h-5 w-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="center" className="w-56 rounded-[1.8rem] p-2 shadow-2xl bg-white border-none mt-2" dir="rtl">
                            <DropdownMenuLabel className="font-black text-[10px] text-slate-400 uppercase tracking-widest px-3 py-2 text-right">أدوات العمل</DropdownMenuLabel>
                            <DropdownMenuItem asChild className="rounded-xl py-3 font-black cursor-pointer group text-black">
                                <Link href="/dashboard/productivity?tab=tasks" className="flex items-center gap-3">
                                    <div className="p-1.5 bg-green-50 rounded-lg text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors">
                                        <ListTodo className="h-4 w-4" />
                                    </div>
                                    <span>مهامي الشخصية</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild className="rounded-xl py-3 font-black cursor-pointer group text-black">
                                <Link href="/dashboard/productivity?tab=bookmarks" className="flex items-center gap-3">
                                    <div className="p-1.5 bg-orange-50 rounded-lg text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                                        <Bookmark className="h-4 w-4" />
                                    </div>
                                    <span>المفضلات</span>
                                </Link>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Notifications />

                    <Separator orientation="vertical" className="h-6 bg-slate-200 mx-1" />

                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={toggleTheme} 
                        className="rounded-full h-10 w-10 text-foreground hover:bg-primary/10 hover:text-primary transition-all active:scale-90"
                        title="تغيير المظهر"
                    >
                        <Palette className="h-5 w-5" />
                    </Button>

                    <Button 
                        variant="ghost" 
                        onClick={toggleLanguage} 
                        className="h-10 px-4 rounded-full text-foreground hover:bg-primary/10 hover:text-primary transition-all flex items-center gap-2 group"
                    >
                        <Globe className="h-4 w-4 opacity-70" />
                        <span className="text-[10px] font-black uppercase tracking-tighter text-black">
                            {language === 'ar' ? 'English' : 'عربي'}
                        </span>
                    </Button>
                </div>
            </div>
        </header>
    );
}
