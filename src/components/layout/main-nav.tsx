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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  LogOut
} from 'lucide-react';
import { Logo } from './logo';
import { cn } from '@/lib/utils';
import type { AuthenticatedUser } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useBranding } from '@/context/branding-context';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '@/components/ui/button';


const navItems = {
  ar: [
    { href: '/dashboard', label: 'لوحة التحكم', icon: Home, roles: ['Admin', 'Engineer', 'Accountant', 'Secretary', 'HR'] },
    { href: '/dashboard/notifications', label: 'تنبيهات النظام', icon: Bell, roles: ['Admin', 'Engineer', 'Accountant', 'Secretary', 'HR'] },
    { href: '/dashboard/projects', label: 'المشاريع', icon: Briefcase, roles: ['Admin', 'Engineer', 'Secretary'] },
    { href: '/dashboard/clients', label: 'العملاء', icon: Users, roles: ['Admin', 'Secretary'] },
    { href: '/dashboard/contracts', label: 'العقود', icon: FileText, roles: ['Admin', 'Accountant', 'Secretary'] },
    { href: '/dashboard/purchasing', label: 'المشتريات', icon: ShoppingCart, roles: ['Admin', 'Accountant'] },
    { 
      label: 'المحاسبة', 
      icon: Wallet, 
      roles: ['Admin', 'Accountant', 'Secretary', 'Engineer'],
      hrefPrefix: '/dashboard/accounting',
      children: [
        { href: '/dashboard/accounting/quotations', label: 'عروض الأسعار' },
        { href: '/dashboard/accounting/chart-of-accounts', label: 'شجرة الحسابات' },
        { href: '/dashboard/accounting/assistant', label: 'المساعد الذكي' },
        {
          label: 'قيود وسندات',
          children: [
            { href: '/dashboard/accounting/journal-entries', label: 'قيود اليومية' },
            { href: '/dashboard/accounting/cash-receipts', label: 'سندات القبض' },
            { href: '/dashboard/accounting/payment-vouchers', label: 'سندات الصرف' },
            { href: '/dashboard/accounting/invoices', label: 'الفواتير' },
          ]
        },
        {
          label: 'التقارير المالية',
          children: [
            { href: '/dashboard/accounting/general-ledger', label: 'دفتر الأستاذ العام' },
            { href: '/dashboard/accounting/trial-balance', label: 'ميزان المراجعة' },
            { href: '/dashboard/accounting/client-statements', label: 'كشوفات حسابات العملاء' },
            { href: '/dashboard/accounting/reports', label: 'التقارير التحليلية' },
          ]
        },
        {
          label: 'القوائم المالية',
          children: [
            { href: '/dashboard/accounting/income-statement', label: 'قائمة الدخل' },
            { href: '/dashboard/accounting/balance-sheet', label: 'قائمة المركز المالي' },
            { href: '/dashboard/accounting/cash-flow', label: 'قائمة التدفقات النقدية' },
            { href: '/dashboard/accounting/equity-statement', label: 'قائمة التغير في حقوق الملكية' },
            { href: '/dashboard/accounting/financial-statement-notes', label: 'الإيضاحات المتممة' },
            { href: '/dashboard/accounting/financial-forecast', label: 'التنبؤات المالية' },
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
        { href: '/dashboard/hr/employees', label: 'الموظفين' },
        { href: '/dashboard/hr/leaves', label: 'طلبات الإجازة' },
        { href: '/dashboard/hr/payroll', label: 'كشوف الرواتب والحضور' },
        { href: '/dashboard/hr/reports', label: 'التقارير الشاملة' },
        { href: '/dashboard/hr/gratuity-calculator', label: 'حاسبة نهاية الخدمة' },
      ]
    },
    { href: '/dashboard/warehouse', label: 'المستودع', icon: Warehouse, roles: ['Admin', 'Accountant'] },
    { href: '/dashboard/appointments', label: 'المواعيد', icon: Calendar, roles: ['Admin', 'Engineer', 'Secretary'] },
    { href: '/dashboard/settings', label: 'الإعدادات', icon: Settings, roles: ['Admin'] },
  ],
  en: [
    // ... english translations ...
  ]
};

function NavItem({ item, userRole, currentPath }: { item: any, userRole: string, currentPath: string }) {
  const { setOpenMobile } = useSidebar();

  if (!item.roles.includes(userRole)) {
    return null;
  }

  // This is for top-level, non-collapsible items
  if (!item.children && item.href) {
    return (
      <SidebarMenuItem>
        <Link href={item.href} passHref>
          <SidebarMenuButton isActive={currentPath === item.href} onClick={() => setOpenMobile(false)}>
            <item.icon />
            <span>{item.label}</span>
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
    );
  }
  
  // This is for collapsible items (the menu container)
  if (item.children) {
    const isActive = currentPath.startsWith(item.hrefPrefix);
    return (
      <Collapsible defaultOpen={isActive}>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton isActive={isActive} className="h-8 w-full justify-between">
            <div className='flex items-center gap-2'>
                <item.icon />
                <span>{item.label}</span>
            </div>
            <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.children.map((child: any, index: number) => {
              // This is for sub-groups like "Reports"
              if (child.children) {
                return (
                  <SidebarMenuSubItem key={`${child.label}-${index}`}>
                    <div className="flex items-center justify-between w-full px-2 py-1.5 rounded-md">
                      <span className="text-sm font-semibold text-sidebar-foreground/70">{child.label}</span>
                    </div>
                    <SidebarMenuSub>
                      {child.children.map((subChild: any) => (
                        // This is for the final link inside a sub-group
                        <SidebarMenuSubItem key={subChild.href}>
                          <Link href={subChild.href} passHref>
                            <SidebarMenuSubButton isActive={currentPath === subChild.href} onClick={() => setOpenMobile(false)}>
                              {subChild.label}
                            </SidebarMenuSubButton>
                          </Link>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </SidebarMenuSubItem>
                );
              }
              // This is for a direct link inside the collapsible menu
              return (
                <SidebarMenuSubItem key={child.href}>
                   <Link href={child.href} passHref>
                      <SidebarMenuSubButton isActive={currentPath === child.href} onClick={() => setOpenMobile(false)}>
                        {child.label}
                      </SidebarMenuSubButton>
                  </Link>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  // Fallback for items that are neither links nor have children (shouldn't happen)
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
            <Button variant="ghost" className="h-auto w-full justify-start p-2">
                <Avatar className="h-9 w-9">
                    <AvatarImage src={currentUser.avatarUrl} alt={currentUser.fullName} />
                    <AvatarFallback>{currentUser.fullName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="ml-2 text-right">
                    <p className="text-sm font-medium">{currentUser.fullName}</p>
                    <p className="text-xs text-muted-foreground">{currentUser.email}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto" onClick={onLogout}>
                    <LogOut className="h-4 w-4"/>
                </Button>
            </Button>
        </div>
      </SidebarFooter>
    </>
  );
}
