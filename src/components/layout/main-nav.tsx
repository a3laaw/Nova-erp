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
  Search,
  LineChart,
  FileSignature,
  FileText,
  ClipboardList,
  Construction,
  MapPin,
  LayoutGrid,
  ArrowUpFromLine,
  Clock,
  Hourglass,
  HardHat,
  FileCheck,
  Coins,
  DollarSign,
  ShoppingCart,
  SearchCode,
  Truck,
  Landmark,
  Warehouse,
  Building2,
  ArrowLeftRight,
  Ban,
  Package,
  Network,
  BookOpen,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  Scale,
  TrendingUp,
  PieChart,
  Handshake,
  CalendarX,
  Banknote,
  FileBarChart,
  Settings,
  Settings2,
  Building,
  Tags,
  ShieldCheck,
  ChevronDown,
  LogOut,
  UserX,
  ShoppingBag,
  FileStack,
  Wallet
} from 'lucide-react';
import { Logo } from './logo';
import { cn } from '@/lib/utils';
import type { AuthenticatedUser } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useBranding } from '@/context/branding-context';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

const navItems = {
  ar: [
    { href: '/dashboard', label: 'لوحة التحكم العامة', icon: Home, roles: ['Admin', 'Engineer', 'Accountant', 'Secretary', 'HR'] },
    
    { 
      label: 'علاقات العملاء (CRM)', 
      icon: LineChart, 
      roles: ['Admin', 'Engineer', 'Accountant', 'HR', 'Secretary'],
      hrefPrefix: '/dashboard/clients',
      children: [
        { href: '/dashboard/clients?view=registered', label: 'ملفات العملاء', icon: Users },
        { href: '/dashboard/clients?view=prospective', label: 'العملاء المحتملون', icon: Search },
        { href: '/dashboard/reports/prospective-clients', label: 'تحليل المحتملين', icon: UserX },
        { href: '/dashboard/reports/upsell-opportunities', label: 'فرص بيعية إضافية', icon: ShoppingBag },
      ]
    },

    { 
      label: 'المشاريع والتنفيذ',
      icon: Construction,
      roles: ['Admin', 'Engineer', 'Accountant'],
      hrefPrefix: '/dashboard/construction',
      children: [
        { href: '/dashboard/contracts', label: 'عروض الأسعار والعقود', icon: FileSignature },
        { href: '/dashboard/construction/boq', label: 'مكتبة المقايسات (BOQ)', icon: ClipboardList },
        { href: '/dashboard/construction/projects', label: 'المشاريع التنفيذية', icon: Briefcase },
        { href: '/dashboard/construction/field-visits', label: 'الزيارات الميدانية', icon: MapPin },
        { href: '/dashboard/construction/schedules', label: 'الجداول الزمنية', icon: LayoutGrid },
        { href: '/dashboard/warehouse/material-issue', label: 'صرف مواد المواقع', icon: ArrowUpFromLine },
        { href: '/dashboard/reports/delayed-stages', label: 'المهام المتأخرة', icon: Clock },
        { href: '/dashboard/reports/stalled-stages', label: 'المراحل الخاملة', icon: Hourglass },
      ]
    },

    { 
      label: 'مقاولين الباطن',
      icon: HardHat,
      roles: ['Admin', 'Engineer', 'Accountant'],
      hrefPrefix: '/dashboard/construction/subcontractors',
      children: [
        { href: '/dashboard/construction/subcontractors', label: 'سجل المقاولين', icon: Users },
        { href: '/dashboard/construction/subcontractors/certificates', label: 'شهادات إنجاز الأعمال', icon: FileCheck },
      ]
    },

    { 
      label: 'المطالبات المالية',
      icon: Coins,
      roles: ['Admin', 'Accountant'],
      hrefPrefix: '/dashboard/construction/payment-applications',
      children: [
        { href: '/dashboard/construction/payment-applications/new', label: 'إصدار مستخلص أعمال', icon: Coins },
        { href: '/dashboard/accounting/client-statements', label: 'مديونيات العملاء', icon: DollarSign },
      ]
    },

    { 
      label: 'إدارة المشتريات',
      icon: ShoppingCart,
      roles: ['Admin', 'Accountant', 'Engineer'],
      hrefPrefix: '/dashboard/purchasing',
      children: [
        { href: '/dashboard/purchasing/direct-invoice', label: 'فاتورة مشتريات مباشرة', icon: ShoppingBag },
        { href: '/dashboard/purchasing/requests', label: 'طلب شراء داخلي (PR)', icon: FileStack },
        { href: '/dashboard/purchasing/rfqs', label: 'طلبات التسعير (RFQ)', icon: SearchCode },
        { href: '/dashboard/purchasing/purchase-orders', label: 'أوامر الشراء المؤكدة', icon: ShoppingCart },
        { href: '/dashboard/purchasing/vendors', label: 'سجل الموردين', icon: Truck },
        { href: '/dashboard/purchasing/lc', label: 'اعتمادات مستندية', icon: Landmark },
      ]
    },

    { 
      label: 'المخازن والمستودعات',
      icon: Warehouse,
      roles: ['Admin', 'Accountant', 'Engineer'],
      hrefPrefix: '/dashboard/warehouse',
      children: [
        { href: '/dashboard/warehouse/grns', label: 'أذونات استلام البضاعة', icon: FileCheck },
        { href: '/dashboard/warehouse/items', label: 'دليل الأصناف والخدمات', icon: Package },
        { href: '/dashboard/warehouse/warehouses', label: 'المستودعات والأفرع', icon: Building2 },
        { href: '/dashboard/warehouse/transfers', label: 'تحويلات بين المخازن', icon: ArrowLeftRight },
        { href: '/dashboard/warehouse/adjustments', label: 'تسويات العجز والتلف', icon: Ban },
        { href: '/dashboard/warehouse/reports/balances', label: 'تقرير أرصدة الأصناف', icon: Package },
      ]
    },

    { 
      label: 'المحاسبة والمالية', 
      icon: Wallet, 
      roles: ['Admin', 'Accountant'],
      hrefPrefix: '/dashboard/accounting',
      children: [
        { href: '/dashboard/accounting/chart-of-accounts', label: 'شجرة الحسابات', icon: Network },
        { href: '/dashboard/accounting/journal-entries', label: 'قيود اليومية العامة', icon: BookOpen },
        { href: '/dashboard/accounting/cash-receipts', label: 'سندات القبض', icon: ArrowDownLeft },
        { href: '/dashboard/accounting/payment-vouchers', label: 'سندات الصرف', icon: ArrowUpRight },
        { href: '/dashboard/accounting/recurring', label: 'أتمتة الالتزامات الدورية', icon: CalendarClock },
        { href: '/dashboard/accounting/reconciliation', label: 'التسويات البنكية', icon: Scale },
        { href: '/dashboard/accounting/income-statement', label: 'قائمة الدخل (P&L)', icon: TrendingUp },
        { href: '/dashboard/accounting/balance-sheet', label: 'قائمة المركز المالي', icon: Landmark },
        { href: '/dashboard/accounting/reports', label: 'التقارير التحليلية', icon: PieChart },
      ]
    },

    { 
      label: 'شؤون الموظفين (HR)', 
      icon: Handshake, 
      roles: ['Admin', 'HR'],
      hrefPrefix: '/dashboard/hr',
      children: [
        { href: '/dashboard/hr/employees', label: 'ملفات الموظفين', icon: Users },
        { href: '/dashboard/hr/leaves', label: 'طلبات الإجازات', icon: CalendarX },
        { href: '/dashboard/hr/permissions', label: 'طلبات الاستئذانات', icon: Clock },
        { href: '/dashboard/hr/payroll', label: 'مسيرات الرواتب', icon: Banknote },
        { href: '/dashboard/hr/reports', label: 'لوحة تقارير الموارد', icon: FileBarChart },
      ]
    },

    { 
      label: 'الإعدادات', 
      icon: Settings, 
      roles: ['Admin'],
      hrefPrefix: '/dashboard/settings',
      children: [
        { href: '/dashboard/settings', label: 'الإعدادات العامة', icon: Settings2 },
        { href: '/dashboard/settings/companies', label: 'إدارة الشركات', icon: Building },
        { href: '/dashboard/settings/classifications', label: 'الفئات والتصنيفات', icon: Tags },
        { href: '/dashboard/settings/reference-data', label: 'البيانات المرجعية', icon: Network },
        { href: '/dashboard/settings/data-integrity', label: 'سلامة البيانات', icon: ShieldCheck },
      ]
    },
  ],
  en: [
    { href: '/dashboard', label: 'Dashboard', icon: Home, roles: ['Admin', 'Engineer', 'Accountant', 'Secretary', 'HR'] },
  ]
};

function NavItem({ item, userRole, currentPath }: { item: any, userRole: string, currentPath: string }) {
  const { setOpenMobile, state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const Icon = item.icon;

  if (item.roles && !item.roles.includes(userRole)) {
    return null;
  }

  const isActive = item.hrefPrefix ? currentPath.startsWith(item.hrefPrefix) : (item.href ? currentPath === item.href : false);

  if (!item.children && item.href) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton isActive={isActive} asChild tooltip={item.label}>
          <Link href={item.href} onClick={() => setOpenMobile(false)}>
            {Icon && (
              <Icon 
                className={cn(
                  "size-8 shrink-0 transition-colors", 
                  isActive ? "text-[#6d28d9]" : "text-[#374151] group-hover:text-[#6d28d9]"
                )} 
                strokeWidth={isActive ? 2.5 : 2} 
              />
            )}
            <span className={cn(
              "font-medium transition-colors text-base",
              isActive ? "text-[#6d28d9] font-bold" : "text-gray-900"
            )}>
              {item.label}
            </span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }
  
  if (item.children) {
    if (isCollapsed) {
      return (
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton isActive={isActive} tooltip={item.label}>
                {Icon && (
                  <Icon 
                    className={cn(
                      "size-8 shrink-0 transition-colors", 
                      isActive ? "text-[#6d28d9]" : "text-[#374151] group-hover:text-[#6d28d9]"
                    )} 
                    strokeWidth={isActive ? 2.5 : 2} 
                  />
                )}
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="left" align="start" dir="rtl" className="w-64 rounded-2xl shadow-2xl border-primary/10 bg-card/95 backdrop-blur-md p-2">
              <DropdownMenuLabel className="font-black text-primary px-3 py-2 text-base">{item.label}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {item.children.map((child: any) => {
                const isChildActive = currentPath === child.href;
                const ChildIcon = child.icon;
                return (
                  <DropdownMenuItem key={child.href} asChild className={cn("rounded-xl my-0.5 cursor-pointer", isChildActive && "bg-primary/5 text-primary font-bold")}>
                    <Link href={child.href} className="flex items-center gap-3 w-full py-2.5 px-3">
                      {ChildIcon && <ChildIcon className="size-5 shrink-0" />}
                      <span className="text-sm">{child.label}</span>
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      );
    }

    return (
      <Collapsible defaultOpen={isActive} className="group/collapsible">
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton isActive={isActive} tooltip={item.label}>
              {Icon && (
                <Icon 
                  className={cn(
                    "size-8 shrink-0 transition-colors", 
                    isActive ? "text-[#6d28d9]" : "text-[#374151] group-hover:text-[#6d28d9]"
                  )} 
                  strokeWidth={isActive ? 2.5 : 2} 
                />
              )}
              <span className={cn(
                "font-medium transition-colors text-base",
                isActive ? "text-[#6d28d9] font-bold" : "text-gray-900 group-hover:text-[#6d28d9]"
              )}>
                {item.label}
              </span>
              <ChevronDown className={cn(
                "ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180 opacity-50 group-data-[state=collapsed]:hidden",
                isActive ? "text-[#6d28d9]" : "text-[#374151]"
              )} />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {item.children.map((child: any) => {
                const isChildActive = currentPath === child.href;
                const ChildIcon = child.icon;
                return (
                  <SidebarMenuSubItem key={child.href}>
                    <SidebarMenuSubButton isActive={isChildActive} asChild>
                      <Link href={child.href} onClick={() => setOpenMobile(false)}>
                        {ChildIcon && <ChildIcon className="size-4 shrink-0" />}
                        <span>{child.label}</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                );
              })}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  }

  return null;
}

export function MainNav({ currentUser }: { currentUser: AuthenticatedUser, onLogout: () => void }) {
  const pathname = usePathname();
  const { language } = useLanguage();
  const { branding } = useBranding();
  
  const currentNavItems = navItems[language] || navItems.ar;

  return (
    <>
      <SidebarHeader className="p-6 mb-2">
        <div className="flex items-center gap-3">
            <Logo logoUrl={branding?.logo_url} companyName={branding?.company_name} className="shadow-sm border border-slate-100 bg-white" />
            <div className="flex flex-col group-data-[state=collapsed]:hidden">
              <span className="text-xl font-black tracking-tight text-foreground leading-tight">{branding?.company_name || 'Nova ERP'}</span>
              <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em] opacity-70">Purple Suite</span>
            </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-4">
        <SidebarMenu className="gap-1.5">
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
      <SidebarFooter className="p-6 border-t border-slate-50">
        <div className="p-1">
            <div className="flex h-auto w-full items-center justify-start rounded-2xl p-2 bg-slate-50 border border-slate-100 group hover:bg-muted transition-all">
                <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                    <AvatarImage src={currentUser.avatarUrl} alt={currentUser.fullName} />
                    <AvatarFallback className="bg-white text-primary font-black">{currentUser.fullName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="ml-2 mr-3 flex-grow text-right overflow-hidden group-data-[state=collapsed]:hidden">
                    <p className="text-sm font-black text-foreground truncate">{currentUser.fullName}</p>
                    <p className="text-[9px] text-muted-foreground truncate font-bold uppercase tracking-wider">{currentUser.role}</p>
                </div>
            </div>
        </div>
      </SidebarFooter>
    </>
  );
}
