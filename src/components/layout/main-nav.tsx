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
  Banknote,
  Handshake,
  Settings,
  Settings2,
  ChevronDown,
  Layers,
  UserX,
  FileBarChart
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
            "my-2 h-14 rounded-[1.8rem] transition-all duration-500 border border-transparent",
            isActive 
              ? "active-capsule" 
              : "glass-capsule hover:bg-white/30"
          )}
        >
          <Link href={item.href} onClick={() => setOpenMobile(false)} className="flex items-center justify-between w-full px-4">
            <div className="w-4" /> {/* Empty div to balance space where caret would be */}
            <span className={cn("flex-1 text-center truncate text-sm", isActive ? "text-[#1e1b4b]" : "text-white")}>
                {item.label}
            </span>
            {Icon && <Icon className={cn("size-5 shrink-0", isActive ? "text-[#1e1b4b]" : "text-white/80")} strokeWidth={isActive ? 3 : 2} />}
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
                "my-2 h-14 rounded-[1.8rem] transition-all duration-500 border border-transparent",
                isActive 
                  ? "active-capsule" 
                  : "glass-capsule hover:bg-white/30"
              )}
            >
              <div className="flex items-center justify-between w-full px-4">
                <ChevronDown className={cn("h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180", isActive ? "text-[#1e1b4b]/50" : "text-white/50")} />
                <span className={cn("flex-1 text-center truncate text-sm", isActive ? "text-[#1e1b4b]" : "text-white")}>
                    {item.label}
                </span>
                {Icon && <Icon className={cn("size-5 shrink-0", isActive ? "text-[#1e1b4b]" : "text-white/80")} strokeWidth={isActive ? 3 : 2} />}
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
                          ? "bg-white/90 text-[#1e1b4b] font-black shadow-md" 
                          : "sub-capsule hover:bg-white/20 text-white/80"
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
          <span className="text-3xl font-black tracking-tighter text-white drop-shadow-lg">Nova ERP</span>
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mt-1">SOVEREIGN SUITE</span>
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
        <div className="bg-white/20 border border-white/30 rounded-[2.5rem] p-5 flex items-center shadow-2xl backdrop-blur-xl group hover:bg-white/30 transition-all">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-[#1e1b4b] font-black shadow-lg border-2 border-white/40">
                {currentUser.fullName?.charAt(0) || 'N'}
            </div>
            <div className="mr-4 text-right overflow-hidden group-data-[state=collapsed]:hidden">
                <p className="text-sm font-black truncate text-white leading-none mb-1">{currentUser.fullName}</p>
                <p className="text-[9px] truncate font-black uppercase tracking-widest text-white/50">{currentUser.role} ROLE</p>
            </div>
        </div>
      </SidebarFooter>
    </>
  );
}