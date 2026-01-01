'use client';
import { usePathname } from 'next/navigation';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { UserNav } from '@/components/layout/user-nav';
import { Button } from '@/components/ui/button';
import { Languages } from 'lucide-react';
import { useLanguage } from '@/context/language-context';

const getTitleFromPathname = (pathname: string, lang: 'ar' | 'en') => {
    const titles = {
        ar: {
            '/dashboard': 'لوحة التحكم',
            '/dashboard/projects': 'المشاريع',
            '/dashboard/clients': 'العملاء',
            '/dashboard/appointments': 'المواعيد',
            '/dashboard/accounting': 'المحاسبة',
            '/dashboard/warehouse': 'المستودع',
            '/dashboard/settings': 'الإعدادات',
        },
        en: {
            '/dashboard': 'Dashboard',
            '/dashboard/projects': 'Projects',
            '/dashboard/clients': 'Clients',
            '/dashboard/appointments': 'Appointments',
            '/dashboard/accounting': 'Accounting',
            '/dashboard/warehouse': 'Warehouse',
            '/dashboard/settings': 'Settings',
        }
    };
    
    const key = Object.keys(titles.ar).find(key => pathname.startsWith(key as keyof typeof titles.ar) && (key !== '/dashboard' || pathname === '/dashboard')) || '/dashboard';

    return titles[lang][key as keyof typeof titles.ar] || (lang === 'ar' ? 'لوحة التحكم' : 'Dashboard');
};


export function Header() {
    const pathname = usePathname();
    const { language, toggleLanguage } = useLanguage();
    const title = getTitleFromPathname(pathname, language);

    return (
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-card/80 backdrop-blur-sm px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
            <SidebarTrigger className="sm:hidden" />
            <div className="flex items-center gap-2">
                 <h1 className="text-xl font-semibold font-headline">{title}</h1>
            </div>
            <div className="ml-auto flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={toggleLanguage} aria-label="Toggle language">
                    <Languages className="h-4 w-4" />
                </Button>
                <UserNav />
            </div>
        </header>
    );
}
