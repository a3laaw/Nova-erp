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
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import {
  LayoutGrid,
  FileSignature,
  Landmark,
  PencilRuler,
  Settings2,
  ChevronLeft,
  UsersRound,
  Search,
  FileText,
  ListTree,
  BookOpen,
  ArrowDownLeft,
  ArrowUpRight,
  PieChart,
  CalendarCheck,
  Clock,
  Banknote,
  ClipboardList,
  Briefcase,
  MapPin,
  Palette,
  Network,
  UserCheck,
  Calculator,
  ShieldCheck,
  RotateCcw,
  Scale,
  TrendingUp,
  Activity,
  BarChart3,
  Waves,
  Package,
  ShoppingCart,
  FileCheck,
  ArrowUpFromLine,
  ArrowLeftRight,
  RotateCcw as ReturnIcon,
  Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AuthenticatedUser } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { ScrollArea } from '../ui/scroll-area';

const navItems = {
  ar: [
    { 
      href: '/dashboard', 
      label: 'لوحة التحكم المركزية', 
      icon: LayoutGrid, 
      roles: ['Developer', 'Admin', 'Engineer', 'Accountant', 'Secretary', 'HR'] 
    },
    { 
      label: 'CRM و إدارة العملاء',
      icon: FileSignature,
      roles: ['Developer', 'Admin', 'Accountant', 'Secretary', 'Engineer'],
      hrefPrefix: '/dashboard/contracts',
      children: [
        { href: '/dashboard/clients?view=registered', label: 'ملفات العملاء', icon: UsersRound },
        { href: '/dashboard/clients?view=prospective', label: 'العملاء المحتملون', icon: Search },
        { href: '/dashboard/accounting/quotations', label: 'عروض الأسعار', icon: FileText },
        { href: '/dashboard/contracts', label: 'العقود الموقعة', icon: FileSignature },
      ]
    },
    { 
      label: 'المحاسبة والمالية', 
      icon: Landmark, 
      roles: ['Developer', 'Admin', 'Accountant'],
      hrefPrefix: '/dashboard/accounting',
      children: [
        { href: '/dashboard/accounting/chart-of-accounts', label: 'شجرة الحسابات', icon: ListTree },
        { href: '/dashboard/accounting/journal-entries', label: 'قيود اليومية العامة', icon: BookOpen },
        { href: '/dashboard/accounting/cash-receipts', label: 'سندات القبض', icon: ArrowDownLeft },
        { href: '/dashboard/accounting/payment-vouchers', label: 'سندات الصرف', icon: ArrowUpRight },
        { href: '/dashboard/accounting/trial-balance', label: 'ميزان المراجعة', icon: Scale },
        { href: '/dashboard/accounting/income-statement', label: 'قائمة الدخل (P&L)', icon: TrendingUp },
        { href: '/dashboard/accounting/balance-sheet', label: 'المركز المالي', icon: Landmark },
        { href: '/dashboard/accounting/cash-flow', label: 'التدفقات النقدية', icon: Waves },
        { href: '/dashboard/accounting/reports', label: 'التحليلات والربحية', icon: PieChart },
        { href: '/dashboard/accounting/reconciliation', label: 'التسويات البنكية', icon: RotateCcw },
      ]
    },
    { 
      label: 'المقاولات والقياسات',
      icon: PencilRuler,
      roles: ['Developer', 'Admin', 'Engineer', 'Accountant'],
      hrefPrefix: '/dashboard/construction',
      children: [
        { href: '/dashboard/construction/boq', label: 'مكتبة المقايسات (BOQ)', icon: ClipboardList },
        { href: '/dashboard/construction/projects', label: 'المشاريع التنفيذية', icon: Briefcase },
        { href: '/dashboard/construction/field-visits', label: 'الزيارات الميدانية', icon: MapPin },
        { href: '/dashboard/construction/subcontractors/certificates', label: 'مستخلصات المقاولين', icon: Calculator },
      ]
    },
    { 
      label: 'المخازن والمشتريات',
      icon: Package,
      roles: ['Developer', 'Admin', 'Accountant', 'Engineer'],
      hrefPrefix: '/dashboard/warehouse',
      children: [
        { href: '/dashboard/warehouse/items', label: 'دليل الأصناف', icon: Package },
        { href: '/dashboard/warehouse/grns', label: 'أذونات الاستلام (GRN)', icon: FileCheck },
        { href: '/dashboard/warehouse/material-issue', label: 'صرف مواد المشاريع', icon: ArrowUpFromLine },
        { href: '/dashboard/purchasing/purchase-orders', label: 'أوامر الشراء', icon: ShoppingCart },
        { href: '/dashboard/warehouse/transfers', label: 'التحويلات المخزنية', icon: ArrowLeftRight },
        { href: '/dashboard/warehouse/adjustments', label: 'المردودات والتسويات', icon: ReturnIcon },
        { href: '/dashboard/warehouse/reports', label: 'تقارير المخزون', icon: PieChart },
      ]
    },
    { 
      label: 'تقارير الأداء الفني',
      icon: BarChart3,
      roles: ['Developer', 'Admin', 'Engineer', 'Accountant'],
      hrefPrefix: '/dashboard/reports/operational-hub',
      children: [
        { href: '/dashboard/reports/operational-hub', label: 'الذكاء العملياتي (COO)', icon: Activity },
        { href: '/dashboard/construction/field-visits/reports', label: 'الأداء الميداني', icon: MapPin },
      ]
    },
    { 
      label: 'شؤون الموظفين (HR)', 
      icon: Users, 
      roles: ['Developer', 'Admin', 'HR'],
      hrefPrefix: '/dashboard/hr',
      children: [
        { href: '/dashboard/hr/employees', label: 'ملفات الموظفين', icon: Users },
        { href: '/dashboard/hr/leaves', label: 'طلبات الإجازات', icon: CalendarCheck },
        { href: '/dashboard/hr/permissions', label: 'إدارة الاستئذانات', icon: Clock },
        { href: '/dashboard/hr/payroll', label: 'رواتب الموظفين', icon: Banknote },
        { href: '/dashboard/hr/reports', label: 'تقارير الموارد البشرية', icon: FileText },
      ]
    },
    { 
      label: 'الإعدادات والبيانات', 
      icon: Settings2, 
      roles: ['Developer', 'Admin'],
      hrefPrefix: '/dashboard/settings',
      children: [
        { href: '/dashboard/settings/branding', label: 'الهوية البصرية', icon: Palette },
        { href: '/dashboard/settings/reference-data', label: 'البيانات المرجعية', icon: Network },
        { href: '/dashboard/settings/users', label: 'إدارة المستخدمين', icon: UserCheck },
        { href: '/dashboard/settings/contract-templates', label: 'نماذج العقود', icon: FileSignature },
        { href: '/dashboard/settings/work-hours', label: 'مواعيد العمل', icon: Clock },
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
        "my-2 h-11 rounded-xl transition-all duration-300 flex items-center w-full px-4",
        "group-data-[collapsible=icon]:!size-12 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:mx-auto",
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
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="left" align="center" className="font-black bg-[#FF7A00] text-white border-none rounded-lg shadow-xl">{tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
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
      <SidebarMenuItem className="px-3 group-data-[collapsible=icon]:px-0">
        <SidebarMenuButton isActive={isActive} tooltip={item.label} asChild>
          <Link href={item.href} onClick={() => setOpenMobile(false)} className="flex items-center justify-between w-full">
            <span className="flex-1 text-right truncate text-[13px] font-bold group-data-[collapsible=icon]:hidden">
                {item.label}
            </span>
            {Icon && <Icon className={cn("size-5 shrink-0 ml-3 group-data-[collapsible=icon]:ml-0", isActive ? "opacity-100" : "opacity-60")} />}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }
  
  if (item.children) {
    if (state === 'collapsed') {
      return (
        <SidebarMenuItem className="px-3 group-data-[collapsible=icon]:px-0">
          <DropdownMenu>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <BaseSidebarMenuButton 
                      isActive={isActive} 
                      className={cn(
                        "my-2 size-12 rounded-xl flex items-center justify-center p-0 transition-all duration-300 group-data-[collapsible=icon]:mx-auto",
                        isActive ? "nav-capsule-active" : "nav-capsule"
                      )}
                    >
                      {Icon && <Icon className={cn("size-5", isActive ? "opacity-100" : "opacity-60")} />}
                    </BaseSidebarMenuButton>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="left" className="font-black bg-[#1E293B] text-white border-none rounded-lg">{item.label}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenuContent side="left" align="start" className="w-64 rounded-2xl p-2 shadow-2xl bg-[#1E293B]/95 backdrop-blur-xl border-white/10 text-white" dir="rtl">
              <DropdownMenuLabel className="font-black text-white/40 text-[10px] uppercase tracking-widest px-3 py-2 border-b border-white/5 mb-1">{item.label}</DropdownMenuLabel>
              <ScrollArea className="max-h-[70vh]">
                {item.children.map((child: any) => (
                    <DropdownMenuItem key={child.href} asChild className="rounded-xl py-2.5 cursor-pointer focus:bg-white/10 focus:text-white">
                    <Link href={child.href} className="flex items-center justify-between w-full">
                        <span className="font-bold text-xs">{child.label}</span>
                        {child.icon && <child.icon className="h-4 w-4 ml-3 opacity-40" />}
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
      <Collapsible defaultOpen={isActive} className="group/collapsible px-3">
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton isActive={isActive}>
              <div className="flex items-center justify-between w-full">
                <ChevronLeft className="h-3.5 w-3.5 transition-transform group-data-[state=open]/collapsible:-rotate-90 opacity-20" />
                <span className="text-right truncate text-[13px] font-bold flex-1">
                    {item.label}
                </span>
                {Icon && <Icon className={cn("size-5 shrink-0 ml-3", isActive ? "opacity-100" : "opacity-60")} />}
              </div>
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub className="mt-1 mb-2 space-y-1 border-none pr-4">
              {item.children.map((child: any) => {
                const isChildActive = currentPath === child.href;
                return (
                  <SidebarMenuSubItem key={child.href}>
                    <SidebarMenuSubButton isActive={isChildActive} asChild className={cn(
                        "rounded-xl py-2 h-9 transition-all border border-transparent flex items-center justify-between px-4",
                        isChildActive 
                          ? "bg-white text-[#1E293B] font-black shadow-lg" 
                          : "text-white/40 hover:text-white hover:bg-white/5"
                    )}>
                      <Link href={child.href} onClick={() => setOpenMobile(false)}>
                        <div className="flex items-center justify-between w-full">
                            <span className="text-[11px] font-bold truncate">{child.label}</span>
                            {child.icon && <child.icon className="h-3.5 w-3.5 ml-3 opacity-30" />}
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
    <>
      <SidebarHeader className="p-6 mb-4 group-data-[collapsible=icon]:p-3">
        <div className="flex flex-col items-center">
          <span className="text-3xl font-black text-white tracking-tighter group-data-[collapsible=icon]:text-xl">Nova</span>
          <div className="flex items-center gap-2 mt-1 group-data-[collapsible=icon]:hidden">
              <span className="text-[9px] font-black uppercase tracking-[0.4em] text-[#FF7A00]">ENTERPRISE</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="scrollbar-none">
        <SidebarMenu className="gap-0.5">
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

      <SidebarFooter className="p-4 mt-auto group-data-[collapsible=icon]:p-2">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center shadow-sm backdrop-blur-md group hover:bg-white/10 transition-all cursor-pointer group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:justify-center">
            <div className="w-10 h-10 bg-white/90 rounded-xl flex items-center justify-center text-[#1E293B] font-black shadow-lg group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8">
                {currentUser.fullName?.charAt(0) || 'N'}
            </div>
            <div className="mr-3 text-right overflow-hidden group-data-[collapsible=icon]:hidden flex-1">
                <p className="text-xs font-black truncate text-white leading-none mb-1">{currentUser.fullName}</p>
                <p className="text-[8px] truncate font-black uppercase tracking-widest text-[#FF7A00]">{currentUser.role}</p>
            </div>
        </div>
      </SidebarFooter>
    </>
  );
}
