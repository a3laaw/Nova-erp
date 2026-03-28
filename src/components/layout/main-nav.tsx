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
  Tags,
  ShieldCheck,
  ChevronDown,
  UserX,
  ShoppingBag,
  FileStack,
  Wallet,
  Calculator,
  RotateCcw,
  ListTree
} from 'lucide-react';
import { Logo } from './logo';
import { cn } from '@/lib/utils';
import type { AuthenticatedUser } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useBranding } from '@/context/branding-context';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

const navItems = {
  ar: [
    { href: '/dashboard', label: 'لوحة التحكم المركزية', icon: Home, roles: ['Developer', 'Admin', 'Engineer', 'Accountant', 'Secretary', 'HR'] },
    
    { 
      label: 'علاقات العملاء (CRM)', 
      icon: LineChart, 
      roles: ['Developer', 'Admin', 'Engineer', 'Accountant', 'HR', 'Secretary'],
      hrefPrefix: '/dashboard/clients',
      children: [
        { href: '/dashboard/clients?view=registered', label: 'ملفات العملاء', icon: Users },
        { href: '/dashboard/clients?view=prospective', label: 'العملاء المحتملون', icon: Search },
        { href: '/dashboard/reports/prospective-clients', label: 'تحليل المحتملين', icon: UserX },
        { href: '/dashboard/reports/upsell-opportunities', label: 'فرص بيعية إضافية', icon: ShoppingBag },
      ]
    },

    { 
      label: 'المقاولات والقياسات',
      icon: Construction,
      roles: ['Developer', 'Admin', 'Engineer', 'Accountant'],
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
      roles: ['Developer', 'Admin', 'Engineer', 'Accountant'],
      hrefPrefix: '/dashboard/construction/subcontractors',
      children: [
        { href: '/dashboard/construction/subcontractors', label: 'سجل المقاولين', icon: Users },
        { href: '/dashboard/construction/subcontractors/certificates', label: 'شهادات إنجاز الأعمال', icon: FileCheck },
      ]
    },

    { 
      label: 'المطالبات المالية',
      icon: Coins,
      roles: ['Developer', 'Admin', 'Accountant'],
      hrefPrefix: '/dashboard/construction/payment-applications',
      children: [
        { href: '/dashboard/construction/payment-applications/new', label: 'إصدار مستخلص أعمال', icon: Coins },
        { href: '/dashboard/accounting/client-statements', label: 'مديونيات العملاء', icon: DollarSign },
      ]
    },

    { 
      label: 'إدارة المشتريات',
      icon: ShoppingCart,
      roles: ['Developer', 'Admin', 'Accountant', 'Engineer'],
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
      roles: ['Developer', 'Admin', 'Accountant', 'Engineer'],
      hrefPrefix: '/dashboard/warehouse',
      children: [
        { href: '/dashboard/warehouse/grns', label: 'أذونات استلام البضاعة', icon: FileCheck },
        { href: '/dashboard/warehouse/items', label: 'دليل الأصناف والخدمات', icon: Package },
        { href: '/dashboard/warehouse/warehouses', label: 'المستودعات والأفرع', icon: Building2 },
        { href: '/dashboard/warehouse/transfers', label: 'تحويلات بين المخازن', icon: ArrowLeftRight },
        { href: '/dashboard/warehouse/adjustments', label: 'تسويات العجز والتلف', icon: Ban },
        { href: '/dashboard/warehouse/reports', label: 'تقارير المخزون', icon: PieChart },
      ]
    },

    { 
      label: 'المحاسبة والمالية', 
      icon: Wallet, 
      roles: ['Developer', 'Admin', 'Accountant'],
      hrefPrefix: '/dashboard/accounting',
      children: [
        { href: '/dashboard/accounting/chart-of-accounts', label: 'شجرة الحسابات', icon: Network },
        { href: '/dashboard/accounting/general-ledger', label: 'دفتر الأستاذ (كشوف الحسابات)', icon: ListTree },
        { href: '/dashboard/accounting/cost-center-ledger', label: 'كشف حركة مراكز التكلفة', icon: PieChart },
        { href: '/dashboard/accounting/journal-entries', label: 'قيود اليومية العامة', icon: BookOpen },
        { href: '/dashboard/accounting/cash-receipts', label: 'سندات القبض', icon: ArrowDownLeft },
        { href: '/dashboard/accounting/payment-vouchers', label: 'سندات الصرف', icon: ArrowUpRight },
        { href: '/dashboard/hr/custody-reconciliation', label: 'تسوية العهد النقدية', icon: RotateCcw },
        { href: '/dashboard/accounting/recurring', label: 'أتمتة الالتزامات الدورية', icon: CalendarClock },
        { href: '/dashboard/accounting/reconciliation', label: 'التسوية البنكية', icon: Scale },
        { href: '/dashboard/accounting/income-statement', label: 'قائمة الدخل (P&L)', icon: TrendingUp },
        { href: '/dashboard/accounting/balance-sheet', label: 'قائمة المركز المالي', icon: Landmark },
        { href: '/dashboard/accounting/reports', label: 'التقارير التحليلية', icon: PieChart },
      ]
    },

    { 
      label: 'الموارد البشرية', 
      icon: Handshake, 
      roles: ['Developer', 'Admin', 'HR'],
      hrefPrefix: '/dashboard/hr',
      children: [
        { href: '/dashboard/hr/employees', label: 'ملفات الموظفين', icon: Users },
        { href: '/dashboard/hr/custody-reconciliation/new', label: 'تسوية عهدة نقدية', icon: RotateCcw },
        { href: '/dashboard/hr/leaves', label: 'طلبات الإجازات', icon: CalendarX },
        { href: '/dashboard/hr/permissions', label: 'طلبات الاستئذانات', icon: Clock },
        { href: '/dashboard/hr/payroll', label: 'مسيرات الرواتب', icon: Banknote },
        { href: '/dashboard/hr/gratuity-calculator', label: 'حاسبة نهاية الخدمة', icon: Calculator },
        { href: '/dashboard/hr/reports', label: 'لوحة تقارير الموارد', icon: FileBarChart },
      ]
    },

    { 
      label: 'الإعدادات', 
      icon: Settings, 
      roles: ['Developer', 'Admin'],
      hrefPrefix: '/dashboard/settings',
      children: [
        { href: '/dashboard/settings', label: 'الإعدادات العامة', icon: Settings2 },
        { href: '/dashboard/settings/users', label: 'إدارة المستخدمين', icon: Users },
        { href: '/dashboard/settings/classifications', label: 'الفئات والتصنيفات', icon: Tags },
        { href: '/dashboard/settings/reference-data', label: 'البيانات المرجعية', icon: Network },
        { href: '/dashboard/settings/data-integrity', label: 'سلامة البيانات', icon: ShieldCheck },
      ]
    },
  ],
  en: [
    { href: '/dashboard', label: 'Dashboard', icon: Home, roles: ['Developer', 'Admin', 'Engineer', 'Accountant', 'Secretary', 'HR'] },
  ]
};

function NavItem({ item, userRole, currentPath }: { item: any, userRole: string, currentPath: string }) {
  const { setOpenMobile, state } = useSidebar();
  const Icon = item.icon;

  if (item.roles && !item.roles.includes(userRole)) {
    return null;
  }

  const isActive = item.hrefPrefix ? currentPath.startsWith(item.hrefPrefix) : (item.href ? currentPath === item.href : false);

  if (!item.children && item.href) {
    return (
      <SidebarMenuItem className="px-3">
        <SidebarMenuButton 
          isActive={isActive} 
          asChild 
          tooltip={item.label}
          className={cn(
            "my-1 rounded-2xl font-black transition-all duration-500 inner-glow-border",
            isActive 
              ? "bg-gradient-to-r from-[#7209B7] to-purple-500/20 text-white shadow-xl active-glow scale-[1.02]" 
              : "hover:bg-white/30 text-[#1e1b4b]"
          )}
        >
          <Link 
            href={item.href} 
            onClick={() => setOpenMobile(false)}
            className="flex items-center gap-3 w-full"
          >
            {Icon && (
              <Icon 
                className={cn("size-5 shrink-0", isActive ? "text-white" : "text-[#7209B7]")} 
                strokeWidth={3} 
              />
            )}
            <span className="truncate text-sm flex-1">{item.label}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }
  
  if (item.children) {
    if (state === "collapsed") {
      return (
        <SidebarMenuItem className="px-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton 
                isActive={isActive} 
                tooltip={item.label}
                className={cn(
                    "my-1 rounded-2xl transition-all duration-500 inner-glow-border",
                    isActive ? "bg-[#7209B7] text-white shadow-xl active-glow" : "hover:bg-white/30 text-[#1e1b4b]"
                )}
              >
                {Icon && <Icon className={cn("size-5 shrink-0", isActive ? "text-white" : "text-[#7209B7]")} strokeWidth={3} />}
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="left" align="start" dir="rtl" className="w-64 rounded-[2rem] shadow-2xl p-2 bg-white/90 backdrop-blur-3xl border-white/40">
              <DropdownMenuLabel className="font-black text-[#1e1b4b] px-4 py-3 text-base">{item.label}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {item.children.map((child: any) => {
                const isChildActive = currentPath === child.href;
                const ChildIcon = child.icon;
                return (
                  <DropdownMenuItem key={child.href} asChild className={cn("rounded-xl my-1 cursor-pointer py-3", isChildActive && "bg-primary/10 text-[#7209B7] font-black")}>
                    <Link href={child.href} onClick={() => setOpenMobile(false)}>
                      {ChildIcon && <ChildIcon className="size-4 shrink-0 text-[#7209B7]" />}
                      <span className="text-sm mr-2">{child.label}</span>
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
      <Collapsible defaultOpen={isActive} className="group/collapsible px-3">
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton 
              isActive={isActive} 
              tooltip={item.label} 
              className={cn(
                "my-1 rounded-2xl font-black transition-all duration-500 inner-glow-border",
                isActive 
                  ? "bg-gradient-to-r from-[#7209B7] to-purple-500/10 text-white shadow-xl active-glow" 
                  : "hover:bg-white/30 text-[#1e1b4b]"
              )}
            >
              {Icon && <Icon className={cn("size-5 shrink-0", isActive ? "text-white" : "text-[#7209B7]")} strokeWidth={3} />}
              <span className="truncate text-sm flex-1">{item.label}</span>
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180 opacity-50",
                isActive ? "text-white" : "text-[#1e1b4b]"
              )} />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub className="mt-1 mb-2 pr-4 border-r-2 border-primary/10 bg-transparent">
              {item.children.map((child: any) => {
                const isChildActive = currentPath === child.href;
                const ChildIcon = child.icon;
                return (
                  <SidebarMenuSubItem key={child.href}>
                    <SidebarMenuSubButton isActive={isChildActive} asChild className={cn(
                        "rounded-xl my-1 transition-all duration-300 font-bold bg-transparent",
                        isChildActive ? "bg-white/60 text-[#7209B7] font-black shadow-sm" : "hover:bg-white/40 text-[#1e1b4b]/80"
                    )}>
                      <Link href={child.href} onClick={() => setOpenMobile(false)} className="flex items-center gap-2">
                        {ChildIcon && <ChildIcon className="size-4 shrink-0 text-[#7209B7]" />}
                        <span className="text-xs truncate">{child.label}</span>
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
      <SidebarHeader className="p-8 mb-4">
        <div className="flex items-center gap-4">
            <Logo logoUrl={branding?.logo_url} companyName={branding?.company_name} className="shadow-2xl border-2 border-white bg-white/80 rounded-2xl p-2 h-14 w-14" />
            <div className="flex flex-col group-data-[state=collapsed]:hidden">
              <span className="text-xl font-black tracking-tight leading-tight text-[#1e1b4b]">{branding?.company_name || 'Nova ERP'}</span>
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[#7209B7] opacity-70">Sovereign Suite</span>
            </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2">
        <SidebarMenu className="gap-1">
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
      <SidebarFooter className="p-8 mt-4">
        <div className="p-1">
            <div className="flex h-auto w-full items-center justify-start rounded-[2rem] p-4 transition-all shadow-2xl bg-white/40 border border-white/60 backdrop-blur-3xl hover:bg-white/60">
                <Avatar className="h-12 w-12 border-2 border-[#7209B7]/20 shadow-inner">
                    <AvatarImage src={currentUser.avatarUrl} alt={currentUser.fullName} />
                    <AvatarFallback className="bg-primary/5 text-primary font-black">{currentUser.fullName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="ml-2 mr-4 flex-grow text-right overflow-hidden group-data-[state=collapsed]:hidden">
                    <p className="text-sm font-black truncate text-[#1e1b4b]">{currentUser.fullName}</p>
                    <p className="text-[10px] truncate font-black uppercase tracking-widest text-[#7209B7] opacity-70">{currentUser.role}</p>
                </div>
            </div>
        </div>
      </SidebarFooter>
    </>
  );
}