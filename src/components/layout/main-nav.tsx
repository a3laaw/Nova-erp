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
  Wallet,
  Calculator,
  History,
  Sparkles
} from 'lucide-react';
import { Logo } from './logo';
import { cn } from '@/lib/utils';
import type { AuthenticatedUser } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useBranding } from '@/context/branding-context';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useAppTheme } from '@/context/theme-context';

const navItems = {
  ar: [
    { href: '/dashboard', label: 'لوحة التحكم المركزية', icon: Home, roles: ['Admin', 'Engineer', 'Accountant', 'Secretary', 'HR'] },
    
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
      label: 'المقاولات والقياسات',
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
        { href: '/dashboard/purchasing/reports/price-history', label: 'تاريخ أسعار الأصناف', icon: History },
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
        { href: '/dashboard/warehouse/reports', label: 'تقارير المخزون', icon: PieChart },
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
        { href: '/dashboard/accounting/reconciliation', label: 'التسوية البنكية', icon: Scale },
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
        { href: '/dashboard/hr/gratuity-calculator', label: 'حاسبة نهاية الخدمة', icon: Calculator },
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

function NavItem({ item, userRole, currentPath, isGlass }: { item: any, userRole: string, currentPath: string, isGlass: boolean }) {
  const { setOpenMobile, state } = useSidebar();
  const Icon = item.icon;

  if (item.roles && !item.roles.includes(userRole)) {
    return null;
  }

  const isActive = item.hrefPrefix ? currentPath.startsWith(item.hrefPrefix) : (item.href ? currentPath === item.href : false);

  if (!item.children && item.href) {
    return (
      <SidebarMenuItem className="px-2">
        <SidebarMenuButton 
          isActive={isActive} 
          asChild 
          tooltip={item.label}
          className={cn(
            "my-1",
            isGlass && "glass-nav-button", 
            isGlass && isActive && "glass-nav-button-active"
          )}
        >
          <Link 
            href={item.href} 
            onClick={() => setOpenMobile(false)}
            className="flex items-center gap-3 w-full"
          >
            {Icon && (
              <Icon 
                className={cn(
                  "size-6 shrink-0 transition-colors order-2", 
                  isGlass ? "sidebar-icon-deep" : ""
                )} 
                strokeWidth={isActive ? 3 : 2} 
              />
            )}
            <span className={cn(
              "font-medium transition-colors text-sm order-1 flex-1 text-right",
              isActive && "font-black",
              isGlass && "text-[#1e1b4b]"
            )}>
              {item.label}
            </span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }
  
  if (item.children) {
    if (state === "collapsed") {
      return (
        <SidebarMenuItem className="px-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton 
                isActive={isActive} 
                tooltip={item.label}
                className={cn(
                    "my-1",
                    isGlass && "glass-nav-button", 
                    isGlass && isActive && "glass-nav-button-active"
                )}
              >
                {Icon && (
                  <Icon 
                    className={cn(
                        "size-6 shrink-0 transition-colors", 
                        isGlass ? "sidebar-icon-deep" : ""
                    )} 
                    strokeWidth={isActive ? 3 : 2} 
                  />
                )}
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="left" align="start" dir="rtl" className={cn("w-64 rounded-2xl shadow-2xl p-2", isGlass ? "backdrop-blur-xl bg-white/90 border-white/20" : "bg-card/95 border-primary/10")}>
              <DropdownMenuLabel className="font-black text-[#1e1b4b] px-3 py-2 text-base">{item.label}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {item.children.map((child: any) => {
                const isChildActive = currentPath === child.href;
                const ChildIcon = child.icon;
                return (
                  <DropdownMenuItem key={child.href} asChild className={cn("rounded-xl my-0.5 cursor-pointer", isChildActive && "bg-primary/10 text-[#1e1b4b] font-bold")}>
                    <Link href={child.href} onClick={() => setOpenMobile(false)}>
                      {ChildIcon && <ChildIcon className="size-5 shrink-0 text-[#1e1b4b]" />}
                      <span className="text-sm text-[#1e1b4b]">{child.label}</span>
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
      <Collapsible defaultOpen={isActive} className="group/collapsible px-2">
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton 
              isActive={isActive} 
              tooltip={item.label} 
              className={cn(
                "my-1",
                isGlass && "glass-nav-button", 
                isGlass && isActive && "glass-nav-button-active"
              )}
            >
              {Icon && (
                <Icon 
                  className={cn(
                    "size-6 shrink-0 transition-colors order-2", 
                    isGlass ? "sidebar-icon-deep" : ""
                  )} 
                  strokeWidth={isActive ? 3 : 2} 
                />
              )}
              <span className={cn(
                "font-medium transition-colors text-sm order-1 flex-1 text-right",
                isActive && "font-black",
                isGlass && "text-[#1e1b4b]"
              )}>
                {item.label}
              </span>
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180 opacity-50 group-data-[state=collapsed]:hidden order-0 mr-auto",
                isGlass ? "text-[#1e1b4b]" : "text-primary"
              )} />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub className={cn("mt-1 mb-2", isGlass && "glass-sub-menu border-r-2 border-white/30 mr-4 pr-2")}>
              {item.children.map((child: any) => {
                const isChildActive = currentPath === child.href;
                const ChildIcon = child.icon;
                return (
                  <SidebarMenuSubItem key={child.href}>
                    <SidebarMenuSubButton isActive={isChildActive} asChild className={cn(isGlass ? "glass-sub-button my-0.5 rounded-xl" : "my-0.5 rounded-xl")}>
                      <Link href={child.href} onClick={() => setOpenMobile(false)} className="flex items-center gap-2">
                        {ChildIcon && <ChildIcon className={cn("size-4 shrink-0", isGlass ? "text-[#1e1b4b]" : "")} />}
                        <span className={cn("font-bold text-xs", isGlass && "text-[#1e1b4b]")}>{child.label}</span>
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
  const { theme } = useAppTheme();
  const isGlass = theme === 'glass';
  
  const currentNavItems = navItems[language] || navItems.ar;

  return (
    <>
      <SidebarHeader className="p-6 mb-4">
        <div className="flex items-center gap-3">
            <Logo logoUrl={branding?.logo_url} companyName={branding?.company_name} className={cn("shadow-sm border", isGlass ? "bg-white/40 border-white/40" : "border-slate-100 bg-white")} />
            <div className="flex flex-col group-data-[state=collapsed]:hidden">
              <span className={cn("text-xl font-black tracking-tight leading-tight", isGlass ? "text-[#1e1b4b]" : "text-foreground")}>{branding?.company_name || 'Nova ERP'}</span>
              <span className={cn("text-[9px] font-black uppercase tracking-[0.2em] opacity-70", isGlass ? "text-[#1e1b4b]/60" : "text-primary")}>Purple Suite</span>
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
                isGlass={isGlass}
            />
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-6 mt-4">
        <div className="p-1">
            <div className={cn(
                "flex h-auto w-full items-center justify-start rounded-2xl p-2 transition-all shadow-sm",
                isGlass ? "bg-white/30 border border-white/40 hover:bg-white/50" : "bg-slate-50 border border-slate-100 hover:bg-muted"
            )}>
                <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                    <AvatarImage src={currentUser.avatarUrl} alt={currentUser.fullName} />
                    <AvatarFallback className="bg-white text-primary font-black">{currentUser.fullName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="ml-2 mr-3 flex-grow text-right overflow-hidden group-data-[state=collapsed]:hidden">
                    <p className={cn("text-sm font-black truncate", isGlass ? "text-[#1e1b4b]" : "text-foreground")}>{currentUser.fullName}</p>
                    <p className={cn("text-[9px] truncate font-bold uppercase tracking-wider", isGlass ? "text-[#1e1b4b]/60" : "text-muted-foreground")}>{currentUser.role}</p>
                </div>
            </div>
        </div>
      </SidebarFooter>
    </>
  );
}