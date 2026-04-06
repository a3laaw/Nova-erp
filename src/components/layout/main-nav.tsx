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
  Home,
  UsersRound,
  PencilRuler,
  Briefcase,
  Landmark,
  ShoppingBag,
  LayoutGrid,
  ChevronLeft,
  Settings2,
  FileSignature,
  Search,
  BookOpen,
  ArrowDownLeft,
  ArrowUpRight,
  UserCheck,
  ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AuthenticatedUser } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';

const navItems = {
  ar: [
    { href: '/dashboard', label: 'لوحة التحكم المركزية', icon: Home, roles: ['Developer', 'Admin', 'Engineer', 'Accountant', 'Secretary', 'HR'] },
    { 
      label: 'علاقات العملاء (CRM)', 
      icon: UsersRound, 
      roles: ['Developer', 'Admin', 'Engineer', 'Accountant', 'HR', 'Secretary'],
      hrefPrefix: '/dashboard/clients',
      children: [
        { href: '/dashboard/clients?view=registered', label: 'ملفات العملاء', icon: UsersRound },
        { href: '/dashboard/clients?view=prospective', label: 'العملاء المحتملون', icon: Search },
        { href: '/dashboard/reports/prospective-clients', label: 'تحليل المحتملين', icon: UserCheck },
      ]
    },
    { 
      label: 'المقاولات والقياسات',
      icon: PencilRuler,
      roles: ['Developer', 'Admin', 'Engineer', 'Accountant'],
      hrefPrefix: '/dashboard/construction',
      children: [
        { href: '/dashboard/contracts', label: 'عروض الأسعار والعقود', icon: FileSignature },
        { href: '/dashboard/construction/projects', label: 'المشاريع التنفيذية', icon: Briefcase },
        { href: '/dashboard/construction/field-visits', label: 'الزيارات الميدانية', icon: PencilRuler },
      ]
    },
    { 
      label: 'المقاولين من الباطن', 
      icon: Briefcase, 
      roles: ['Developer', 'Admin', 'Accountant', 'Engineer'],
      hrefPrefix: '/dashboard/construction/subcontractors',
      children: [
        { href: '/dashboard/construction/subcontractors', label: 'إدارة المقاولين', icon: UsersRound },
        { href: '/dashboard/construction/subcontractors/certificates', label: 'شهادات الإنجاز', icon: Landmark },
      ]
    },
    { 
      label: 'المحاسبة', 
      icon: Landmark, 
      roles: ['Developer', 'Admin', 'Accountant'],
      hrefPrefix: '/dashboard/accounting',
      children: [
        { href: '/dashboard/accounting/chart-of-accounts', label: 'شجرة الحسابات', icon: LayoutGrid },
        { href: '/dashboard/accounting/journal-entries', label: 'قيود اليومية العامة', icon: BookOpen },
        { href: '/dashboard/accounting/cash-receipts', label: 'سندات القبض', icon: ArrowDownLeft },
        { href: '/dashboard/accounting/payment-vouchers', label: 'سندات الصرف', icon: ArrowUpRight },
      ]
    },
    { 
      label: 'إدارة المشتريات', 
      icon: ShoppingBag, 
      roles: ['Developer', 'Admin', 'Accountant', 'Purchasing'],
      hrefPrefix: '/dashboard/purchasing',
      children: [
        { href: '/dashboard/purchasing/requests', label: 'طلبات الشراء', icon: FileSignature },
        { href: '/dashboard/purchasing/rfqs', label: 'طلبات التسعير', icon: Search },
        { href: '/dashboard/purchasing/purchase-orders', label: 'أوامر الشراء', icon: ShoppingBag },
      ]
    },
    { 
      label: 'المخازن والمستودعات', 
      icon: LayoutGrid, 
      roles: ['Developer', 'Admin', 'Accountant', 'Warehouse'],
      hrefPrefix: '/dashboard/warehouse',
      children: [
        { href: '/dashboard/warehouse/items', label: 'دليل الأصناف', icon: LayoutGrid },
        { href: '/dashboard/warehouse/grns', label: 'أذونات الاستلام', icon: ShieldCheck },
        { href: '/dashboard/warehouse/material-issue', label: 'صرف المواد', icon: ArrowUpRight },
      ]
    },
    { 
      label: 'الإعدادات', 
      icon: Settings2, 
      roles: ['Developer', 'Admin'],
      hrefPrefix: '/dashboard/settings',
      children: [
        { href: '/dashboard/settings/users', label: 'المستخدمين', icon: UsersRound },
        { href: '/dashboard/settings/branding', label: 'العلامة التجارية', icon: FileSignature },
        { href: '/dashboard/settings/reference-data', label: 'البيانات المرجعية', icon: LayoutGrid },
      ]
    },
  ],
  en: [
    { href: '/dashboard', label: 'Dashboard', icon: Home, roles: ['Developer', 'Admin', 'Engineer', 'Accountant', 'Secretary', 'HR'] },
    { 
      label: 'Accounting', 
      icon: Landmark, 
      roles: ['Developer', 'Admin', 'Accountant'], 
      hrefPrefix: '/dashboard/accounting', 
      children: [
        { href: '/dashboard/accounting/chart-of-accounts', label: 'Chart of Accounts' }
      ] 
    }
  ]
};

function SidebarMenuButton({ 
  isActive, 
  tooltip, 
  children, 
  asChild, 
  className, 
  ...props 
}: any) {
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
        <TooltipContent side="left" align="center" className="font-black bg-[#1e1b4b] text-white border-none rounded-lg shadow-xl">
          {tooltip}
        </TooltipContent>
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
            {/* Structural spacers to ensure identical centering with dropdown icons */}
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
                <TooltipContent side="left" className="font-black bg-[#1e1b4b] text-white border-none rounded-lg">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenuContent side="left" align="start" className="w-56 rounded-2xl p-2 shadow-2xl bg-white/95 backdrop-blur-xl border-none" dir="rtl">
              <DropdownMenuLabel className="font-black text-[#1e1b4b] text-xs px-3 py-2 border-b mb-1">{item.label}</DropdownMenuLabel>
              {item.children.map((child: any) => (
                <DropdownMenuItem key={child.href} asChild className="rounded-xl py-2.5 cursor-pointer">
                  <Link href={child.href} className="flex items-center justify-between w-full text-[#1e1b4b]">
                    <span className="font-bold text-xs">{child.label}</span>
                    {child.icon && <child.icon className="h-4 w-4 ml-3 opacity-40 text-[#1e1b4b]" />}
                  </Link>
                </DropdownMenuItem>
              ))}
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
