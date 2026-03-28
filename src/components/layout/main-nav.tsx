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
  ListTree,
  Layers
} from 'lucide-react';
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
      ]
    },
    { 
      label: 'المقاولات والقياسات',
      icon: Construction,
      roles: ['Developer', 'Admin', 'Engineer', 'Accountant'],
      hrefPrefix: '/dashboard/construction',
      children: [
        { href: '/dashboard/contracts', label: 'عروض الأسعار والعقود', icon: FileSignature },
        { href: '/dashboard/construction/projects', label: 'المشاريع التنفيذية', icon: Briefcase },
        { href: '/dashboard/construction/field-visits', label: 'الزيارات الميدانية', icon: MapPin },
      ]
    },
    { 
      label: 'المحاسبة والمالية', 
      icon: Wallet, 
      roles: ['Developer', 'Admin', 'Accountant'],
      hrefPrefix: '/dashboard/accounting',
      children: [
        { href: '/dashboard/accounting/chart-of-accounts', label: 'شجرة الحسابات', icon: Network },
        { href: '/dashboard/accounting/journal-entries', label: 'قيود اليومية العامة', icon: BookOpen },
        { href: '/dashboard/accounting/cash-receipts', label: 'سندات القبض', icon: ArrowDownLeft },
        { href: '/dashboard/accounting/payment-vouchers', label: 'سندات الصرف', icon: ArrowUpRight },
      ]
    },
    { 
      label: 'الموارد البشرية', 
      icon: Handshake, 
      roles: ['Developer', 'Admin', 'HR'],
      hrefPrefix: '/dashboard/hr',
      children: [
        { href: '/dashboard/hr/employees', label: 'ملفات الموظفين', icon: Users },
        { href: '/dashboard/hr/payroll', label: 'مسيرات الرواتب', icon: Banknote },
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

  if (item.roles && !item.roles.includes(userRole)) return null;

  const isActive = item.hrefPrefix ? currentPath.startsWith(item.hrefPrefix) : (item.href ? currentPath === item.href : false);

  if (!item.children && item.href) {
    return (
      <SidebarMenuItem className="px-4">
        <SidebarMenuButton 
          isActive={isActive} 
          asChild 
          className={cn(
            "my-1.5 h-14 rounded-2xl transition-all duration-500",
            isActive 
              ? "active-item-glow text-[#1e1b4b] font-black" 
              : "hover:bg-white/20 text-[#1e1b4b]/70"
          )}
        >
          <Link href={item.href} onClick={() => setOpenMobile(false)} className="flex items-center gap-3">
            {Icon && <Icon className={cn("size-6 shrink-0", isActive ? "text-[#1e1b4b]" : "text-[#1e1b4b]/80")} strokeWidth={3} />}
            <span className="truncate text-sm">{item.label}</span>
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
                "my-1.5 h-14 rounded-2xl transition-all duration-500",
                isActive 
                  ? "active-item-glow text-[#1e1b4b] font-black" 
                  : "hover:bg-white/20 text-[#1e1b4b]/70"
              )}
            >
              {Icon && <Icon className={cn("size-6 shrink-0", isActive ? "text-[#1e1b4b]" : "text-[#1e1b4b]/80")} strokeWidth={3} />}
              <span className="truncate text-sm flex-1">{item.label}</span>
              <ChevronDown className={cn("h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180 opacity-50", isActive ? "text-[#1e1b4b]" : "text-[#1e1b4b]/50")} />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub className="mt-1 mb-2 pr-10 space-y-2 border-none">
              {item.children.map((child: any) => {
                const isChildActive = currentPath === child.href;
                return (
                  <SidebarMenuSubItem key={child.href}>
                    <SidebarMenuSubButton isActive={isChildActive} asChild className={cn(
                        "rounded-xl py-2 h-auto transition-all font-bold bg-transparent",
                        isChildActive ? "text-[#1e1b4b] font-black" : "text-[#1e1b4b]/60 hover:text-[#1e1b4b]"
                    )}>
                      <Link href={child.href} onClick={() => setOpenMobile(false)} className="flex items-center gap-2">
                        {isChildActive && <span className="w-1.5 h-1.5 bg-[#1e1b4b] rounded-full ml-2" />}
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
  
  const currentNavItems = navItems[language] || navItems.ar;

  return (
    <>
      <SidebarHeader className="p-8 mb-4">
        <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-3xl font-black tracking-tighter text-[#1e1b4b]">Nova</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#1e1b4b]/50 mt-1">Purple Suite</span>
            </div>
            <div className="w-10 h-10 bg-white/30 rounded-2xl flex items-center justify-center border border-white/40 shadow-sm">
              <Layers className="h-5 w-5 text-[#1e1b4b]" />
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
        <div className="bg-white/20 border border-white/30 rounded-[2rem] p-4 flex items-center shadow-xl backdrop-blur-md">
            <div className="w-12 h-12 bg-purple-200 rounded-2xl flex items-center justify-center text-[#1e1b4b] font-black shadow-md border border-white/40">
                {currentUser.fullName?.charAt(0) || 'N'}
            </div>
            <div className="mr-4 text-right overflow-hidden group-data-[state=collapsed]:hidden">
                <p className="text-sm font-black truncate text-[#1e1b4b]">{currentUser.fullName}</p>
                <p className="text-[10px] truncate font-black uppercase tracking-widest text-[#1e1b4b]/50">{currentUser.role}</p>
            </div>
        </div>
      </SidebarFooter>
    </>
  );
}
