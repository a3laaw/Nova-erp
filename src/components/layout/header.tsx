'use client';

import { usePathname } from 'next/navigation';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { UserNav } from '@/components/layout/user-nav';
import { Button } from '@/components/ui/button';
import { Languages, Calendar } from 'lucide-react';
import { useLanguage } from '@/context/language-context';
import type { AuthenticatedUser } from '@/context/auth-context';
import { cn } from '@/lib/utils';
import { Notifications } from './notifications';
import Link from 'next/link';
import { Breadcrumbs } from './breadcrumbs';
import { useBranding } from '@/context/branding-context';
import { Logo } from './logo';
import { Skeleton } from '../ui/skeleton';

interface HeaderProps {
    currentUser: AuthenticatedUser;
    onLogout: () => void;
    className?: string;
}

export function Header({ currentUser, onLogout, className }: HeaderProps) {
    const { toggleLanguage } = useLanguage();
    const { branding, loading: brandingLoading } = useBranding();

    return (
        <header className={cn("sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-card/80 backdrop-blur-sm px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6", className)}>
            <div className="flex items-center gap-2 md:hidden">
                <SidebarTrigger />
                {brandingLoading ? (
                    <Skeleton className="h-8 w-8" />
                ) : (
                    <Logo logoUrl={branding?.logo_url} companyName={branding?.company_name} className="h-8 w-8 !p-1.5" />
                )}
            </div>
            
            <div className="hidden md:block">
                <Breadcrumbs />
            </div>

            <div className="ml-auto flex items-center gap-2">
                <Button variant="outline" size="icon" asChild>
                  <Link href="/dashboard/appointments">
                    <Calendar className="h-4 w-4" />
                    <span className="sr-only">Appointments</span>
                  </Link>
                </Button>
                <Notifications />
                <Button variant="outline" size="icon" onClick={toggleLanguage} aria-label="Toggle language">
                    <Languages className="h-4 w-4" />
                </Button>
                <UserNav currentUser={currentUser} onLogout={onLogout} />
            </div>
        </header>
    );
}
