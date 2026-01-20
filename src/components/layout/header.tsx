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

const getTitleFromPathname = (pathname: string, lang: 'ar' | 'en') => {
    // Exact matches first
    const exactMatch = titles[lang][pathname as keyof typeof titles.ar];
    if (exactMatch) return exactMatch;

    // Dynamic matches
    const dynamicRoutes = [
        { path: '/dashboard/projects/', title: { ar: 'تفاصيل المشروع', en: 'Project Details' } },
        { path: '/dashboard/accounting/cash-receipts/new', title: { ar: 'سند قبض جديد', en: 'New Cash Receipt' } },
        { path: '/dashboard/hr/employees/new', title: { ar: 'إضافة موظف جديد', en: 'New Employee' } },
        { path: '/dashboard/hr/employees/[id]/edit', title: { ar: 'تعديل بيانات الموظف', en: 'Edit Employee' } },
        { path: '/dashboard/hr/employees/[id]', title: { ar: 'الملف الشخصي للموظف', en: 'Employee Profile' } },
        { path: '/dashboard/hr/leave-requests', title: { ar: 'طلبات الإجازة', en: 'Leave Requests' } },
    ];

    for (const route of dynamicRoutes) {
         // Replace [id] with a regex pattern to match any value
        const pattern = new RegExp(`^${route.path.replace(/\[id\]/, '[^/]+')}$`);
        if (pattern.test(pathname)) {
            return route.title[lang];
        }
    }
    
    // Fallback to parent section
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length > 1) {
        const parentPath = `/${segments[0]}/${segments[1]}`;
        const parentTitle = titles[lang][parentPath as keyof typeof titles.ar];
        if (parentTitle) return parentTitle;
    }


    return titles[lang]['/dashboard'];
};

const titles = {
    ar: {
        '/dashboard': 'لوحة التحكم',
        '/dashboard/projects': 'المشاريع',
        '/dashboard/clients': 'العملاء',
        '/dashboard/appointments': 'المواعيد',
        '/dashboard/accounting': 'المحاسبة',
        '/dashboard/warehouse': 'المستودع',
        '/dashboard/hr': 'الموارد البشرية',
        '/dashboard/settings': 'الإعدادات',
        '/dashboard/notifications': 'تنبيهات النظام',
    },
    en: {
        '/dashboard': 'Dashboard',
        '/dashboard/projects': 'Projects',
        '/dashboard/clients': 'Clients',
        '/dashboard/appointments': 'Appointments',
        '/dashboard/accounting': 'Accounting',
        '/dashboard/warehouse': 'Warehouse',
        '/dashboard/hr': 'Human Resources',
        '/dashboard/settings': 'Settings',
        '/dashboard/notifications': 'System Alerts',
    }
};

interface HeaderProps {
    currentUser: AuthenticatedUser;
    onLogout: () => void;
    className?: string;
}

export function Header({ currentUser, onLogout, className }: HeaderProps) {
    const pathname = usePathname();
    const { language, toggleLanguage } = useLanguage();
    const title = getTitleFromPathname(pathname, language);

    return (
        <header className={cn("sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-card/80 backdrop-blur-sm px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6", className)}>
            <SidebarTrigger />
            <div className="flex items-center gap-2">
                 <h1 className="text-xl font-semibold font-headline">{title}</h1>
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
