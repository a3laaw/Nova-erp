'use client';
import { usePathname } from 'next/navigation';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { UserNav } from '@/components/layout/user-nav';
import { Home, Building, Users, Calendar, Briefcase, Warehouse, Settings } from 'lucide-react';

const getTitleFromPathname = (pathname: string) => {
    if (pathname.startsWith('/dashboard/projects')) return 'Projects';
    if (pathname.startsWith('/dashboard/clients')) return 'Clients';
    if (pathname.startsWith('/dashboard/appointments')) return 'Appointments';
    if (pathname.startsWith('/dashboard/accounting')) return 'Accounting';
    if (pathname.startsWith('/dashboard/warehouse')) return 'Warehouse';
    if (pathname.startsWith('/dashboard/settings')) return 'Settings';
    return 'Dashboard';
};


export function Header() {
    const pathname = usePathname();
    const title = getTitleFromPathname(pathname);

    return (
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-card/80 backdrop-blur-sm px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
            <SidebarTrigger className="sm:hidden" />
            <div className="flex items-center gap-2">
                 <h1 className="text-xl font-semibold font-headline">{title}</h1>
            </div>
            <div className="ml-auto flex items-center gap-4">
                <UserNav />
            </div>
        </header>
    );
}
