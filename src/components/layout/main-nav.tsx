'use client';

import React, { useMemo } from 'react';
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
  Sparkles,
  History,
  Coins,
  Layers,
  HandCoins,
  Waves,
  Lock
} from 'lucide-react';
import { cn, getTenantPath } from '@/lib/utils';
import type { AuthenticatedUser } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useFirebase, useDocument } from '@/firebase';
import { Badge } from '@/components/ui/badge';

/**
 * القائمة الجانبية الموحدة (MainNav V146.2):
 * - تم إصلاح خطأ Badge is not defined.
 * - ربط ذكي بمصفوفة الصلاحيات السيادية للتحكم في ظهور الموديولات.
 */
const navItems = {
  ar: [
    { id: 'dashboard', href: '/dashboard', label: 'الرئيسية', icon: LayoutGrid },
    { 
      id: 'clients',
      label: 'إدارة العملاء',
      icon: UsersRound,
      hrefPrefix: '/dashboard/clients',
      children: [
        { href: '/dashboard/clients?view=registered', label: 'ملفات العملاء', icon: UsersRound },
        { href: '/dashboard/clients?view=prospective', label: 'المحتملون', icon: Search },
      ]
    },
    { 
      id: 'contracts',
      label: 'المبيعات والعقود',
      icon: FileSignature,
      hrefPrefix: '/dashboard/contracts',
      children: [
        { id: 'quotations', href: '/dashboard/accounting/quotations', label: 'عروض الأسعار', icon: Calculator },
        { id: 'contracts', href: '/dashboard/contracts', label: 'العقود المبرمة', icon: FileSignature },
      ]
    },
    { 
      id: 'tech_workflow',
      label: 'المقاولات والميدان',
      icon: PencilRuler,
      hrefPrefix: '/dashboard/construction',
      children: [
        { id: 'tech_workflow', href: '/dashboard/construction/projects', label: 'المشاريع التنفيذية', icon: Briefcase },
        { id: 'site_visits', href: '/dashboard/construction/field-visits', label: 'الزيارات الميدانية', icon: MapPin },
        { id: 'wbs_mgmt', href: '/dashboard/construction/boq', label: 'جداول الكميات', icon: ClipboardList },
        { id: 'payment_apps', href: '/dashboard/construction/payment-applications', label: 'المستخلصات', icon: Coins },
      ]
    },
    { 
      id: 'vouchers',
      label: 'المالية والحسابات', 
      icon: Landmark, 
      hrefPrefix: '/dashboard/accounting',
      children: [
        { id: 'coa', href: '/dashboard/accounting/chart-of-accounts', label: 'دليل الحسابات', icon: ListTree },
        { id: 'journal_entries', href: '/dashboard/accounting/journal-entries', label: 'قيود اليومية', icon: BookOpen },
        { id: 'vouchers', href: '/dashboard/accounting/cash-receipts', label: 'سندات القبض', icon: ArrowDownLeft },
        { id: 'vouchers', href: '/dashboard/accounting/payment-vouchers', label: 'سندات الصرف', icon: ArrowUpRight },
        { id: 'financial_reports', href: '/dashboard/accounting/reports', label: 'التقارير المالية', icon: PieChart },
        { id: 'liquidity_radar', href: '/dashboard/accounting/financial-forecast', label: 'رادار السيولة', icon: Waves },
      ]
    },
    { 
      id: 'hr_employees',
      label: 'الموارد البشرية', 
      icon: Users, 
      hrefPrefix: '/dashboard/hr',
      children: [
        { id: 'hr_employees', href: '/dashboard/hr/employees', label: 'بيانات الموظفين', icon: UserCheck },
        { id: 'payroll_leaves', href: '/dashboard/hr/payroll', label: 'الرواتب والإجازات', icon: Banknote },
        { id: 'tasks_scheduling', href: '/dashboard/hr/permissions', label: 'الاستئذانات', icon: Clock },
      ]
    },
    { 
      id: 'settings',
      label: 'إعدادات النظام', 
      icon: Settings2, 
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

function NavItem({ item, userRole, currentPath, matrix }: { item: any, userRole: string, currentPath: string, matrix: any }) {
  const { setOpenMobile } = useSidebar();
  const Icon = item.icon;

  const hasAccess = useMemo(() => {
    if (userRole === 'Developer' || userRole === 'Admin') return true;
    const permission = matrix[`${userRole}-${item.id}`];
    return permission && permission !== 'none';
  }, [userRole, item.id, matrix]);

  if (!hasAccess) return null;

  const isAnyChildActive = useMemo(() => {
    if (!item.children) return false;
    return item.children.some((child: any) => {
        const baseUrl = child.href.split('?')[0];
        return currentPath.startsWith(baseUrl);
    });
  }, [item.children, currentPath]);

  const isActive = item.href ? currentPath === item.href : (item.hrefPrefix ? currentPath.startsWith(item.hrefPrefix) : isAnyChildActive);

  if (!item.children && item.href) {
    return (
      <SidebarMenuItem className="px-4">
        <BaseSidebarMenuButton 
          isActive={isActive} 
          asChild 
          className={cn("nav-item-box my-1.5 h-14", isActive && "nav-item-box-active")}
        >
          <Link href={item.href} onClick={() => setOpenMobile(false)} className="flex items-center justify-between w-full h-full px-4">
            <span className="flex-1 text-right truncate text-[14px] font-black group-data-[collapsible=icon]:hidden">{item.label}</span>
            {Icon && <Icon className="size-6 shrink-0 ml-3 group-data-[collapsible=icon]:ml-0" />}
          </Link>
        </BaseSidebarMenuButton>
      </SidebarMenuItem>
    );
  }
  
  if (item.children) {
    return (
      <Collapsible defaultOpen={isActive} className="group/collapsible px-4">
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <BaseSidebarMenuButton isActive={isActive} className={cn("nav-item-box my-1.5 h-14", isActive && "nav-item-box-active")}>
              <div className="flex items-center justify-between w-full h-full px-4">
                <ChevronLeft className={cn("h-4 w-4 transition-transform group-data-[state=open]/collapsible:-rotate-90 opacity-40", isActive ? "text-black" : "text-white")} />
                <span className="text-right truncate text-[14px] font-black flex-1 pr-2 group-data-[collapsible=icon]:hidden">{item.label}</span>
                {Icon && <Icon className="size-6 shrink-0 ml-3" />}
              </div>
            </BaseSidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub className="mt-1 mb-2 space-y-1.5 sidebar-no-offset">
              {item.children.map((child: any) => {
                const isChildActive = currentPath === child.href.split('?')[0];
                return (
                  <SidebarMenuSubItem key={child.href}>
                    <SidebarMenuSubButton isActive={isChildActive} asChild className={cn("rounded-xl py-2 h-11 border-none px-4", isChildActive ? "nav-item-box-active font-black" : "bg-white/60 hover:bg-orange-50")}>
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

export function MainNav({ currentUser }: { currentUser: AuthenticatedUser, onLogout: () => void }) {
  const pathname = usePathname();
  const { language } = useLanguage();
  const { firestore } = useFirebase();
  const tenantId = currentUser?.currentCompanyId;

  // جلب مصفوفة الصلاحيات
  const matrixPath = useMemo(() => tenantId ? `companies/${tenantId}/settings/permissions_matrix` : null, [tenantId]);
  const { data: matrixDoc } = useDocument<any>(firestore, matrixPath);
  const matrix = matrixDoc?.data || {};

  const currentNavItems = (navItems as any)[language] || navItems.ar;

  return (
    <>
      <SidebarHeader className="p-6 mb-8 group-data-[collapsible=icon]:p-3">
        <div className="flex flex-col items-center">
          <span className="text-3xl font-black text-[#1e1b4b] tracking-tighter">Nova</span>
          <div className="flex items-center gap-2 mt-1 group-data-[collapsible=icon]:hidden">
              <span className="text-[9px] font-black uppercase tracking-[0.4em] text-primary">BUSINESS</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="scrollbar-none">
        <SidebarMenu className="gap-1">
          {currentNavItems.map((item: any, index: number) => (
            <NavItem 
                key={`${item.id}-${index}`} 
                item={item} 
                userRole={currentUser.role} 
                currentPath={pathname}
                matrix={matrix}
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