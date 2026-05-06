'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton as BaseSidebarMenuButton,
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
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import {
  LayoutGrid,
  UsersRound,
  Search,
  UserCheck,
  Sparkles,
  PencilRuler,
  FileSignature,
  ClipboardList,
  Briefcase,
  MapPin,
  Clock3,
  Package,
  History,
  AlertTriangle,
  HardHat,
  FileCheck,
  Coins,
  ArrowDownLeft,
  ShoppingBag,
  CheckCircle2,
  Landmark,
  Box,
  Building2,
  RotateCcw,
  Ban,
  ListTree,
  BookOpen,
  Target,
  FileText,
  ArrowUpRight,
  Wallet,
  Scale,
  FileBarChart,
  BarChart3,
  Users,
  CalendarCheck,
  Calculator,
  Settings2,
  Globe,
  ShieldCheck,
  Tags,
  DatabaseZap,
  ChevronLeft,
  CalendarDays,
  Home,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AuthenticatedUser } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { ScrollArea } from '../ui/scroll-area';

const navItems = {
  ar: [
    // 1. لوحة التحكم المركزية
    { 
      href: '/dashboard', 
      label: 'لوحة التحكم المركزية', 
      icon: LayoutGrid, 
      roles: ['Developer', 'Admin', 'Engineer', 'Accountant', 'Secretary', 'HR'] 
    },
    
    // 2. علاقات العملاء (CRM)
    { 
      label: 'علاقات العملاء (CRM)', 
      icon: UsersRound, 
      roles: ['Developer', 'Admin', 'Engineer', 'Accountant', 'HR', 'Secretary'],
      hrefPrefix: '/dashboard/clients',
      children: [
        { href: '/dashboard/clients?view=registered', label: 'ملفات العملاء', icon: UsersRound },
        { href: '/dashboard/clients?view=prospective', label: 'العملاء المحتملون', icon: Search },
        { href: '/dashboard/reports/prospective-clients', label: 'تحليل المحتملين', icon: UserCheck },
        { href: '/dashboard/reports/upsell-opportunities', label: 'فرص بيعية إضافية', icon: Sparkles },
      ]
    },

    // 3. حجز المواعيد والتقويم (تمت الاستعادة)
    { 
      label: 'حجز المواعيد والتقويم',
      icon: CalendarDays,
      roles: ['Developer', 'Admin', 'Engineer', 'Secretary'],
      hrefPrefix: '/dashboard/appointments',
      children: [
        { href: '/dashboard/appointments', label: 'التقويم العام للمكتب', icon: CalendarDays },
        { href: '/dashboard/appointments/new', label: 'حجز موعد معماري', icon: MapPin },
        { href: '/dashboard/appointments/new-other', label: 'حجز قاعة اجتماعات', icon: Home },
      ]
    },

    // 4. المقاولات والقياسات
    { 
      label: 'المقاولات والقياسات',
      icon: PencilRuler,
      roles: ['Developer', 'Admin', 'Engineer', 'Accountant'],
      hrefPrefix: '/dashboard/construction',
      children: [
        { href: '/dashboard/contracts', label: 'عروض الأسعار والعقود', icon: FileSignature },
        { href: '/dashboard/construction/boq', label: 'مكتبة المقايسات (BOQ)', icon: ClipboardList },
        { href: '/dashboard/construction/projects', label: 'المشاريع التنفيذية', icon: Briefcase },
        { href: '/dashboard/construction/field-visits', label: 'الزيارات الميدانية', icon: MapPin },
        { href: '/dashboard/construction/schedules', label: 'الجداول الزمنية', icon: Clock3 },
        { href: '/dashboard/warehouse/material-issue', label: 'صرف مواد المواقع', icon: Package },
        { href: '/dashboard/reports/delayed-stages', label: 'المهام المتأخرة', icon: History },
        { href: '/dashboard/reports/stalled-stages', label: 'المراحل الخاملة', icon: AlertTriangle },
      ]
    },

    // 5. مقاولين الباطن
    { 
      label: 'مقاولين الباطن', 
      icon: HardHat, 
      roles: ['Developer', 'Admin', 'Accountant', 'Engineer'],
      hrefPrefix: '/dashboard/construction/subcontractors',
      children: [
        { href: '/dashboard/construction/subcontractors', label: 'سجل المقاولين', icon: UsersRound },
        { href: '/dashboard/construction/subcontractors/certificates', label: 'شهادات إنجاز الأعمال', icon: FileCheck },
      ]
    },

    // 6. المحاسبة (سابقاً المطالبات المالية)
    { 
      label: 'المحاسبة', 
      icon: Coins, 
      roles: ['Developer', 'Admin', 'Accountant'],
      hrefPrefix: '/dashboard/accounting/invoices',
      children: [
        { href: '/dashboard/construction/payment-applications/new', label: 'إصدار مستخلص أعمال', icon: FileSignature },
        { href: '/dashboard/accounting/client-statements', label: 'مديونيات العملاء', icon: ArrowDownLeft },
      ]
    },

    // 7. إدارة المشتريات
    { 
      label: 'إدارة المشتريات', 
      icon: ShoppingBag, 
      roles: ['Developer', 'Admin', 'Accountant', 'Purchasing'],
      hrefPrefix: '/dashboard/purchasing',
      children: [
        { href: '/dashboard/purchasing/direct-invoice', label: 'فاتورة مشتريات مباشرة', icon: ShoppingBag },
        { href: '/dashboard/purchasing/requests', label: 'طلب شراء داخلي (PR)', icon: FileSignature },
        { href: '/dashboard/purchasing/rfqs', label: 'طلبات التسعير (RFQ)', icon: Search },
        { href: '/dashboard/purchasing/purchase-orders', label: 'أوامر الشراء المؤكدة', icon: CheckCircle2 },
        { href: '/dashboard/purchasing/reports/price-history', label: 'تاريخ أسعار الأصناف', icon: History },
        { href: '/dashboard/purchasing/vendors', label: 'سجل الموردين', icon: UsersRound },
        { href: '/dashboard/purchasing/lc', label: 'اعتمادات مستندية', icon: Landmark },
      ]
    },

    // 8. المخازن والمستودعات
    { 
      label: 'المخازن والمستودعات', 
      icon: Box, 
      roles: ['Developer', 'Admin', 'Accountant', 'Warehouse'],
      hrefPrefix: '/dashboard/warehouse',
      children: [
        { href: '/dashboard/warehouse/grns', label: 'أذونات استلام البضاعة', icon: FileCheck },
        { href: '/dashboard/warehouse/items', label: 'دليل الأصناف والخدمات', icon: Box },
        { href: '/dashboard/warehouse/warehouses', label: 'المستودعات والأفرع', icon: Building2 },
        { href: '/dashboard/warehouse/transfers', label: 'تحويلات بين المخازن', icon: RotateCcw },
        { href: '/dashboard/warehouse/adjustments', label: 'تسويات العجز والتلف', icon: Ban },
        { href: '/dashboard/warehouse/reports', label: 'تقارير المخزون', icon: ListTree },
      ]
    },

    // 9. المحاسبة والمالية (العميقة)
    { 
      label: 'المحاسبة والمالية', 
      icon: Landmark, 
      roles: ['Developer', 'Admin', 'Accountant'],
      hrefPrefix: '/dashboard/accounting',
      children: [
        { href: '/dashboard/accounting/chart-of-accounts', label: 'شجرة الحسابات', icon: ListTree },
        { href: '/dashboard/accounting/general-ledger', label: 'دفتر الأستاذ العام', icon: BookOpen },
        { href: '/dashboard/accounting/cost-center-ledger', label: 'كشف حركة مراكز التكلفة', icon: Target },
        { href: '/dashboard/accounting/journal-entries', label: 'قيود اليومية العامة', icon: FileText },
        { href: '/dashboard/accounting/cash-receipts', label: 'سندات القبض', icon: ArrowDownLeft },
        { href: '/dashboard/accounting/payment-vouchers', label: 'سندات الصرف', icon: ArrowUpRight },
        { href: '/dashboard/hr/custody-reconciliation', label: 'تسوية العهد النقدية', icon: Wallet },
        { href: '/dashboard/accounting/recurring', label: 'أتمتة الالتزامات الدورية', icon: RotateCcw },
        { href: '/dashboard/accounting/reconciliation', label: 'التسوية البنكية', icon: Scale },
        { href: '/dashboard/accounting/income-statement', label: 'قائمة الدخل (P&L)', icon: FileBarChart },
        { href: '/dashboard/accounting/balance-sheet', label: 'قائمة المركز المالي', icon: Landmark },
        { href: '/dashboard/accounting/reports', label: 'التقارير التحليلية', icon: BarChart3 },
      ]
    },

    // 10. شؤون الموظفين (HR)
    { 
      label: 'شؤون الموظفين (HR)', 
      icon: Users, 
      roles: ['Developer', 'Admin', 'HR'],
      hrefPrefix: '/dashboard/hr',
      children: [
        { href: '/dashboard/hr/employees', label: 'ملفات الموظفين', icon: Users },
        { href: '/dashboard/hr/custody-reconciliation/new', label: 'تقديم تسوية عهدة', icon: Wallet },
        { href: '/dashboard/hr/leaves', label: 'طلبات الإجازات', icon: CalendarCheck },
        { href: '/dashboard/hr/permissions', label: 'طلبات الاستئذانات', icon: Clock3 },
        { href: '/dashboard/hr/payroll', label: 'مسيرات الرواتب', icon: Landmark },
        { href: '/dashboard/hr/gratuity-calculator', label: 'حاسبة نهاية الخدمة', icon: Calculator },
        { href: '/dashboard/hr/reports', label: 'لوحة تقارير الموارد', icon: FileBarChart },
      ]
    },

    // 11. الإعدادات
    { 
      label: 'الإعدادات', 
      icon: Settings2, 
      roles: ['Developer', 'Admin'],
      hrefPrefix: '/dashboard/settings',
      children: [
        { href: '/dashboard/settings/branding', label: 'الإعدادات العامة', icon: Globe },
        { href: '/dashboard/settings/users', label: 'إدارة المستخدمين', icon: UserCheck },
        { href: '/dashboard/settings/roles', label: 'الأدوار والصلاحيات', icon: ShieldCheck },
        { href: '/dashboard/settings/companies', label: 'إدارة الشركات', icon: Building2 },
        { href: '/dashboard/settings/classifications', label: 'الفئات والتصنيفات', icon: Tags },
        { href: '/dashboard/settings/reference-data', label: 'البيانات المرجعية', icon: ListTree },
        { href: '/dashboard/settings/data-integrity', label: 'سلامة البيانات', icon: DatabaseZap },
      ]
    },
  ],
  en: [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutGrid, roles: ['Developer', 'Admin', 'Engineer', 'Accountant', 'Secretary', 'HR'] },
  ]
};

function SidebarMenuButton({ isActive, tooltip, children, asChild, className, ...props }: any) {
  const { state, isMobile } = useSidebar();
  const button = (
    <BaseSidebarMenuButton
      isActive={isActive}
      className={cn(
        "my-2 h-12 rounded-full transition-all duration-500 flex items-center w-full px-4",
        "group-data-[collapsible=icon]:!size-14 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:!rounded-full",
        isActive ? "nav-capsule-active" : "nav-capsule",
        className
      )}
      asChild={asChild}
      {...props}
    >
      {children}
    </BaseSidebarMenuButton>
  );
  if (state === "collapsed" && !isMobile && tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="left" align="center" className="font-black bg-[#1e1b4b] text-white border-none rounded-lg shadow-xl">{tooltip}</TooltipContent>
      </Tooltip>
    );
  }
  return button;
}

function NavItem({ item, userRole, currentPath }: { item: any, userRole: string, currentPath: string }) {
  const { setOpenMobile, state } = useSidebar();
  const Icon = item.icon;
  if (item.roles && !item.roles.includes(userRole)) return null;
  const isActive = item.hrefPrefix ? currentPath.startsWith(item.hrefPrefix) : (item.href ? currentPath === item.href : false);

  if (!item.children && item.href) {
    return (
      <SidebarMenuItem className="px-4 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
        <SidebarMenuButton isActive={isActive} tooltip={item.label} asChild>
          <Link href={item.href} onClick={() => setOpenMobile(false)} className="flex items-center justify-between w-full">
            <div className="w-4 h-4 invisible group-data-[collapsible=icon]:hidden" />
            <span className="flex-1 text-right truncate text-sm font-black group-data-[collapsible=icon]:hidden text-[#1e1b4b]">
                {item.label}
            </span>
            {Icon && <Icon className={cn("size-5 shrink-0 ml-3 group-data-[collapsible=icon]:ml-0 text-[#1e1b4b]", isActive ? "opacity-100" : "opacity-60")} />}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }
  
  if (item.children) {
    if (state === 'collapsed') {
      return (
        <SidebarMenuItem className="px-4 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
          <DropdownMenu>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <BaseSidebarMenuButton 
                      isActive={isActive} 
                      className={cn(
                        "my-2 size-14 rounded-full flex items-center justify-center p-0 transition-all duration-500 group-data-[collapsible=icon]:mx-auto",
                        isActive ? "nav-capsule-active" : "nav-capsule"
                      )}
                    >
                      {Icon && <Icon className={cn("size-5 text-[#1e1b4b]", isActive ? "opacity-100" : "opacity-60")} />}
                    </BaseSidebarMenuButton>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="left" className="font-black bg-[#1e1b4b] text-white border-none rounded-lg">{item.label}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenuContent side="left" align="start" className="w-64 rounded-2xl p-2 shadow-2xl bg-white/95 backdrop-blur-xl border-none" dir="rtl">
              <DropdownMenuLabel className="font-black text-[#1e1b4b] text-xs px-3 py-2 border-b mb-1">{item.label}</DropdownMenuLabel>
              <ScrollArea className="max-h-[70vh]">
                {item.children.map((child: any) => (
                    <DropdownMenuItem key={child.href} asChild className="rounded-xl py-2.5 cursor-pointer">
                    <Link href={child.href} className="flex items-center justify-between w-full text-[#1e1b4b]">
                        <span className="font-bold text-xs">{child.label}</span>
                        {child.icon && <child.icon className="h-4 w-4 ml-3 opacity-40 text-[#1e1b4b]" />}
                    </Link>
                    </DropdownMenuItem>
                ))}
              </ScrollArea>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      );
    }

    return (
      <Collapsible defaultOpen={isActive} className="group/collapsible px-4">
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton isActive={isActive}>
              <div className="flex items-center justify-between w-full">
                <ChevronLeft className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:-rotate-90 opacity-20 text-[#1e1b4b]" />
                <span className="text-right truncate text-sm font-black flex-1 text-[#1e1b4b]">
                    {item.label}
                </span>
                {Icon && <Icon className={cn("size-5 shrink-0 ml-3 text-[#1e1b4b]", isActive ? "opacity-100" : "opacity-60")} />}
              </div>
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub className="mt-1 mb-4 space-y-2 border-none pr-4">
              {item.children.map((child: any) => {
                const isChildActive = currentPath === child.href;
                return (
                  <SidebarMenuSubItem key={child.href}>
                    <SidebarMenuSubButton isActive={isChildActive} asChild className={cn(
                        "rounded-full py-2.5 h-10 transition-all border border-transparent flex items-center justify-between px-4",
                        isChildActive 
                          ? "bg-white text-[#1e1b4b] font-black shadow-md" 
                          : "bg-white/10 hover:bg-white/20 text-[#1e1b4b]"
                    )}>
                      <Link href={child.href} onClick={() => setOpenMobile(false)}>
                        <div className="flex items-center justify-between w-full">
                            <span className="text-xs font-black truncate text-[#1e1b4b]">{child.label}</span>
                            {child.icon && <child.icon className="h-4 w-4 ml-3 opacity-40 text-[#1e1b4b]" />}
                        </div>
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
  const currentNavItems = navItems[language] || navItems.ar;

  return (
    <TooltipProvider>
      <SidebarHeader className="p-8 mb-6 group-data-[collapsible=icon]:p-4 group-data-[collapsible=icon]:mb-2">
        <div className="flex flex-col items-center">
          <span className="text-3xl font-black text-[#1e1b4b] tracking-tighter group-data-[collapsible=icon]:text-lg">Nova</span>
          <div className="flex items-center gap-2 mt-1 group-data-[collapsible=icon]:hidden">
              <span className="text-[9px] font-black uppercase tracking-[0.4em] text-[#1e1b4b]/40">PURPLE SUITE</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="scrollbar-none">
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

      <SidebarFooter className="p-6 mt-auto group-data-[collapsible=icon]:p-2">
        <div className="bg-white/30 border border-white/40 rounded-[2.5rem] p-5 flex items-center shadow-sm backdrop-blur-md group hover:bg-white/40 transition-all cursor-pointer group-data-[collapsible=icon]:rounded-2xl group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:justify-center">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-[#1e1b4b] font-black shadow-lg group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:rounded-xl">
                {currentUser.fullName?.charAt(0) || 'N'}
            </div>
            <div className="mr-4 text-right overflow-hidden group-data-[state=collapsed]:hidden flex-1 group-data-[collapsible=icon]:hidden">
                <p className="text-sm font-black truncate text-[#1e1b4b] leading-none mb-1">{currentUser.fullName}</p>
                <p className="text-[9px] truncate font-black uppercase tracking-widest text-[#1e1b4b]/60">{currentUser.role}</p>
            </div>
        </div>
      </SidebarFooter>
    </TooltipProvider>
  );
}
