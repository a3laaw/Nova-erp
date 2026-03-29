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
  Zap,
  LayoutGrid
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AuthenticatedUser } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';

const navItems = {
  ar: [
    { href: '/dashboard', label: 'لوحة التحكم المركزية', icon: LayoutGrid, roles: ['Developer', 'Admin', 'Engineer', 'Accountant', 'Secretary', 'HR'] },
    { 
      label: 'علاقات العملاء (CRM)', 
      icon: Users, 
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
            "my-2 h-12 rounded-full transition-all duration-500",
            isActive 
              ? "nav-capsule-active" 
              : "nav-capsule"
          )}
        >
          <Link href={item.href} onClick={() => setOpenMobile(false)} className="flex items-center justify-between w-full px-4">
            <span className="flex-1 text-right truncate text-sm font-black">
                {item.label}
            </span>
            {Icon && <Icon className={cn("size-5 shrink-0", isActive ? "text-[#020617]" : "text-white/60")} strokeWidth={3} />}
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
                "my-2 h-12 rounded-full transition-all duration-500",
                isActive 
                  ? "nav-capsule-active" 
                  : "nav-capsule"
              )}
            >
              <div className="flex items-center justify-between w-full px-4">
                <ChevronDown className={cn("h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180", isActive ? "text-[#020617]/40" : "text-white/30")} />
                <span className="flex-1 text-right truncate text-sm font-black">
                    {item.label}
                </span>
                {Icon && <Icon className={cn("size-5 shrink-0", isActive ? "text-[#020617]" : "text-white/60")} strokeWidth={3} />}
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
                          ? "bg-white/90 text-[#020617] font-black shadow-lg" 
                          : "bg-white/5 hover:bg-white/10 text-white/50"
                    )}>
                      <Link href={child.href} onClick={() => setOpenMobile(false)}>
                        <span className="text-[11px] font-bold truncate">{child.label}</span>
                        {child.icon && <child.icon className="h-3 w-3 opacity-40" />}
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
      <SidebarHeader className="p-8 mb-6">
        <div className="flex flex-col items-center">
          <span className="text-3xl font-black text-white tracking-tighter drop-shadow-[0_0_20px_rgba(56,189,248,0.6)]">Nova ERP</span>
          <div className="flex items-center gap-2 mt-1">
              <Zap className="h-3 w-3 text-primary animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-[0.4em] text-primary/80">Quantum Suite</span>
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
        <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-5 flex items-center shadow-2xl backdrop-blur-3xl group hover:border-primary/40 transition-all cursor-pointer">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-[#020617] font-black shadow-xl border-2 border-white/20">
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
