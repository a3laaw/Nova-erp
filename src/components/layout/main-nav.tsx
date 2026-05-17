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
  Users,
  Trash2,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { AuthenticatedUser } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { ScrollArea } from '../ui/scroll-area';

const navItems = {
  ar: [
    { 
      href: '/dashboard', 
      label: 'لوحة التحكم', 
      icon: LayoutGrid, 
      roles: ['Developer', 'Admin', 'Engineer', 'Accountant', 'Secretary', 'HR'] 
    },
    { 
      label: 'إدارة العملاء',
      icon: UsersRound,
      roles: ['Developer', 'Admin', 'Accountant', 'Secretary', 'Engineer'],
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
      children: [
        { href: '/dashboard/accounting/chart-of-accounts', label: 'شجرة الحسابات', icon: ListTree },
        { href: '/dashboard/accounting/journal-entries', label: 'قيود اليومية', icon: BookOpen },
        { href: '/dashboard/accounting/cash-receipts', label: 'سندات القبض', icon: ArrowDownLeft },
        { href: '/dashboard/accounting/payment-vouchers', label: 'سندات الصرف', icon: ArrowUpRight },
        { href: '/dashboard/accounting/trial-balance', label: 'ميزان المراجعة', icon: Scale },
        { href: '/dashboard/accounting/income-statement', label: 'قائمة الدخل', icon: TrendingUp },
        { href: '/dashboard/accounting/balance-sheet', label: 'المركز المالي', icon: Landmark },
        { href: '/dashboard/accounting/cash-flow', label: 'التدفقات النقدية', icon: Waves },
        { href: '/dashboard/accounting/reports', label: 'التقارير المالية', icon: PieChart },
        { href: '/dashboard/accounting/reconciliation', label: 'التسويات البنكية', icon: RotateCcw },
      ]
    },
    { 
      label: 'إدارة المشاريع',
      icon: PencilRuler,
      roles: ['Developer', 'Admin', 'Engineer', 'Accountant'],
      children: [
        { href: '/dashboard/construction/boq', label: 'جداول الكميات (BOQ)', icon: ClipboardList },
        { href: '/dashboard/construction/projects', label: 'المشاريع القائمة', icon: Briefcase },
        { href: '/dashboard/construction/field-visits', label: 'الزيارات الميدانية', icon: MapPin },
        { href: '/dashboard/construction/subcontractors/certificates', label: 'مستخلصات المقاولين', icon: Calculator },
      ]
    },
    { 
      label: 'المخازن والمشتريات',
      icon: Package,
      roles: ['Developer', 'Admin', 'Accountant', 'Engineer'],
      children: [
        { href: '/dashboard/warehouse/items', label: 'دليل الأصناف', icon: Package },
        { href: '/dashboard/warehouse/grns', label: 'أذونات الاستلام', icon: FileCheck },
        { href: '/dashboard/warehouse/material-issue', label: 'صرف المواد', icon: ArrowUpFromLine },
        { href: '/dashboard/purchasing/purchase-orders', label: 'أوامر الشراء', icon: ShoppingCart },
        { href: '/dashboard/warehouse/transfers', label: 'التحويلات المخزنية', icon: ArrowLeftRight },
        { href: '/dashboard/warehouse/adjustments', label: 'المردودات والتسويات', icon: ReturnIcon },
        { href: '/dashboard/warehouse/reports', label: 'تقارير المخزون', icon: PieChart },
      ]
    },
    { 
      label: 'تقارير الأداء',
      icon: BarChart3,
      roles: ['Developer', 'Admin', 'Engineer', 'Accountant'],
      children: [
        { href: '/dashboard/reports/operational-hub', label: 'رادار الأداء الميداني', icon: Activity },
        { href: '/dashboard/construction/field-visits/reports', label: 'تقييم الإنجاز', icon: MapPin },
      ]
    },
    { 
      label: 'الموارد البشرية', 
      icon: Users, 
      roles: ['Developer', 'Admin', 'HR'],
      children: [
        { href: '/dashboard/hr/employees', label: 'ملفات الموظفين', icon: Users },
        { href: '/dashboard/hr/leaves', label: 'طلبات الإجازات', icon: CalendarCheck },
        { href: '/dashboard/hr/permissions', label: 'الاستئذانات', icon: Clock },
        { href: '/dashboard/hr/payroll', label: 'الرواتب والأجور', icon: Banknote },
        { href: '/dashboard/hr/reports', label: 'تقارير الموظفين', icon: FileText },
      ]
    },
    { 
      label: 'الإعدادات', 
      icon: Settings2, 
      roles: ['Developer', 'Admin'],
      children: [
        { href: '/dashboard/settings/branding', label: 'الهوية والشعار', icon: Palette },
        { href: '/dashboard/settings/reference-data', label: 'إعدادات القوائم', icon: Network },
        { href: '/dashboard/settings/users', label: 'إدارة الحسابات', icon: UserCheck },
        { href: '/dashboard/settings/contract-templates', label: 'نماذج العقود', icon: FileSignature },
        { href: '/dashboard/settings/work-hours', label: 'مواعيد العمل', icon: Clock },
      ]
    },
  ],
  en: [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutGrid, roles: ['Developer', 'Admin', 'Engineer', 'Accountant', 'Secretary', 'HR'] },
  ]
};

function SidebarMenuButton({ isActive, tooltip, children, asChild, className, isSub = false, ...props }: any) {
  const { state, isMobile } = useSidebar();
  const button = (
    <BaseSidebarMenuButton
      isActive={isActive}
      className={cn(
        "my-1.5 h-12 rounded-xl transition-all duration-300 flex items-center w-full px-4 group/btn",
        "group-data-[collapsible=icon]:!size-14 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:mx-auto",
        isActive 
          ? "nav-capsule-active" 
          : (isSub ? "nav-capsule-sub" : "nav-capsule"),
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

  const isAnyChildActive = React.useMemo(() => {
    if (!item.children) return false;
    return item.children.some((child: any) => {
        const baseUrl = child.href.split('?')[0];
        return currentPath.startsWith(baseUrl);
    });
  }, [item.children, currentPath]);

  const isActive = item.href ? currentPath === item.href : isAnyChildActive;

  if (!item.children && item.href) {
    return (
      <SidebarMenuItem className="px-3 group-data-[collapsible=icon]:px-0">
        <SidebarMenuButton isActive={isActive} tooltip={item.label} asChild>
          <Link href={item.href} onClick={() => setOpenMobile(false)} className="flex items-center justify-between w-full h-full">
            <span className={cn(
                "flex-1 text-right truncate text-[13px] font-black group-data-[collapsible=icon]:hidden transition-colors",
                isActive ? "text-[#1e1b4b]" : "text-[#1e1b4b] group-hover/btn:text-[#1e1b4b]"
            )}>
                {item.label}
            </span>
            {Icon && <Icon className={cn("size-6 shrink-0 ml-3 group-data-[collapsible=icon]:ml-0 transition-colors group-hover/btn:text-[#1e1b4b]", isActive ? "text-[#1e1b4b]" : "text-primary")} />}
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
                    <div className="group/collapsible-btn w-full flex justify-center">
                        <BaseSidebarMenuButton 
                          isActive={isActive} 
                          className={cn(
                            "my-2 size-14 rounded-xl flex items-center justify-center p-0 transition-all duration-300 group-data-[collapsible=icon]:mx-auto shadow-sm border group/btn",
                            isActive ? "nav-capsule-active" : "nav-capsule"
                          )}
                        >
                          {Icon && <Icon className={cn("size-6 transition-colors group-hover/btn:text-[#1e1b4b]", isActive ? "text-[#1e1b4b]" : "text-primary")} />}
                        </BaseSidebarMenuButton>
                    </div>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="left" className="font-black bg-[#1E293B] text-white border-none rounded-lg">{item.label}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenuContent side="left" align="start" className="w-72 rounded-[1.8rem] p-2 shadow-[0_20px_50px_rgba(0,0,0,0.15)] bg-white/95 backdrop-blur-xl border-slate-200 text-slate-900" dir="rtl">
              <DropdownMenuLabel className="font-black text-slate-400 text-[10px] uppercase tracking-widest px-4 py-3 border-b border-slate-100 mb-2">{item.label}</DropdownMenuLabel>
              <ScrollArea className="max-h-[70vh]">
                {item.children.map((child: any) => {
                    const isChildActive = currentPath === child.href.split('?')[0];
                    return (
                        <DropdownMenuItem key={child.href} asChild className={cn(
                            "rounded-xl py-3 px-4 cursor-pointer mb-1 transition-all",
                            isChildActive ? "bg-[#FF7A00]/10 text-[#1E293B] font-black" : "hover:bg-slate-100 text-[#1E293B]"
                        )}>
                            <Link href={child.href} className="flex items-center justify-between w-full">
                                <span className="font-black text-xs">{child.label}</span>
                                {child.icon && <child.icon className={cn("h-4 w-4 ml-3", isChildActive ? "text-primary" : "opacity-40")} />}
                            </Link>
                        </DropdownMenuItem>
                    );
                })}
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
              <div className="flex items-center justify-between w-full h-full">
                <ChevronLeft className={cn("h-3.5 w-3.5 transition-transform group-data-[state=open]/collapsible:-rotate-90 opacity-20 group-hover/btn:text-[#1e1b4b] group-hover/btn:opacity-100", isActive && "text-[#1e1b4b] opacity-100")} />
                <span className={cn(
                    "text-right truncate text-[13px] font-black flex-1 transition-colors",
                    isActive ? "text-[#1e1b4b]" : "text-[#1e1b4b] group-hover/btn:text-[#1e1b4b]"
                )}>
                    {item.label}
                </span>
                {Icon && <Icon className={cn("size-6 shrink-0 ml-3 transition-colors group-hover/btn:text-[#1e1b4b]", isActive ? "text-[#1e1b4b]" : "text-primary")} />}
              </div>
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub className="mt-1 mb-2 space-y-1.5 border-none pr-4">
              {item.children.map((child: any) => {
                const isChildActive = currentPath === child.href.split('?')[0];
                return (
                  <SidebarMenuSubItem key={child.href}>
                    <SidebarMenuSubButton isActive={isChildActive} asChild className={cn(
                        "rounded-xl py-2 h-10 transition-all border border-transparent flex items-center justify-start px-4 group/subbtn",
                        isChildActive 
                          ? "nav-capsule-active" 
                          : "nav-capsule-sub"
                    )}>
                      <Link href={child.href} onClick={() => setOpenMobile(false)}>
                        <div className="flex items-center justify-between w-full h-full">
                            <span className={cn(
                                "text-[11px] font-black truncate flex-1 text-right transition-colors",
                                isChildActive ? "text-[#1e1b4b]" : "text-[#1e1b4b]/80 group-hover/subbtn:text-[#1e1b4b]"
                            )}>
                                {child.label}
                            </span>
                            {child.icon && <child.icon className={cn(
                                "h-4 w-4 ml-3 transition-colors", 
                                isChildActive ? "text-[#1e1b4b]" : "text-primary opacity-40 group-hover/subbtn:text-[#1e1b4b] group-hover/subbtn:opacity-100"
                            )} />}
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

export function MainNav({ currentUser, onLogout }: { currentUser: AuthenticatedUser, onLogout: () => void }) {
  const pathname = usePathname();
  const { language } = useLanguage();
  const currentNavItems = navItems[language] || navItems.ar;

  return (
    <>
      <SidebarHeader className="p-6 mb-4 group-data-[collapsible=icon]:p-3 bg-white/5 rounded-t-3xl">
        <div className="flex flex-col items-center">
          <span className="text-3xl font-black text-[#1E293B] tracking-tighter group-data-[collapsible=icon]:text-xl">Nova</span>
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

      <SidebarFooter className="p-4 mt-auto group-data-[collapsible=icon]:p-2 bg-white/5 rounded-b-3xl">
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <div className="bg-white/40 border border-white/60 rounded-2xl p-4 flex items-center shadow-sm backdrop-blur-md group hover:bg-white/60 transition-all cursor-pointer group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:justify-center">
                    <div className="w-10 h-10 bg-[#FF7A00] rounded-xl flex items-center justify-center text-white font-black shadow-lg group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8">
                        {currentUser.fullName?.charAt(0) || 'N'}
                    </div>
                    <div className="mr-3 text-right overflow-hidden group-data-[collapsible=icon]:hidden flex-1">
                        <p className="text-xs font-black truncate text-[#1E293B] leading-none mb-1">{currentUser.fullName}</p>
                        <p className="text-[8px] truncate font-black uppercase tracking-widest text-[#FF7A00]">{currentUser.role}</p>
                    </div>
                </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 shadow-2xl bg-white border-none" dir="rtl">
                <DropdownMenuLabel className="font-black text-xs px-3 py-2 text-slate-400 uppercase tracking-widest">خيارات الجلسة</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-100" />
                <DropdownMenuItem onClick={onLogout} className="text-red-600 font-black rounded-xl py-3 cursor-pointer focus:bg-red-50 transition-all">
                    <Trash2 className="ml-2 h-4 w-4" /> تسجيل الخروج
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </>
  );
}