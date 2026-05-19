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
  RotateCcw,
  Scale,
  TrendingUp,
  Activity,
  Package,
  ShoppingCart,
  FileCheck,
  ArrowUpFromLine,
  ArrowLeftRight,
  Users,
  Trash2,
  Zap,
  ListChecks,
  Bookmark,
  ChevronLeft,
  Wallet,
  Building2,
  ShieldCheck,
  Calculator,
  BarChart3,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AuthenticatedUser } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '@/components/ui/badge';

const navItems = {
  ar: [
    { 
      href: '/dashboard', 
      label: 'الرئيسية', 
      icon: LayoutGrid, 
      roles: ['Developer', 'Admin', 'Engineer', 'Accountant', 'Secretary', 'HR', 'User'] 
    },
    { 
      href: '/dashboard/employee-hub', 
      label: 'الحائط التفاعلي', 
      icon: Sparkles, 
      roles: ['Developer', 'Admin', 'Engineer', 'Accountant', 'Secretary', 'HR', 'User'] 
    },
    { 
      label: 'العملاء والمبيعات',
      icon: UsersRound,
      roles: ['Developer', 'Admin', 'Accountant', 'Secretary', 'Engineer'],
      hrefPrefix: '/dashboard/clients',
      children: [
        { href: '/dashboard/clients?view=registered', label: 'ملفات العملاء', icon: UsersRound },
        { href: '/dashboard/clients?view=prospective', label: 'المحتملون', icon: Search },
        { href: '/dashboard/accounting/quotations', label: 'عروض الأسعار', icon: FileText },
        { href: '/dashboard/contracts', label: 'العقود الرسمية', icon: FileSignature },
      ]
    },
    { 
      label: 'الهندسة والمقاولات',
      icon: PencilRuler,
      roles: ['Developer', 'Admin', 'Engineer', 'Accountant'],
      hrefPrefix: '/dashboard/construction',
      children: [
        { href: '/dashboard/construction/projects', label: 'المشاريع القائمة', icon: Briefcase },
        { href: '/dashboard/construction/field-visits', label: 'الزيارات الميدانية', icon: MapPin },
        { href: '/dashboard/construction/boq', label: 'مكتبة المقايسات (BOQ)', icon: ClipboardList },
        { href: '/dashboard/construction/schedules', label: 'الجداول الزمنية', icon: Clock },
      ]
    },
    { 
      label: 'المحاسبة والمالية', 
      icon: Landmark, 
      roles: ['Developer', 'Admin', 'Accountant'],
      hrefPrefix: '/dashboard/accounting',
      children: [
        { href: '/dashboard/accounting/chart-of-accounts', label: 'شجرة الحسابات', icon: ListTree },
        { href: '/dashboard/accounting/journal-entries', label: 'قيود اليومية', icon: BookOpen },
        { href: '/dashboard/accounting/cash-receipts', label: 'سندات القبض', icon: ArrowDownLeft },
        { href: '/dashboard/accounting/payment-vouchers', label: 'سندات الصرف', icon: ArrowUpRight },
        { href: '/dashboard/accounting/reconciliation', label: 'التسويات البنكية', icon: RotateCcw },
        { href: '/dashboard/accounting/recurring', label: 'الالتزامات الدورية', icon: CalendarCheck },
        { href: '/dashboard/accounting/reports', label: 'التقارير التحليلية', icon: PieChart },
      ]
    },
    { 
      label: 'المخازن والمشتريات',
      icon: Package,
      roles: ['Developer', 'Admin', 'Accountant', 'Engineer'],
      hrefPrefix: '/dashboard/warehouse',
      children: [
        { href: '/dashboard/warehouse/items', label: 'دليل الأصناف', icon: Package },
        { href: '/dashboard/warehouse/grns', label: 'أذونات الاستلام', icon: FileCheck },
        { href: '/dashboard/warehouse/material-issue', label: 'صرف المواد', icon: ArrowUpFromLine },
        { href: '/dashboard/warehouse/transfers', label: 'التحويلات المخزنية', icon: ArrowLeftRight },
        { href: '/dashboard/warehouse/reports', label: 'تقارير المخزون', icon: BarChart3 },
      ]
    },
    { 
      label: 'الموارد البشرية', 
      icon: Users, 
      roles: ['Developer', 'Admin', 'HR', 'Accountant', 'Engineer', 'Secretary', 'User'],
      hrefPrefix: '/dashboard/hr',
      children: [
        { href: '/dashboard/hr/employees', label: 'سجل الموظفين', icon: Users, roles: ['Admin', 'HR', 'Developer'] },
        { href: '/dashboard/hr/payroll', label: 'مسير الرواتب', icon: Banknote, roles: ['Admin', 'HR', 'Accountant', 'Developer'] },
        { href: '/dashboard/hr/leaves', label: 'الإجازات', icon: CalendarCheck },
        { href: '/dashboard/hr/permissions', label: 'الاستئذانات', icon: Clock },
        { href: '/dashboard/hr/custody-reconciliation', label: 'تسوية العهد', icon: Wallet, roles: ['Admin', 'Accountant', 'Developer', 'Engineer', 'Secretary'] },
        { href: '/dashboard/hr/reports', label: 'تقارير الموارد', icon: Activity, roles: ['Admin', 'HR', 'Developer'] },
      ]
    },
    { 
      label: 'إدارة التقارير',
      icon: BarChart3,
      roles: ['Developer', 'Admin', 'Accountant', 'HR'],
      hrefPrefix: '/dashboard/reports',
      children: [
        { href: '/dashboard/reports/operational-hub', label: 'رادار الأداء الفني', icon: Activity },
        { href: '/dashboard/reports/appointments-audit', label: 'سجل تدقيق المواعيد', icon: History },
        { href: '/dashboard/reports/delayed-stages', label: 'المراحل المتأخرة', icon: Clock },
        { href: '/dashboard/reports/prospective-clients', label: 'تحليل المحتملين', icon: Search },
      ]
    },
    { 
      label: 'إعدادات النظام', 
      icon: Settings2, 
      roles: ['Developer', 'Admin'],
      hrefPrefix: '/dashboard/settings',
      children: [
        { href: '/dashboard/settings/branding', label: 'الهوية والشعار', icon: Palette },
        { href: '/dashboard/settings/users', label: 'إدارة المستخدمين', icon: UserCheck },
        { href: '/dashboard/settings/reference-data', label: 'تجهيز القوائم', icon: Network },
        { href: '/dashboard/settings/contract-templates', label: 'نماذج العقود', icon: FileSignature },
        { href: '/dashboard/settings/work-hours', label: 'مواعيد العمل', icon: Clock },
      ]
    },
  ],
  en: [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutGrid, roles: ['Developer', 'Admin', 'Engineer', 'Accountant', 'Secretary', 'HR', 'User'] },
  ]
};

function NavItem({ item, userRole, currentPath }: { item: any, userRole: string, currentPath: string }) {
  const { setOpenMobile, state } = useSidebar();
  const Icon = item.icon;
  if (item.roles && !item.roles.includes(userRole)) return null;

  const visibleChildren = React.useMemo(() => {
    if (!item.children) return null;
    return item.children.filter((child: any) => !child.roles || child.roles.includes(userRole));
  }, [item.children, userRole]);

  if (item.children && (!visibleChildren || visibleChildren.length === 0)) return null;

  const isAnyChildActive = React.useMemo(() => {
    if (!visibleChildren) return false;
    return visibleChildren.some((child: any) => {
        const baseUrl = child.href.split('?')[0];
        return currentPath.startsWith(baseUrl);
    });
  }, [visibleChildren, currentPath]);

  const isActive = item.href ? currentPath === item.href : (item.hrefPrefix ? currentPath.startsWith(item.hrefPrefix) : isAnyChildActive);

  if (!visibleChildren && item.href) {
    return (
      <SidebarMenuItem className="px-4">
        <BaseSidebarMenuButton 
          isActive={isActive} 
          asChild 
          className={cn(
            "nav-item-box my-1.5 h-14",
            isActive && "nav-item-box-active"
          )}
        >
          <Link href={item.href} onClick={() => setOpenMobile(false)} className="flex items-center justify-between w-full h-full px-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
            <span className="flex-1 text-right truncate text-[14px] font-black group-data-[collapsible=icon]:hidden">
                {item.label}
            </span>
            {Icon && <Icon className="size-6 shrink-0 ml-3 group-data-[collapsible=icon]:ml-0" />}
          </Link>
        </BaseSidebarMenuButton>
      </SidebarMenuItem>
    );
  }
  
  if (visibleChildren) {
    if (state === 'collapsed') {
      return (
        <SidebarMenuItem className="px-3 group-data-[collapsible=icon]:px-0">
          <DropdownMenu>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <div className="w-full flex justify-center">
                        <BaseSidebarMenuButton 
                          isActive={isActive} 
                          className={cn(
                            "nav-item-box !size-14 !p-0 justify-center mx-auto my-1.5",
                            isActive && "nav-item-box-active"
                          )}
                        >
                          {Icon && <Icon className="size-6" />}
                        </BaseSidebarMenuButton>
                    </div>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="left" className="font-black bg-primary text-white border-none rounded-lg shadow-xl">{item.label}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenuContent side="left" align="start" className="w-72 rounded-[1.8rem] p-2 shadow-2xl bg-white border-none" dir="rtl">
              <DropdownMenuLabel className="font-black text-slate-400 text-[10px] uppercase tracking-widest px-4 py-3 border-b mb-2">{item.label}</DropdownMenuLabel>
              <ScrollArea className="max-h-[70vh]">
                {visibleChildren.map((child: any) => {
                    const isChildActive = currentPath === child.href.split('?')[0];
                    return (
                        <DropdownMenuItem key={child.href} asChild className={cn(
                            "rounded-xl py-3 px-4 mb-1",
                            isChildActive ? "bg-primary text-white font-black" : "hover:bg-orange-50 text-[#1e1b4b]"
                        )}>
                            <Link href={child.href} className="flex items-center justify-between w-full">
                                <span className="font-black text-xs">{child.label}</span>
                                {child.icon && <child.icon className={cn("h-4 w-4 ml-3", isChildActive ? "text-white" : "text-primary")} />}
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
      <Collapsible defaultOpen={isActive} className="group/collapsible px-4">
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <BaseSidebarMenuButton 
              isActive={isActive}
              className={cn(
                "nav-item-box my-1.5 h-14",
                isActive && "nav-item-box-active"
              )}
            >
              <div className="flex items-center justify-between w-full h-full px-4">
                <ChevronLeft className={cn("h-4 w-4 transition-transform group-data-[state=open]/collapsible:-rotate-90 opacity-40", isActive ? "text-black" : "text-white")} />
                <span className="text-right truncate text-[14px] font-black flex-1 pr-2">
                    {item.label}
                </span>
                {Icon && <Icon className="size-6 shrink-0 ml-3" />}
              </div>
            </BaseSidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub className="mt-1 mb-2 space-y-1.5 sidebar-no-offset">
              {visibleChildren.map((child: any) => {
                const isChildActive = currentPath === child.href.split('?')[0];
                return (
                  <SidebarMenuSubItem key={child.href}>
                    <SidebarMenuSubButton isActive={isChildActive} asChild className={cn(
                        "rounded-xl py-2 h-11 border-none px-4",
                        isChildActive ? "nav-item-box-active font-black shadow-md" : "bg-white/60 hover:bg-orange-50 text-[#1e1b4b]"
                    )}>
                      <Link href={child.href} onClick={() => setOpenMobile(false)}>
                        <div className="flex items-center justify-between w-full h-full">
                            <span className="text-[12px] font-bold truncate flex-1 text-right">{child.label}</span>
                            {child.icon && <child.icon className={cn("h-4 w-4 ml-3", isChildActive ? "text-black" : "text-primary")} />}
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
      <SidebarHeader className="p-6 mb-8 group-data-[collapsible=icon]:p-3">
        <div className="flex flex-col items-center">
          <span className="text-3xl font-black text-[#1e1b4b] tracking-tighter group-data-[collapsible=icon]:text-xl">Nova</span>
          <div className="flex items-center gap-2 mt-1 group-data-[collapsible=icon]:hidden">
              <span className="text-[9px] font-black uppercase tracking-[0.4em] text-primary">ENTERPRISE</span>
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

      <SidebarFooter className="p-6 mt-auto">
        <div className="flex items-center justify-center py-4 opacity-20 hover:opacity-50 transition-opacity">
            <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest border-primary/20 text-primary">Nova Core v1.5</Badge>
        </div>
      </SidebarFooter>
    </>
  );
}
