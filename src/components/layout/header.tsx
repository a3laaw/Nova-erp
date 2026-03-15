'use client';

import { usePathname } from 'next/navigation';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Languages, Calendar, LogOut, Palette, Sparkles } from 'lucide-react';
import { useLanguage } from '@/context/language-context';
import type { AuthenticatedUser } from '@/context/auth-context';
import { cn } from '@/lib/utils';
import { Notifications } from './notifications';
import Link from 'next/link';
import { Breadcrumbs } from './breadcrumbs';
import { useBranding } from '@/context/branding-context';
import { Logo } from './logo';
import { Skeleton } from '../ui/skeleton';
import { UpdateIndicator } from '@/context/sync-context';
import { useAppTheme } from '@/context/theme-context';
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
    const { toggleLanguage } = useLanguage();
    const { branding, loading: brandingLoading } = useBranding();
    const { theme, toggleTheme } = useAppTheme();
    const isGlass = theme === 'glass';

    return (
        <header className={cn("sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-card/80 backdrop-blur-sm px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6", className)}>
            <div className="flex items-center gap-4">
                <SidebarTrigger className={cn(isGlass && "text-slate-900 opacity-80")} />
                {/* Mobile-only Logo */}
                <div className="md:hidden">
                    {brandingLoading ? (
                        <Skeleton className="h-8 w-8" />
                    ) : (
                        <Logo logoUrl={branding?.logo_url} companyName={branding?.company_name} className="h-8 w-8 !p-1.5" />
                    )}
                </div>
                {/* Desktop-only Breadcrumbs and Update Indicator */}
                <div className="hidden md:flex items-center gap-4">
                    <Breadcrumbs />
                    <UpdateIndicator />
                </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={toggleTheme} 
                    title="تبديل الثيم"
                    className={cn(
                        "rounded-full px-4 gap-2 transition-all duration-500 shadow-sm",
                        isGlass ? "bg-white/50 text-slate-950 border-white/60 hover:bg-white/70" : "border-primary text-primary"
                    )}
                >
                    {isGlass ? <Sparkles className="h-4 w-4 animate-pulse text-indigo-600" /> : <Palette className="h-4 w-4" />}
                    <span className="hidden sm:inline font-black text-[10px] uppercase tracking-widest">
                        {isGlass ? 'Glass Mode' : 'Default UI'}
                    </span>
                </Button>
                
                <Button variant="outline" size="icon" asChild className={cn(isGlass ? "header-icon-glass" : "")}>
                  <Link href="/dashboard/appointments">
                    <Calendar className="h-4 w-4" />
                    <span className="sr-only">Appointments</span>
                  </Link>
                </Button>
                <Notifications />
                <Button variant="outline" size="icon" onClick={toggleLanguage} aria-label="Toggle language" className={cn(isGlass ? "header-icon-glass" : "")}>
                    <Languages className="h-4 w-4" />
                </Button>
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                            <Avatar className="h-9 w-9 border-2 border-white shadow-sm">
                                <AvatarImage src={currentUser.avatarUrl} alt={`@${currentUser.fullName}`} />
                                <AvatarFallback>{currentUser.fullName?.charAt(0)}</AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" forceMount dir="rtl">
                        <DropdownMenuLabel className="font-normal">
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-medium leading-none">{currentUser.fullName}</p>
                                <p className="text-xs leading-none text-muted-foreground">
                                {currentUser.email}
                                </p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <Link href="/dashboard/settings">الإعدادات</Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={onLogout}>
                            <LogOut className="ml-2 h-4 w-4" />
                            <span>تسجيل الخروج</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}