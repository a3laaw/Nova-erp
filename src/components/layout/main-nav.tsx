'use client';

import React, { useMemo } from 'react';
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
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  LayoutGrid,
  Users,
  Search,
  FileSignature,
  Construction,
  MapPin,
  Wallet,
  BookOpen,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  Layers,
  UserX,
  Zap,
  ChevronLeft,
  Briefcase,
  PieChart,
  ListTree,
  Clock,
  Settings2,
  Building2,
  ShieldCheck,
  Calculator,
  Coins,
  Waves,
  UserCheck,
  Banknote,
  Lock,
  Network,
  Palette
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AuthenticatedUser } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const navItems = {
  ar: [
    { id: 'dashboard', href: '/dashboard', label: 'لوحة التحكم المركزية', icon: LayoutGrid, roles: ['Developer', 'Admin', 'Engineer', 'Accountant', 'Secretary', 'HR'] },
    { 
      id: 'clients',
      label: 'علاقات العملاء (CRM)', 
      icon: Users, 
      roles: ['Developer', 'Admin', 'Engineer', 'Accountant', 'HR', 'Secretary'],
      hrefPrefix: '/dashboard/clients',
      children: [
        { href: '/dashboard/clients?view=registered', label: 'ملفات العملاء', icon: Users },
        { href: '/dashboard/clients?view=prospective', label: 'العملاء المحتملون', icon: Search },
      ]
    },
    { 
      id: 'construction',
      label: 'المقاولات والقياسات',
      icon: Construction,
      roles: ['Developer', 'Admin', 'Engineer', 'Accountant'],
      hrefPrefix: '/dashboard/construction',
      children: [
        { href: '/dashboard/contracts', label: 'عروض الأسعار والعقود', icon: FileSignature },
        { href: '/dashboard/construction/projects', label: 'المشاريع التنفيذية', icon: Briefcase },
        { href: '/dashboard/construction/field-visits', label: 'الزيارات الميدانية', icon: MapPin },
        { href: '/dashboard/construction/boq', label: 'جداول الكميات (BOQ)', icon: ListTree },
        { href: '/dashboard/construction/payment-applications', label: 'المستخلصات المالية', icon: Coins },
      ]
    },
    { 
      id: 'accounting',
      label: 'المطالبات المالية', 
      icon: Wallet, 
      roles: ['Developer', 'Admin', 'Accountant'],
      hrefPrefix: '/dashboard/accounting',
      children: [
        { href: '/dashboard/accounting/chart-of-accounts', label: 'شجرة الحسابات', icon: Layers },
        { href: '/dashboard/accounting/journal-entries', label: 'قيود اليومية العامة', icon: BookOpen },
        { href: '/dashboard/accounting/cash-receipts', label: 'سندات القبض', icon: ArrowDownLeft },
        { href: '/dashboard/accounting/payment-vouchers', label: 'سندات الصرف', icon: ArrowUpRight },
        { href: '/dashboard/accounting/reports', label: 'التقارير التحليلية', icon: PieChart },
      ]
    },
    { 
      id: 'hr',
      label: 'الموارد البشرية', 
      icon: UserCheck, 
      roles: ['Developer', 'Admin', 'HR'],
      hrefPrefix: '/dashboard/hr',
      children: [
        { href: '/dashboard/hr/employees', label: 'بيانات الموظفين', icon: UserCheck },
        { href: '/dashboard/hr/payroll', label: 'الرواتب والإجازات', icon: Banknote },
        { href: '/dashboard/hr/permissions', label: 'الاستئذانات', icon: Clock },
      ]
    },
    { 
      id: 'settings',
      label: 'إعدادات النظام', 
      icon: Settings2, 
      roles: ['Developer', 'Admin'],
      hrefPrefix: '/dashboard/settings',
      children: [
        { href: '/dashboard/settings/permissions', label: 'مصفوفة الصلاحيات', icon: Lock },
        { href: '/dashboard/settings/branding', label: 'الهوية والشعار', icon: Palette },
        { href: '/dashboard/settings/users', label: 'دخول الموظفين', icon: UserCheck },
        { href: '/dashboard/settings/reference-data', label: 'تجهيز القوائم', icon: Network },
      ]
    },
  ],
};

function NavItem({ item, userRole, currentPath, state }: { item: any, userRole: string, currentPath: string, state: string }) {
  const { setOpenMobile } = useSidebar();
  const Icon = item.icon;

  if (item.roles && !item.roles.includes(userRole)) return null;

  const isActive = item.hrefPrefix ? currentPath.startsWith(item.hrefPrefix) : (item.href ? currentPath === item.href : false);

  // 🛡️ الهوية البصرية الموحدة (البرتقالي الذهبي السيادي) 🛡️
  const orangeGradientClass = "bg-gradient-to-r from-[#FFB000] to-[#e87c24] text-white shadow-xl border-none scale-[1.02]";
  const inactiveClass = "text-[#1e1b4b] hover:bg-orange-50 hover:text-[#e87c24]";

  // --- الحالة 1: الشريط مغلق (Collapsed) ---
  if (state === "collapsed") {
    return (
      <SidebarMenuItem className="flex justify-center py-1">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              {item.children ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={cn(
                        "size-12 rounded-2xl transition-all duration-500",
                        orangeGradientClass // كافة الأيقونات برتقالية في وضع الإغلاق كما طلبت
                      )}
                    >
                      <Icon className="size-6 text-white" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    side="left" 
                    align="start" 
                    dir="rtl" 
                    className="w-64 rounded-[2rem] p-2 shadow-2xl border-2 border-primary/10 bg-white/95 backdrop-blur-xl z-[999999]"
                  >
                    <DropdownMenuLabel className="font-black text-primary px-5 py-4 text-sm border-b-2 border-primary/5 mb-2 uppercase tracking-widest text-right">
                      {item.label}
                    </DropdownMenuLabel>
                    {item.children.map((child: any) => (
                      <DropdownMenuItem key={child.href} asChild className="rounded-xl py-3 px-4 focus:bg-primary/5 cursor-pointer">
                        <Link href={child.href} className="flex items-center justify-between w-full">
                          <span className="font-black text-[#000000] text-sm text-right flex-1">{child.label}</span>
                          {child.icon && <child.icon className="h-4 w-4 text-primary opacity-40 ml-2" />}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button 
                  asChild 
                  variant="ghost" 
                  size="icon" 
                  className={cn(
                    "size-12 rounded-2xl transition-all duration-500",
                    orangeGradientClass
                  )}
                >
                  <Link href={item.href}>
                    <Icon className="size-6 text-white" />
                  </Link>
                </Button>
              )}
            </TooltipTrigger>
            <TooltipContent side="left" className="font-black text-xs bg-slate-900 text-white rounded-lg px-3 py-1.5 z-[999999]">
              {item.label}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </SidebarMenuItem>
    );
  }

  // --- الحالة 2: الشريط مفتوح (Expanded) ---
  if (!item.children && item.href) {
    return (
      <SidebarMenuItem className="px-4">
        <SidebarMenuButton 
          isActive={isActive} 
          asChild 
          className={cn(
            "my-1.5 h-14 transition-all duration-500",
            isActive ? orangeGradientClass : inactiveClass
          )}
        >
          <Link href={item.href} onClick={() => setOpenMobile(false)} className="flex items-center justify-between w-full h-full px-4">
            <span className="flex-1 text-right truncate text-[14px] font-black">{item.label}</span>
            <Icon className={cn("size-6 shrink-0 ml-3", isActive ? "text-white" : "text-primary")} />
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }
  
  if (item.children) {
    return (
      <Collapsible defaultOpen={isActive} className="group/collapsible px-4">
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton 
              isActive={isActive} 
              className={cn(
                "my-1.5 h-14 transition-all duration-500",
                isActive ? orangeGradientClass : inactiveClass
              )}
            >
              <div className="flex items-center justify-between w-full h-full px-4">
                <ChevronLeft className={cn("h-4 w-4 transition-transform group-data-[state=open]/collapsible:-rotate-90 opacity-40", isActive ? "text-white" : "text-primary")} />
                <span className="text-right truncate text-[14px] font-black flex-1 pr-2">{item.label}</span>
                <Icon className={cn("size-6 shrink-0 ml-3", isActive ? "text-white" : "text-primary")} />
              </div>
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub className="mt-1 mb-2 space-y-1.5 border-none">
              {item.children.map((child: any) => {
                const isChildActive = currentPath === child.href.split('?')[0];
                return (
                  <SidebarMenuSubItem key={child.href}>
                    <SidebarMenuSubButton isActive={isChildActive} asChild className={cn("rounded-xl py-2 h-11 border-none px-4", isChildActive ? "bg-primary/10 text-primary font-black shadow-sm" : "bg-white/60 hover:bg-orange-50 text-slate-600")}>
                      <Link href={child.href} onClick={() => setOpenMobile(false)}>
                        <div className="flex items-center justify-between w-full h-full">
                            <span className="text-[12px] font-black truncate flex-1 text-right text-[#000000]">{child.label}</span>
                            {child.icon && <child.icon className={cn("h-4 w-4 ml-3", isChildActive ? "text-primary" : "text-slate-400")} />}
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
  const { state } = useSidebar();
  
  const currentNavItems = (navItems as any)[language] || navItems.ar;

  return (
    <>
      <SidebarHeader className="p-6 mb-8 transition-all duration-500">
        <div className="flex flex-col items-center">
          <span className={cn("font-black text-[#1e1b4b] tracking-tighter transition-all duration-500", state === "collapsed" ? "text-xl" : "text-3xl")}>Nova</span>
          {state !== "collapsed" && (
            <div className="flex items-center gap-2 mt-1 animate-in fade-in">
              <span className="text-[9px] font-black uppercase tracking-[0.4em] text-primary">BUSINESS</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="scrollbar-none px-2">
        <SidebarMenu className="gap-1">
          {currentNavItems.map((item: any, index: number) => (
            <NavItem 
                key={`${item.id || item.label}-${index}`} 
                item={item} 
                userRole={currentUser.role} 
                currentPath={pathname}
                state={state}
            />
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-6 mt-auto">
        <div className="flex items-center justify-center py-4 opacity-20 hover:opacity-50 transition-opacity">
            <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest border-primary/20 text-primary">Nova v1.6</Badge>
        </div>
      </SidebarFooter>
    </>
  );
}
