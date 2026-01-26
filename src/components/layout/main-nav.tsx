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
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  HeartHandshake,
  FileText,
  ChevronDown,
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
    { href: '/dashboard/contracts', label: 'العقود', icon: FileText, roles: ['Admin', 'Accountant', 'Secretary'] },
    { 
      label: 'المحاسبة', 
      icon: Wallet, 
      roles: ['Admin', 'Accountant'],
      hrefPrefix: '/dashboard/accounting',
      children: [
        { href: '/dashboard/accounting', label: 'لوحة التحكم المحاسبية' },
        { href: '/dashboard/accounting/cash-receipts', label: 'سندات القبض' },
        { href: '/dashboard/accounting/payment-vouchers', label: 'سندات الصرف' },
        { href: '/dashboard/accounting/journal-entries', label: 'قيود اليومية' },
        { href: '/dashboard/accounting/chart-of-accounts', label: 'شجرة الحسابات' },
        { href: '/dashboard/accounting/invoices', label: 'الفواتير' },
        { href: '/dashboard/accounting/assistant', label: 'المساعد الذكي' },
      ]
    },
    { href: '/dashboard/warehouse', label: 'المستودع', icon: Warehouse, roles: ['Admin', 'Accountant'] },
    { href: '/dashboard/hr', label: 'الموارد البشرية', icon: HeartHandshake, roles: ['Admin', 'HR', 'Secretary'] },
  ],
  en: [
      { href: '/dashboard', label: 'Dashboard', icon: Home, roles: ['Admin', 'Engineer', 'Accountant', 'Secretary', 'HR'] },
      { href: '/dashboard/notifications', label: 'System Alerts', icon: Bell, roles: ['Admin', 'Engineer', 'Accountant', 'Secretary', 'HR'] },
      { href: '/dashboard/projects', label: 'Projects', icon: Briefcase, roles: ['Admin', 'Engineer', 'Secretary'] },
      { href: '/dashboard/clients', label: 'Clients', icon: Users, roles: ['Admin', 'Secretary'] },
      { href: '/dashboard/contracts', label: 'Contracts', icon: FileText, roles: ['Admin', 'Accountant', 'Secretary'] },
      { 
          label: 'Accounting', 
          icon: Wallet, 
          roles: ['Admin', 'Accountant'],
          hrefPrefix: '/dashboard/accounting',
          children: [
            { href: '/dashboard/accounting', label: 'Accounting Dashboard' },
            { href: '/dashboard/accounting/cash-receipts', label: 'Cash Receipts' },
            { href: '/dashboard/accounting/payment-vouchers', label: 'Payment Vouchers' },
            { href: '/dashboard/accounting/journal-entries', label: 'Journal Entries' },
            { href: '/dashboard/accounting/chart-of-accounts', label: 'Chart of Accounts' },
            { href: '/dashboard/accounting/invoices', label: 'Invoices' },
            { href: '/dashboard/accounting/assistant', label: 'AI Assistant' },
          ]
        },
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
            <div className="flex flex-col group-data-[collapsible=icon]:hidden">
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
            item.children ? (
              <Collapsible asChild key={item.label} defaultOpen={pathname.startsWith(item.hrefPrefix)}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      className="justify-between"
                      isActive={pathname.startsWith(item.hrefPrefix)}
                    >
                      <div className="flex items-center gap-2">
                        <item.icon />
                        <span>{item.label}</span>
                      </div>
                      <ChevronDown className="h-4 w-4 transition-transform [&[data-state=open]]:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {item.children.map((child) => (
                        <SidebarMenuSubItem key={child.href}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={pathname === child.href}
                          >
                            <Link href={child.href}>
                              <span>{child.label}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            ) : (
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
            )
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
              <div className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm outline-none transition-colors text-muted-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={currentUser.avatarUrl} alt={currentUser.fullName} />
                    <AvatarFallback>{currentUser.fullName?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-sm group-data-[collapsible=icon]:hidden">
                    <span className="font-semibold text-foreground">{currentUser.fullName}</span>
                    <span className="text-muted-foreground">{currentUser.email}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="mr-auto h-7 w-7 shrink-0 group-data-[collapsible=icon]:hidden" onClick={onLogout}>
                    <LogOut />
                  </Button>
                </div>
            </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
