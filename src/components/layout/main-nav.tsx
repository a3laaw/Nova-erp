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
  useSidebar, // Import useSidebar
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent
} from '@/components/ui/dropdown-menu'; // Import DropdownMenu components
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
import { useBranding } from '@/context/branding-context';

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
      roles: ['Admin', 'Accountant', 'Secretary', 'Engineer'],
      hrefPrefix: '/dashboard/accounting',
      children: [
        { href: '/dashboard/accounting', label: 'لوحة التحكم المحاسبية' },
        { href: '/dashboard/accounting/quotations', label: 'عروض الأسعار' },
        { href: '/dashboard/accounting/invoices', label: 'الفواتير' },
        { href: '/dashboard/accounting/chart-of-accounts', label: 'شجرة الحسابات' },
        { href: '/dashboard/accounting/assistant', label: 'المساعد الذكي' },
        {
          label: 'قيود وسندات',
          hrefPrefix: '/dashboard/accounting',
          children: [
            { href: '/dashboard/accounting/journal-entries', label: 'قيود اليومية' },
            { href: '/dashboard/accounting/cash-receipts', label: 'سندات القبض' },
            { href: '/dashboard/accounting/payment-vouchers', label: 'سندات الصرف' },
          ]
        },
        {
          label: 'التقارير المالية',
          hrefPrefix: '/dashboard/accounting',
          children: [
            { href: '/dashboard/accounting/general-ledger', label: 'دفتر الأستاذ العام' },
            { href: '/dashboard/accounting/trial-balance', label: 'ميزان المراجعة' },
            { href: '/dashboard/accounting/client-statements', label: 'كشوفات حسابات العملاء' },
          ]
        },
        {
          label: 'القوائم المالية',
          hrefPrefix: '/dashboard/accounting',
          children: [
            { href: '/dashboard/accounting/income-statement', label: 'قائمة الدخل' },
            { href: '/dashboard/accounting/balance-sheet', label: 'قائمة المركز المالي' },
            { href: '/dashboard/accounting/cash-flow', label: 'قائمة التدفقات النقدية' },
            { href: '/dashboard/accounting/equity-statement', label: 'قائمة التغير في حقوق الملكية' },
            { href: '/dashboard/accounting/financial-statement-notes', label: 'الإيضاحات المتممة' },
          ]
        }
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
          roles: ['Admin', 'Accountant', 'Secretary', 'Engineer'],
          hrefPrefix: '/dashboard/accounting',
          children: [
            { href: '/dashboard/accounting', label: 'Accounting Dashboard' },
            { href: '/dashboard/accounting/quotations', label: 'Quotations' },
            { href: '/dashboard/accounting/invoices', label: 'Invoices' },
            { href: '/dashboard/accounting/chart-of-accounts', label: 'Chart of Accounts' },
            { href: '/dashboard/accounting/assistant', label: 'AI Assistant' },
            {
              label: 'Entries & Vouchers',
              hrefPrefix: '/dashboard/accounting',
              children: [
                { href: '/dashboard/accounting/journal-entries', label: 'Journal Entries' },
                { href: '/dashboard/accounting/cash-receipts', label: 'Cash Receipts' },
                { href: '/dashboard/accounting/payment-vouchers', label: 'Payment Vouchers' },
              ]
            },
            {
              label: 'Financial Reports',
              hrefPrefix: '/dashboard/accounting',
              children: [
                { href: '/dashboard/accounting/general-ledger', label: 'General Ledger' },
                { href: '/dashboard/accounting/trial-balance', label: 'Trial Balance' },
                { href: '/dashboard/accounting/client-statements', label: 'Client Statements' },
              ]
            },
            {
              label: 'Financial Statements',
              hrefPrefix: '/dashboard/accounting',
              children: [
                { href: '/dashboard/accounting/income-statement', label: 'Income Statement' },
                { href: '/dashboard/accounting/balance-sheet', label: 'Balance Sheet' },
                { href: '/dashboard/accounting/cash-flow', label: 'Cash Flow Statement' },
                { href: '/dashboard/accounting/equity-statement', label: 'Statement of Equity' },
                { href: '/dashboard/accounting/financial-statement-notes', label: 'Notes to Financial Statements' },
              ]
            }
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

// New recursive component for rendering sub-menus in a Dropdown
function RecursiveSubmenu({ items, pathname }: { items: any[]; pathname: string }) {
  return (
    <>
      {items.map((item: any) =>
        item.children ? (
          <DropdownMenuSub key={item.label}>
            <DropdownMenuSubTrigger>
              <span>{item.label}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                <RecursiveSubmenu items={item.children} pathname={pathname} />
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        ) : (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={item.href} className={pathname === item.href ? "bg-accent" : ""}>
              {item.label}
            </Link>
          </DropdownMenuItem>
        )
      )}
    </>
  );
}


export function MainNav({ currentUser, onLogout }: MainNavProps) {
  const pathname = usePathname();
  const { language } = useLanguage();
  const { branding, loading } = useBranding();
  const { state: sidebarState } = useSidebar();
  
  const currentNavItems = navItems[language].filter(item => currentUser.role && item.roles.includes(currentUser.role));
  const currentSettingsItem = settingsItem[language];
  const canViewSettings = currentUser.role && currentSettingsItem.roles.includes(currentUser.role);


  return (
    <>
      <SidebarHeader>
        <div className="flex items-center gap-2">
            <Logo logoUrl={branding?.logo_url} companyName={branding?.company_name} />
            <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                <span className="text-lg font-semibold tracking-tighter">{branding?.company_name || 'Nova ERP'}</span>
                <span className="text-xs text-muted-foreground">
                    {language === 'ar' ? 'نظام إدارة متكامل' : 'Integrated Management System'}
                </span>
            </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="p-2">
        <SidebarMenu>
          {currentNavItems.map((item) => (
            <SidebarMenuItem key={item.label}>
              {item.children ? (
                sidebarState === 'expanded' ? (
                  <Collapsible asChild defaultOpen={pathname.startsWith(item.hrefPrefix)}>
                    <div className='w-full'>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          className="justify-between w-full"
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
                          {item.children.map((child: any) => (
                            child.children ? (
                              <SidebarMenuSubItem key={child.label}>
                                <Collapsible defaultOpen={child.children.some((gc: any) => pathname === gc.href)} className="w-full">
                                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md p-2 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent/50 [&_svg]:data-[state=open]:rotate-180">
                                    <span className="font-medium">{child.label}</span>
                                    <ChevronDown className="h-4 w-4 transition-transform" />
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className="pl-4">
                                    <SidebarMenuSub>
                                      {child.children.map((grandchild: any) => (
                                        <SidebarMenuSubItem key={grandchild.href}>
                                          <SidebarMenuSubButton
                                            asChild
                                            isActive={pathname === grandchild.href}
                                          >
                                            <Link href={grandchild.href}>
                                              <span>{grandchild.label}</span>
                                            </Link>
                                          </SidebarMenuSubButton>
                                        </SidebarMenuSubItem>
                                      ))}
                                    </SidebarMenuSub>
                                  </CollapsibleContent>
                                </Collapsible>
                              </SidebarMenuSubItem>
                            ) : (
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
                            )
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuButton
                        isActive={pathname.startsWith(item.hrefPrefix)}
                        tooltip={item.label}
                      >
                        <item.icon />
                        <span className="sr-only">{item.label}</span>
                      </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start" sideOffset={5} className="w-56" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                      <DropdownMenuLabel>{item.label}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <RecursiveSubmenu items={item.children} pathname={pathname} />
                    </DropdownMenuContent>
                  </DropdownMenu>
                )
              ) : (
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
              )}
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
              <div className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm outline-none transition-colors text-muted-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={currentUser.avatarUrl} alt={currentUser.fullName} />
                    <AvatarFallback>{currentUser.fullName?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-sm group-data-[collapsible=icon]:hidden">
                    <span className="font-semibold text-foreground">{currentUser.fullName}</span>
                    <span className="text-xs text-muted-foreground">{currentUser.email}</span>
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
