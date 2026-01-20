'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from '@/components/ui/sidebar';
import {
  Home,
  Briefcase,
  Users,
  Calendar,
  Wallet,
  Warehouse,
  Settings,
  LogOut,
  Bell,
  HeartHandshake
} from 'lucide-react';
import { Logo } from './logo';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import type { AuthenticatedUser } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';

const navItems = {
  ar: [
    { href: '/dashboard', label: 'لوحة التحكم', icon: Home, roles: ['Admin', 'Engineer', 'Accountant', 'Secretary', 'HR'] },
    { href: '/dashboard/notifications', label: 'تنبيهات النظام', icon: Bell, roles: ['Admin', 'Engineer', 'Accountant', 'Secretary', 'HR'] },
    { href: '/dashboard/projects', label: 'المشاريع', icon: Briefcase, roles: ['Admin', 'Engineer', 'Secretary'] },
    { href: '/dashboard/clients', label: 'العملاء', icon: Users, roles: ['Admin', 'Secretary'] },
    { href: '/dashboard/accounting', label: 'المحاسبة', icon: Wallet, roles: ['Admin', 'Accountant'] },
    { href: '/dashboard/warehouse', label: 'المستودع', icon: Warehouse, roles: ['Admin', 'Accountant'] },
    { href: '/dashboard/hr', label: 'الموارد البشرية', icon: HeartHandshake, roles: ['Admin', 'HR', 'Secretary'] },
  ],
  en: [
      { href: '/dashboard', label: 'Dashboard', icon: Home, roles: ['Admin', 'Engineer', 'Accountant', 'Secretary', 'HR'] },
      { href: '/dashboard/notifications', label: 'System Alerts', icon: Bell, roles: ['Admin', 'Engineer', 'Accountant', 'Secretary', 'HR'] },
      { href: '/dashboard/projects', label: 'Projects', icon: Briefcase, roles: ['Admin', 'Engineer', 'Secretary'] },
      { href: '/dashboard/clients', label: 'Clients', icon: Users, roles: ['Admin', 'Secretary'] },
      { href: '/dashboard/accounting', label: 'Accounting', icon: Wallet, roles: ['Admin', 'Accountant'] },
      { href: '/dashboard/warehouse', label: 'Warehouse', icon: Warehouse, roles: ['Admin', 'Accountant'] },
      { href: '/dashboard/hr', label: 'Human Resources', icon: HeartHandshake, roles: ['Admin', 'HR', 'Secretary'] },
  ]
};

const settingsItem = {
    ar: { href: '/dashboard/settings', label: 'الإعدادات', icon: Settings, roles: ['Admin'] },
    en: { href: '/dashboard/settings', label: 'Settings', icon: Settings, roles: ['Admin'] }
}
interface MainNavProps {
    currentUser: AuthenticatedUser;
    onLogout: () => void;
}

export function MainNav({ currentUser, onLogout }: MainNavProps) {
  const pathname = usePathname();
  const { language } = useLanguage();
  
  const currentNavItems = navItems[language].filter(item => currentUser.role && item.roles.includes(currentUser.role));
  const currentSettingsItem = settingsItem[language];
  const canViewSettings = currentUser.role && currentSettingsItem.roles.includes(currentUser.role);


  return (
    <>
      <SidebarHeader>
        <div className="flex items-center gap-2">
            <Logo />
            <div className="flex flex-col">
                <span className="text-lg font-semibold font-headline tracking-tighter">scoop</span>
                <span className="text-xs text-muted-foreground">
                    {language === 'ar' ? 'للاستشارات الهندسية' : 'Engineering Consultants'}
                </span>
            </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="p-2">
        <SidebarMenu>
          {currentNavItems.map((item) => (
            <SidebarMenuItem key={item.label}>
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith(item.href) && (item.href !== '/dashboard' || pathname === '/dashboard')}
                tooltip={item.label}
              >
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-2">
        <SidebarMenu>
             {canViewSettings && <SidebarMenuItem>
                <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith(currentSettingsItem.href)}
                    tooltip={currentSettingsItem.label}
                >
                    <Link href={currentSettingsItem.href}>
                        <Settings />
                        <span>{currentSettingsItem.label}</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>}
            <SidebarMenuItem>
              <div className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm outline-none transition-colors text-muted-foreground">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={currentUser.avatarUrl} alt={currentUser.fullName} />
                    <AvatarFallback>{currentUser.fullName?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-sm">
                    <span className="font-semibold text-foreground">{currentUser.fullName}</span>
                    <span className="text-muted-foreground">{currentUser.email}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="mr-auto h-7 w-7 shrink-0" onClick={onLogout}>
                    <LogOut />
                  </Button>
                </div>
            </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
