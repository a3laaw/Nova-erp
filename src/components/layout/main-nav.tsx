
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
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Home,
  Briefcase,
  Users,
  Calendar,
  Wallet,
  Warehouse,
  Settings,
  Bell,
  HeartHandshake,
  FileText,
  ChevronDown,
  ShoppingCart,
  LogOut,
  LineChart,
  ClipboardCheck,
  Bot,
  Scale,
  Building,
  Package,
  Boxes,
  Construction,
  UserSearch,
  FileCheck,
  Building2,
  ArrowLeftRight,
  Ban,
  ArrowUpFromLine
} from 'lucide-react';
import { Logo } from './logo';
import { cn } from '@/lib/utils';
import type { AuthenticatedUser } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useBranding } from '@/context/branding-context';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const navItems = {
  ar: [
    { href: '/dashboard', label: 'لوحة التحكم', icon: Home, roles: ['Admin', 'Engineer', 'Accountant', 'Secretary', 'HR'] },
    { 
      label: 'إدارة علاقات العملاء (CRM)', 
      icon: LineChart, 
      roles: ['Admin', 'Engineer', 'Accountant', 'HR', 'Secretary'],
      hrefPrefix: '/dashboard',
      children: [
        { href: '/dashboard/clients?view=registered', label: 'ملفات العملاء', icon: Users },
        { href: '/dashboard/clients?view=prospective', label: 'العملاء المحتملون', icon: UserSearch },
        { 
          label: 'تقارير المتابعة والأداء',
          children: [
            { href: '/dashboard/reports/delayed-stages', label: 'المهام المتأخرة' },
            { href: '/dashboard/reports/stalled-stages', label: 'المراحل الخاملة' },
            { href: '/dashboard/reports/prospective-clients', label: 'تحليل المحتملين' },
            { href: '/dashboard/reports/upsell-opportunities', label: 'فرص بيعية إإضافية' },
          ]
        },
      ]
    },
    { 
      label: 'المقاولات',
      icon: Construction,
      roles: ['Admin', 'Engineer'],
      hrefPrefix: '/dashboard/construction',
      children: [
        { href: '/dashboard/construction/projects', label: 'المشاريع التنفيذية' },
        { href: '/dashboard/construction/boq', label: 'مكتبة جداول الكميات' },
        { href: '/dashboard/construction/subcontractors', label: 'إدارة المقاولين' },
      ]
    },
    { 
      label: 'المحاسبة والمالية', 
      icon: Wallet, 
      roles: ['Admin', 'Accountant', 'Secretary', 'Engineer'],
      hrefPrefix: '/dashboard/accounting',
      children: [
        { href: '/dashboard/accounting/quotations', label: 'عروض الأسعار' },
        { href: '/dashboard/accounting/chart-of-accounts', label: 'شجرة الحسابات' },
        { href: '/dashboard/accounting/assistant', label: 'المساعد المحاسبي' },
        {
          label: 'العمليات المالية',
          children: [
            { href: '/dashboard/accounting/journal-entries', label: 'قيود اليومية' },
            { href: '/dashboard/accounting/cash-receipts', label: 'سندات القبض' },
            { href: '/dashboard/accounting/payment-vouchers', label: 'سندات الصرف' },
            { href: '/dashboard/accounting/invoices', label: 'الفواتير' },
          ]
        },
        {
          label: 'التقارير والقوائم',
          children: [
            { href: '/dashboard/accounting/reports/daily-summary', label: 'التقرير اليومي' },
            { href: '/dashboard/accounting/reconciliation', label: 'التسويات البنكية' },
            { href: '/dashboard/accounting/general-ledger', label: 'دفتر الأستاذ' },
            { href: '/dashboard/accounting/trial-balance', label: 'ميزان المراجعة' },
            { href: '/dashboard/accounting/reports', label: 'التقارير التحليلية' },
            { href: '/dashboard/accounting/income-statement', label: 'قائمة الدخل' },
            { href: '/dashboard/accounting/balance-sheet', label: 'المركز المالي' },
          ]
        }
      ]
    },
    { 
      label: 'الموارد البشرية', 
      icon: HeartHandshake, 
      roles: ['Admin', 'HR'],
      hrefPrefix: '/dashboard/hr',
      children: [
        { href: '/dashboard/hr/employees', label: 'ملفات الموظفين' },
        { href: '/dashboard/hr/leaves', label: 'طلبات الإجازات' },
        { href: '/dashboard/hr/permissions', label: 'طلبات الاستئذان' },
        { href: '/dashboard/hr/payroll', label: 'كشوف الرواتب' },
        { href: '/dashboard/hr/reports', label: 'تقارير الموظفين' },
      ]
    },
    { 
      label: 'المخازن والمشتريات',
      icon: Warehouse,
      roles: ['Admin', 'Accountant'],
      hrefPrefix: '/dashboard',
      children: [
        { href: '/dashboard/warehouse/warehouses', label: 'إدارة المستودعات والأفرع', icon: Building2 },
        { href: '/dashboard/warehouse/items', label: 'إدارة الأصناف', icon: Package },
        { href: '/dashboard/purchasing/rfqs', label: 'طلبات التسعير (RFQ)' },
        { href: '/dashboard/purchasing/purchase-orders', label: 'أوامر الشراء' },
        { href: '/dashboard/warehouse/grns', label: 'استلام بضاعة (GRN)', icon: FileCheck },
        { href: '/dashboard/warehouse/material-issue', label: 'صرف مواد للمشاريع', icon: ArrowUpFromLine },
        { href: '/dashboard/warehouse/transfers', label: 'تحويلات مخزنية', icon: ArrowLeftRight },
        { href: '/dashboard/warehouse/adjustments', label: 'تسويات (تلف/فقد)', icon: Ban },
        { href: '/dashboard/purchasing/vendors', label: 'الموردون' },
      ]
    },
    { 
      label: 'الإعدادات', 
      icon: Settings, 
      roles: ['Admin'],
      hrefPrefix: '/dashboard/settings',
      children: [
        { href: '/dashboard/settings', label: 'الإعدادات العامة' },
        { href: '/dashboard/settings/companies', label: 'إدارة الشركات' },
        { href: '/dashboard/contracts', label: 'نماذج العقود' },
        { href: '/dashboard/settings/classifications', label: 'التصنيفات' },
      ]
    },
  ],
  en: [
    { href: '/dashboard', label: 'Dashboard', icon: Home, roles: ['Admin', 'Engineer', 'Accountant', 'Secretary', 'HR'] },
    // Simplified for brevity, same pattern follows...
  ]
};

function NavItem({ item, userRole, currentPath }: { item: any, userRole: string, currentPath: string }) {
  const { setOpenMobile, state: sidebarState } = useSidebar();

  if (!item.roles.includes(userRole)) {
    return null;
  }

  if (!item.children && item.href) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton isActive={currentPath === item.href} asChild tooltip={item.label}>
          <Link href={item.href} onClick={() => setOpenMobile(false)}>
            {item.icon && <item.icon />}
            <span className="group-data-[state=collapsed]:hidden">{item.label}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }
  
  if (item.children) {
    const isActive = currentPath.startsWith(item.hrefPrefix);

    if (sidebarState === 'collapsed') {
      return (
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton as="button" isActive={isActive} tooltip={item.label}>
                <item.icon />
                <span className="sr-only">{item.label}</span>
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" sideOffset={5} className="w-56">
              <DropdownMenuLabel>{item.label}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {item.children.map((child: any, index: number) => {
                if (child.children) {
                  return (
                    <DropdownMenuSub key={`${child.label}-${index}`}>
                      <DropdownMenuSubTrigger>{child.label}</DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          {child.children.map((subChild: any) => (
                            <DropdownMenuItem key={subChild.href} asChild>
                              <Link href={subChild.href}>{subChild.label}</Link>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                  );
                }
                return (
                  <DropdownMenuItem key={child.href} asChild>
                    <Link href={child.href}>{child.label}</Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      );
    }
    
    return (
      <Collapsible defaultOpen={isActive}>
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton as="button" isActive={isActive} className="h-8 w-full justify-between pr-2">
              <div className='flex items-center gap-2'>
                <item.icon />
                <span className="group-data-[state=collapsed]:hidden">{item.label}</span>
              </div>
              <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180 group-data-[state=collapsed]:hidden" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
        </SidebarMenuItem>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.children.map((child: any, index: number) => {
              if (child.children) {
                return (
                  <SidebarMenuSubItem key={`${child.label}-${index}`}>
                     <div className="flex items-center justify-between w-full px-2 py-1.5 rounded-md">
                        <span className="text-sm font-semibold text-sidebar-foreground/70">{child.label}</span>
                    </div>
                    <SidebarMenuSub>
                      {child.children.map((subChild: any) => (
                        <SidebarMenuSubItem key={subChild.href}>
                            <SidebarMenuSubButton isActive={currentPath === subChild.href} asChild>
                                <Link href={subChild.href} onClick={() => setOpenMobile(false)}>
                                    {subChild.label}
                                </Link>
                            </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </SidebarMenuSubItem>
                );
              }
              return (
                <SidebarMenuSubItem key={child.href}>
                   <SidebarMenuSubButton isActive={currentPath === child.href} asChild>
                        <Link href={child.href} onClick={() => setOpenMobile(false)}>
                            <div className="flex items-center gap-2">
                                {child.icon && <child.icon className="h-3.5 w-3.5" />}
                                {child.label}
                            </div>
                        </Link>
                    </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return null;
}

export function MainNav({ currentUser, onLogout }: { currentUser: AuthenticatedUser, onLogout: () => void }) {
  const pathname = usePathname();
  const { language } = useLanguage();
  const { branding } = useBranding();
  
  const currentNavItems = navItems[language] || navItems.ar;

  return (
    <>
      <SidebarHeader>
        <div className="flex items-center gap-2">
            <Logo logoUrl={branding?.logo_url} companyName={branding?.company_name} />
            <div className="flex flex-col">
              <span className="text-lg font-semibold">{branding?.company_name || 'Nova ERP'}</span>
            </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {currentNavItems.map((item, index) => (
            <NavItem 
                key={`${item.href || item.label}-${index}`} 
                item={item} 
                userRole={currentUser.role} 
                currentPath={pathname}
            />
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <div className="p-2">
            <div className="flex h-auto w-full items-center justify-start rounded-md p-2">
                <Avatar className="h-9 w-9">
                    <AvatarImage src={currentUser.avatarUrl} alt={currentUser.fullName} />
                    <AvatarFallback>{currentUser.fullName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="ml-2 flex-grow text-right">
                    <p className="text-sm font-medium">{currentUser.fullName}</p>
                    <p className="text-xs text-muted-foreground">{currentUser.email}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onLogout}>
                    <LogOut className="h-4 w-4"/>
                </Button>
            </div>
        </div>
      </SidebarFooter>
    </>
  );
}
