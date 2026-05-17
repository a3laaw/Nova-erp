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
  Users,
  Trash2,
  Zap,
  ListChecks,
  Bookmark
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AuthenticatedUser } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { ScrollArea } from '../ui/scroll-area';

const navItems = {
  ar: [
    { 
      href: '/dashboard', 
      label: 'الرئيسية', 
      icon: LayoutGrid, 
      roles: ['Developer', 'Admin', 'Engineer', 'Accountant', 'Secretary', 'HR'] 
    },
    { 
      label: 'العملاء',
      icon: UsersRound,
      roles: ['Developer', 'Admin', 'Accountant', 'Secretary', 'Engineer'],
      children: [
        { href: '/dashboard/clients?view=registered', label: 'ملفات العملاء', icon: UsersRound },
        { href: '/dashboard/clients?view=prospective', label: 'المحتملون', icon: Search },
        { href: '/dashboard/accounting/quotations', label: 'عروض الأسعار', icon: FileText },
        { href: '/dashboard/contracts', label: 'العقود', icon: FileSignature },
      ]
    },
    { 
      label: 'المحاسبة', 
      icon: Landmark, 
      roles: ['Developer', 'Admin', 'Accountant'],
      children: [
        { href: '/dashboard/accounting/chart-of-accounts', label: 'الحسابات', icon: ListTree },
        { href: '/dashboard/accounting/journal-entries', label: 'القيود', icon: BookOpen },
        { href: '/dashboard/accounting/cash-receipts', label: 'سندات القبض', icon: ArrowDownLeft },
        { href: '/dashboard/accounting/payment-vouchers', label: 'سندات الصرف', icon: ArrowUpRight },
        { href: '/dashboard/accounting/reports', label: 'التقارير المالية', icon: PieChart },
      ]
    },
    { 
      label: 'المشاريع',
      icon: PencilRuler,
      roles: ['Developer', 'Admin', 'Engineer', 'Accountant'],
      children: [
        { href: '/dashboard/construction/projects', label: 'المشاريع القائمة', icon: Briefcase },
        { href: '/dashboard/construction/field-visits', label: 'الزيارات الميدانية', icon: MapPin },
        { href: '/dashboard/construction/boq', label: 'جداول الكميات', icon: ClipboardList },
      ]
    },
    { 
      label: 'المخازن',
      icon: Package,
      roles: ['Developer', 'Admin', 'Accountant', 'Engineer'],
      children: [
        { href: '/dashboard/warehouse/items', label: 'دليل الأصناف', icon: Package },
        { href: '/dashboard/warehouse/grns', label: 'أذونات الاستلام', icon: FileCheck },
        { href: '/dashboard/warehouse/material-issue', label: 'صرف المواد', icon: ArrowUpFromLine },
      ]
    },
    { 
      label: 'الموظفون', 
      icon: Users, 
      roles: ['Developer', 'Admin', 'HR'],
      children: [
        { href: '/dashboard/hr/employees', label: 'ملفات الموظفين', icon: Users },
        { href: '/dashboard/hr/payroll', label: 'الرواتب', icon: Banknote },
        { href: '/dashboard/hr/leaves', label: 'الإجازات', icon: CalendarCheck },
      ]
    },
    { 
      label: 'الإنتاجية', 
      icon: Zap, 
      roles: ['Developer', 'Admin', 'Engineer', 'Accountant', 'Secretary', 'HR'],
      children: [
        { href: '/dashboard/productivity?tab=tasks', label: 'مهامي الشخصية', icon: ListChecks },
        { href: '/dashboard/productivity?tab=bookmarks', label: 'المفضلات', icon: Bookmark },
      ]
    },
    { 
      label: 'الإعدادات', 
      icon: Settings2, 
      roles: ['Developer', 'Admin'],
      children: [
        { href: '/dashboard/settings/branding', label: 'الهوية والشعار', icon: Palette },
        { href: '/dashboard/settings/users', label: 'إدارة الحسابات', icon: UserCheck },
        { href: '/dashboard/settings/reference-data', label: 'تجهيز القوائم', icon: Network },
      ]
    },
  ],
  en: [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutGrid, roles: ['Developer', 'Admin', 'Engineer', 'Accountant', 'Secretary', 'HR'] },
  ]
};

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

  // Render a flat item
  if (!item.children && item.href) {
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
  
  // Render an item with children
  if (item.children) {
    // Collapsed state: Dropdown
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
                {item.children.map((child: any) => {
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

    // Expanded state: Straight vertical line with zero offset
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
                <span className="text-right truncate text-[14px] font-black flex-1">
                    {item.label}
                </span>
                {Icon && <Icon className="size-6 shrink-0 ml-3" />}
              </div>
            </BaseSidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            {/* Zero horizontal offset container */}
            <SidebarMenuSub className="mt-1 mb-2 space-y-1.5 sidebar-no-offset">
              {item.children.map((child: any) => {
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

      <SidebarFooter className="p-4 mt-auto group-data-[collapsible=icon]:p-2">
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <div className="bg-white/80 border border-white/60 rounded-[1.5rem] p-4 flex items-center shadow-sm hover:bg-white transition-all cursor-pointer group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:justify-center">
                    <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white font-black shadow-lg group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8">
                        {currentUser.fullName?.charAt(0) || 'N'}
                    </div>
                    <div className="mr-3 text-right overflow-hidden group-data-[collapsible=icon]:hidden flex-1">
                        <p className="text-xs font-black truncate text-[#1e1b4b] leading-none mb-1">{currentUser.fullName}</p>
                        <p className="text-[8px] truncate font-black uppercase tracking-widest text-primary">{currentUser.role}</p>
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