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
  Home,
  Briefcase,
  Users,
  Search,
  LineChart,
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
  ShieldCheck,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AuthenticatedUser } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';

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
        { href: '/dashboard/reports/upsell-opportunities', label: 'فرص بيعية إضافية', icon: ArrowUpRight },
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
      label: 'المطالبات المالية', 
      icon: Wallet, 
      roles: ['Developer', 'Admin', 'Accountant'],
      hrefPrefix: '/dashboard/accounting',
      children: [
        { href: '/dashboard/accounting/chart-of-accounts', label: 'شجرة الحسابات', icon: Layers },
        { href: '/dashboard/accounting/journal-entries', label: 'قيود اليومية العامة', icon: BookOpen },
        { href: '/dashboard/accounting/cash-receipts', label: 'سندات القبض', icon: ArrowDownLeft },
        { href: '/dashboard/accounting/payment-vouchers', label: 'سندات الصرف', icon: ArrowUpRight },
      ]
    },
  ],
  en: [
    { href: '/dashboard', label: 'Dashboard', icon: Home, roles: ['Developer', 'Admin', 'Engineer', 'Accountant', 'Secretary', 'HR'] },
  ]
};

function NavItem({ item, userRole, currentPath }: { item: any, userRole: string, currentPath: string }) {
  const { setOpenMobile } = useSidebar();
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
            "my-2 h-14 rounded-[1.8rem] transition-all duration-500",
            isActive 
              ? "active-capsule" 
              : "glass-capsule"
          )}
        >
          <Link href={item.href} onClick={() => setOpenMobile(false)} className="flex items-center justify-between w-full px-4">
            <div className="w-4" />
            <span className={cn("flex-1 text-center truncate text-sm", isActive ? "text-[#020617]" : "text-white")}>
                {item.label}
            </span>
            {Icon && <Icon className={cn("size-5 shrink-0", isActive ? "text-[#020617]" : "text-white/80")} strokeWidth={isActive ? 3 : 2} />}
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
                "my-2 h-14 rounded-[1.8rem] transition-all duration-500",
                isActive 
                  ? "active-capsule" 
                  : "glass-capsule"
              )}
            >
              <div className="flex items-center justify-between w-full px-4">
                <ChevronDown className={cn("h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180", isActive ? "text-[#020617]/50" : "text-white/50")} />
                <span className={cn("flex-1 text-center truncate text-sm", isActive ? "text-[#020617]" : "text-white")}>
                    {item.label}
                </span>
                {Icon && <Icon className={cn("size-5 shrink-0", isActive ? "text-[#020617]" : "text-white/80")} strokeWidth={isActive ? 3 : 2} />}
              </div>
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub className="mt-1 mb-2 space-y-2 border-none pr-0 pl-0">
              {item.children.map((child: any) => {
                const isChildActive = currentPath === child.href;
                return (
                  <SidebarMenuSubItem key={child.href} className="px-4">
                    <SidebarMenuSubButton isActive={isChildActive} asChild className={cn(
                        "rounded-2xl py-3 h-11 transition-all border border-transparent",
                        isChildActive 
                          ? "bg-white/90 text-[#020617] font-black shadow-md" 
                          : "sub-capsule hover:bg-white/10 text-white/60"
                    )}>
                      <Link href={child.href} onClick={() => setOpenMobile(false)} className="flex items-center justify-center w-full">
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
        <div className="flex flex-col items-center">
          <span className="text-3xl font-black text-white tracking-tighter drop-shadow-[0_0_15px_rgba(56,189,248,0.5)]">Nova ERP</span>
          <div className="flex items-center gap-2 mt-1">
              <Zap className="h-3 w-3 text-primary animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-primary">Quantum Suite</span>
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
        <div className="bg-slate-950/40 border border-white/10 rounded-[2.5rem] p-5 flex items-center shadow-2xl backdrop-blur-3xl group hover:border-primary/30 transition-all">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white font-black shadow-lg border-2 border-white/20">
                {currentUser.fullName?.charAt(0) || 'N'}
            </div>
            <div className="mr-4 text-right overflow-hidden group-data-[state=collapsed]:hidden">
                <p className="text-sm font-black truncate text-white leading-none mb-1">{currentUser.fullName}</p>
                <p className="text-[9px] truncate font-black uppercase tracking-widest text-primary">Sovereign Mode</p>
            </div>
        </div>
      </SidebarFooter>
    </>
  );
}
