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
  LayoutGrid,
  ChevronLeft,
  Briefcase,
  Home,
  ShoppingCart,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AuthenticatedUser } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';

const navItems = {
  ar: [
    { href: '/dashboard', label: 'لوحة التحكم المركزية', icon: Home, roles: ['Developer', 'Admin', 'Engineer', 'Accountant', 'Secretary', 'HR'] },
    { 
      label: 'علاقات العملاء (CRM)', 
      icon: LayoutGrid, 
      roles: ['Developer', 'Admin', 'Engineer', 'Accountant', 'HR', 'Secretary'],
      hrefPrefix: '/dashboard/clients',
      children: [
        { href: '/dashboard/clients?view=registered', label: 'ملفات العملاء', icon: Users },
        { href: '/dashboard/clients?view=prospective', label: 'العملاء المحتملون', icon: Search },
        { href: '/dashboard/reports/prospective-clients', label: 'تحليل المحتملين', icon: UserX },
        { href: '/dashboard/reports/upsell-opportunities', label: 'فرص بيعية إضافية', icon: Briefcase },
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
      label: 'مقاولين الباطن', 
      icon: Home, 
      roles: ['Developer', 'Admin', 'Accountant', 'Engineer'],
      hrefPrefix: '/dashboard/construction/subcontractors',
      children: [
        { href: '/dashboard/construction/subcontractors', label: 'إدارة المقاولين', icon: Users },
        { href: '/dashboard/construction/subcontractors/certificates', label: 'شهادات الإنجاز', icon: FileSignature },
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
    { 
      label: 'إدارة المشتريات', 
      icon: ShoppingCart, 
      roles: ['Developer', 'Admin', 'Accountant', 'Purchasing'],
      hrefPrefix: '/dashboard/purchasing',
      children: [
        { href: '/dashboard/purchasing/requests', label: 'طلبات الشراء', icon: FileText },
        { href: '/dashboard/purchasing/rfqs', label: 'طلبات التسعير', icon: Search },
        { href: '/dashboard/purchasing/purchase-orders', label: 'أوامر الشراء', icon: ShoppingCart },
      ]
    },
    { 
      label: 'المخازن والمستودعات', 
      icon: LayoutGrid, 
      roles: ['Developer', 'Admin', 'Accountant', 'Warehouse'],
      hrefPrefix: '/dashboard/warehouse',
      children: [
        { href: '/dashboard/warehouse/items', label: 'دليل الأصناف', icon: Layers },
        { href: '/dashboard/warehouse/grns', label: 'أذونات الاستلام', icon: FileSignature },
        { href: '/dashboard/warehouse/material-issue', label: 'صرف المواد', icon: ArrowUpRight },
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
            <span className={cn(
                "flex-1 text-right truncate text-sm font-black text-black",
                isActive ? "text-black" : "text-black/80"
            )}>
                {item.label}
            </span>
            {Icon && <Icon className={cn("size-5 shrink-0 ml-3 text-black", isActive ? "opacity-100" : "opacity-60")} />}
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
              <div className="flex items-center justify-between w-full px-4 text-black">
                <ChevronLeft className={cn("h-4 w-4 transition-transform group-data-[state=open]/collapsible:-rotate-90 text-black", isActive ? "opacity-40" : "opacity-20")} />
                <span className={cn(
                    "text-right truncate text-sm font-black text-black",
                    isActive ? "text-black" : "text-black/80"
                )}>
                    {item.label}
                </span>
                {Icon && <Icon className={cn("size-5 shrink-0 ml-3 text-black", isActive ? "opacity-100" : "opacity-60")} />}
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
                          ? "nav-capsule-active !bg-white/80" 
                          : "nav-capsule !bg-white/20"
                    )}>
                      <Link href={child.href} onClick={() => setOpenMobile(false)}>
                        <div className="flex items-center justify-between w-full text-black">
                            <span className={cn(
                                "text-xs font-black truncate",
                                isChildActive ? "text-black" : "text-black/70"
                            )}>{child.label}</span>
                            {child.icon && <child.icon className={cn("h-4 w-4 ml-3 text-black", isChildActive ? "opacity-100" : "opacity-40")} />}
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
      <SidebarHeader className="p-8 mb-6">
        <div className="flex flex-col items-center">
          <span className="text-3xl font-black text-[#1e1b4b] tracking-tighter">Nova ERP</span>
          <div className="flex items-center gap-2 mt-1">
              <span className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-500">PURPLE SUITE</span>
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
        <div className="bg-white/40 border border-white/60 rounded-[2.5rem] p-5 flex items-center shadow-sm backdrop-blur-md group hover:bg-white/60 transition-all cursor-pointer">
            <div className="mr-4 text-right overflow-hidden group-data-[state=collapsed]:hidden flex-1">
                <p className="text-sm font-black truncate text-[#1e1b4b] leading-none mb-1">{currentUser.fullName}</p>
                <p className="text-[9px] truncate font-black uppercase tracking-widest text-slate-500">{currentUser.role}</p>
            </div>
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-[#1e1b4b] font-black shadow-lg">
                {currentUser.fullName?.charAt(0) || 'N'}
            </div>
        </div>
      </SidebarFooter>
    </>
  );
}