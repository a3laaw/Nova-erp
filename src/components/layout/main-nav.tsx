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
} from '@/components/ui/dropdown-menu';
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
  ShoppingCart,
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
        { href: '/dashboard/hr/employees/new', label: 'إضافة موظف جديد' },
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

  if (item.children) {
    const isActive = currentPath.startsWith(item.hrefPrefix);
    return (
      <Collapsible defaultOpen={isActive}>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton isActive={isActive}>
            <item.icon />
            <span>{item.label}</span>
            <ChevronDown className="mr-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
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
                          <Link href={subChild.href} onClick={() => setOpenMobile(false)}>
                            <SidebarMenuSubButton isActive={currentPath === subChild.href}>
                              {subChild.label}
                            </SidebarMenuSubButton>
                          </Link>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </SidebarMenuSubItem>
                );
              }
              return (
                <SidebarMenuSubItem key={child.href}>
                  <Link href={child.href} onClick={() => setOpenMobile(false)}>
                    <SidebarMenuSubButton isActive={currentPath === child.href}>
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

  return (
    <SidebarMenuItem>
      <Link href={item.href} onClick={() => setOpenMobile(false)}>
        <SidebarMenuButton isActive={currentPath === item.href}>
          <item.icon />
          <span>{item.label}</span>
        </SidebarMenuButton>
      </Link>
    </SidebarMenuItem>
  );
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
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                 <Button variant="ghost" className="h-auto w-full justify-start p-2">
                    <Avatar className="h-9 w-9">
                        <AvatarImage src={currentUser.avatarUrl} alt={currentUser.fullName} />
                        <AvatarFallback>{currentUser.fullName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="ml-2 text-right">
                        <p className="text-sm font-medium">{currentUser.fullName}</p>
                        <p className="text-xs text-muted-foreground">{currentUser.email}</p>
                    </div>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 mb-2" align="end" forceMount>
                <DropdownMenuLabel>حسابي</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link href="/dashboard/settings">الإعدادات</Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout}>تسجيل الخروج</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </>
  );
}
