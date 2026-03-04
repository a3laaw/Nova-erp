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
  Calendar,
  Wallet,
  Warehouse,
  Settings,
  HeartHandshake,
  FileText,
  ChevronDown,
  ShoppingCart,
  LogOut,
  LineChart,
  Construction,
  UserSearch,
  FileCheck,
  Building2,
  Building,
  ArrowLeftRight,
  Ban,
  ArrowUpFromLine,
  Clock,
  Hourglass,
  UserX,
  ShoppingBag,
  ClipboardList,
  HardHat,
  Network,
  BookOpen,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  BarChart3,
  TrendingUp,
  Landmark,
  CalendarX,
  Banknote,
  FileBarChart,
  FileSearch,
  Truck,
  Settings2,
  FileSignature,
  Tags,
  PieChart,
  History,
  DollarSign,
  Store,
  FileStack,
  Coins,
  Calculator,
  RotateCcw,
  LayoutGrid,
  MapPin,
  Scale,
  Package,
  Landmark as BankIcon,
  CalendarClock,
  ShieldCheck
} from 'lucide-react';
import { Logo } from './logo';
import { cn } from '@/lib/utils';
import type { AuthenticatedUser } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useBranding } from '@/context/branding-context';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const navItems = {
  ar: [
    { href: '/dashboard', label: 'لوحة التحكم العامة', icon: Home, roles: ['Admin', 'Engineer', 'Accountant', 'Secretary', 'HR'] },
    
    { 
      label: 'علاقات العملاء (CRM)', 
      icon: LineChart, 
      roles: ['Admin', 'Engineer', 'Accountant', 'HR', 'Secretary'],
      hrefPrefix: '/dashboard/clients',
      children: [
        { href: '/dashboard/clients?view=registered', label: 'ملفات العملاء', icon: Users },
        { href: '/dashboard/clients?view=prospective', label: 'العملاء المحتملون', icon: UserSearch },
        { href: '/dashboard/reports/prospective-clients', label: 'تحليل المحتملين', icon: UserX },
        { href: '/dashboard/reports/upsell-opportunities', label: 'فرص بيعية إضافية', icon: ShoppingBag },
      ]
    },

    { 
      label: 'التعاقد والمقايسات',
      icon: FileSignature,
      roles: ['Admin', 'Engineer', 'Accountant'],
      hrefPrefix: '/dashboard/contracts',
      children: [
        { href: '/dashboard/accounting/quotations', label: 'عروض الأسعار', icon: FileText },
        { href: '/dashboard/contracts', label: 'العقود المبرمة', icon: FileSignature },
        { href: '/dashboard/construction/boq', label: 'مكتبة المقايسات (BOQ)', icon: ClipboardList },
      ]
    },

    { 
      label: 'المشاريع والتنفيذ',
      icon: Construction,
      roles: ['Admin', 'Engineer'],
      hrefPrefix: '/dashboard/construction',
      children: [
        { href: '/dashboard/construction/projects', label: 'المشاريع التنفيذية', icon: Briefcase },
        { href: '/dashboard/construction/field-visits', label: 'الزيارات الميدانية', icon: MapPin },
        { href: '/dashboard/construction/schedules', label: 'الجداول الزمنية', icon: LayoutGrid },
        { href: '/dashboard/warehouse/material-issue', label: 'صرف مواد المواقع', icon: ArrowUpFromLine },
        { href: '/dashboard/reports/delayed-stages', label: 'المهام المتأخرة', icon: Clock },
        { href: '/dashboard/reports/stalled-stages', label: 'المراحل الخاملة', icon: Hourglass },
      ]
    },

    { 
      label: 'مقاولين الباطن',
      icon: HardHat,
      roles: ['Admin', 'Engineer', 'Accountant'],
      hrefPrefix: '/dashboard/construction/subcontractors',
      children: [
        { href: '/dashboard/construction/subcontractors', label: 'سجل المقاولين', icon: Users },
        { href: '/dashboard/construction/subcontractors/certificates', label: 'شهادات إنجاز الأعمال', icon: FileCheck },
      ]
    },

    { 
      label: 'المطالبات المالية',
      icon: Coins,
      roles: ['Admin', 'Accountant'],
      hrefPrefix: '/dashboard/construction/payment-applications',
      children: [
        { href: '/dashboard/construction/payment-applications/new', label: 'إصدار مستخلص أعمال', icon: Coins },
        { href: '/dashboard/accounting/client-statements', label: 'مديونيات العملاء', icon: DollarSign },
      ]
    },

    { 
      label: 'إدارة المشتريات',
      icon: ShoppingCart,
      roles: ['Admin', 'Accountant', 'Engineer'],
      hrefPrefix: '/dashboard/purchasing',
      children: [
        { href: '/dashboard/purchasing/direct-invoice', label: 'فاتورة مشتريات مباشرة', icon: ShoppingBag },
        { href: '/dashboard/purchasing/requests', label: 'طلب شراء داخلي (PR)', icon: FileStack },
        { href: '/dashboard/purchasing/rfqs', label: 'طلبات التسعير (RFQ)', icon: FileSearch },
        { href: '/dashboard/purchasing/purchase-orders', label: 'أوامر الشراء المؤكدة', icon: ShoppingCart },
        { href: '/dashboard/purchasing/vendors', label: 'سجل الموردين', icon: Truck },
        { href: '/dashboard/purchasing/lc', label: 'اعتمادات مستندية', icon: BankIcon },
      ]
    },

    { 
      label: 'المخازن والمستودعات',
      icon: Warehouse,
      roles: ['Admin', 'Accountant', 'Engineer'],
      hrefPrefix: '/dashboard/warehouse',
      children: [
        { href: '/dashboard/warehouse/grns', label: 'أذونات استلام البضاعة', icon: FileCheck },
        { href: '/dashboard/warehouse/items', label: 'دليل الأصناف والخدمات', icon: Package },
        { href: '/dashboard/warehouse/warehouses', label: 'المستودعات والأفرع', icon: Building2 },
        { href: '/dashboard/warehouse/transfers', label: 'تحويلات بين المخازن', icon: ArrowLeftRight },
        { href: '/dashboard/warehouse/adjustments', label: 'تسويات العجز والتلف', icon: Ban },
        { href: '/dashboard/warehouse/reports/balances', label: 'تقرير أرصدة الأصناف', icon: Package },
      ]
    },

    { 
      label: 'المحاسبة والمالية', 
      icon: Wallet, 
      roles: ['Admin', 'Accountant'],
      hrefPrefix: '/dashboard/accounting',
      children: [
        { href: '/dashboard/accounting/chart-of-accounts', label: 'شجرة الحسابات', icon: Network },
        { href: '/dashboard/accounting/journal-entries', label: 'قيود اليومية العامة', icon: BookOpen },
        { href: '/dashboard/accounting/cash-receipts', label: 'سندات القبض', icon: ArrowDownLeft },
        { href: '/dashboard/accounting/payment-vouchers', label: 'سندات الصرف', icon: ArrowUpRight },
        { href: '/dashboard/accounting/recurring', label: 'أتمتة الالتزامات الدورية', icon: CalendarClock },
        { href: '/dashboard/accounting/reconciliation', label: 'التسويات البنكية', icon: Scale },
        { href: '/dashboard/accounting/income-statement', label: 'قائمة الدخل (P&L)', icon: TrendingUp },
        { href: '/dashboard/accounting/balance-sheet', label: 'قائمة المركز المالي', icon: Landmark },
        { href: '/dashboard/accounting/reports', label: 'التقارير التحليلية', icon: PieChart },
      ]
    },

    { 
      label: 'شؤون الموظفين (HR)', 
      icon: HeartHandshake, 
      roles: ['Admin', 'HR'],
      hrefPrefix: '/dashboard/hr',
      children: [
        { href: '/dashboard/hr/employees', label: 'ملفات الموظفين', icon: Users },
        { href: '/dashboard/hr/leaves', label: 'طلبات الإجازات', icon: CalendarX },
        { href: '/dashboard/hr/permissions', label: 'طلبات الاستئذان', icon: Clock },
        { href: '/dashboard/hr/payroll', label: 'مسيرات الرواتب', icon: Banknote },
        { href: '/dashboard/hr/reports', label: 'لوحة تقارير الموارد', icon: FileBarChart },
      ]
    },

    { 
      label: 'الإعدادات', 
      icon: Settings, 
      roles: ['Admin'],
      hrefPrefix: '/dashboard/settings',
      children: [
        { href: '/dashboard/settings', label: 'الإعدادات العامة', icon: Settings2 },
        { href: '/dashboard/settings/companies', label: 'إدارة الشركات', icon: Building },
        { href: '/dashboard/settings/classifications', label: 'الفئات والتصنيفات', icon: Tags },
        { href: '/dashboard/settings/reference-data', label: 'البيانات المرجعية', icon: Network },
        { href: '/dashboard/settings/data-integrity', label: 'سلامة البيانات', icon: ShieldCheck },
      ]
    },
  ],
  en: [
    { href: '/dashboard', label: 'Dashboard', icon: Home, roles: ['Admin', 'Engineer', 'Accountant', 'Secretary', 'HR'] },
  ]
};

function NavItem({ item, userRole, currentPath }: { item: any, userRole: string, currentPath: string }) {
  const { setOpenMobile, state: sidebarState } = useSidebar();

  if (item.roles && !item.roles.includes(userRole)) {
    return null;
  }

  if (!item.children && item.href) {
    const isActive = currentPath === item.href;
    return (
      <SidebarMenuItem>
        <SidebarMenuButton isActive={isActive} asChild tooltip={item.label} className="transition-all duration-300">
          <Link href={item.href} onClick={() => setOpenMobile(false)}>
            {item.icon && <item.icon className={cn("size-5", isActive ? "text-white" : "text-sidebar-foreground")} strokeWidth={2.5} />}
            <span className={cn("group-data-[state=collapsed]:hidden", isActive ? "font-black" : "font-bold")}>{item.label}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }
  
  if (item.children) {
    const isActive = item.hrefPrefix ? currentPath.startsWith(item.hrefPrefix) : false;

    if (sidebarState === 'collapsed') {
      return (
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton as="button" isActive={isActive} tooltip={item.label} className="transition-all duration-300">
                <item.icon className="size-5" strokeWidth={2.5} />
                <span className="sr-only">{item.label}</span>
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" sideOffset={5} className="w-56" dir="rtl">
              <DropdownMenuLabel>{item.label}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {item.children.map((child: any, index: number) => {
                if (child.children) {
                  return (
                    <DropdownMenuSub key={`${child.label}-${index}`}>
                      <DropdownMenuSubTrigger>
                        <div className="flex items-center gap-2">
                            {child.icon && <child.icon className="h-4 w-4" strokeWidth={2.2} />}
                            <span>{child.label}</span>
                        </div>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent className="bg-muted/50">
                          {child.children.map((subChild: any) => (
                            <DropdownMenuItem key={subChild.href} asChild>
                              <Link href={subChild.href}>
                                <div className="flex items-center gap-2">
                                    {subChild.icon && <subChild.icon className="h-3.5 w-3.5" strokeWidth={2} />}
                                    <span>{subChild.label}</span>
                                </div>
                              </Link>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                  );
                }
                return (
                  <DropdownMenuItem key={child.href} asChild>
                    <Link href={child.href}>
                        <div className="flex items-center gap-2">
                            {child.icon && <child.icon className="h-4 w-4" strokeWidth={2.2} />}
                            <span>{child.label}</span>
                        </div>
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      );
    }
    
    return (
      <Collapsible defaultOpen={false}>
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton as="button" isActive={isActive} className="h-11 w-full justify-between pr-2 transition-all duration-300 hover:bg-primary/15 hover:scale-[1.02] active:scale-95">
              <div className='flex items-center gap-2'>
                <item.icon className={cn("size-5", isActive ? "text-white" : "text-sidebar-foreground")} strokeWidth={2.5} />
                <span className={cn("group-data-[state=collapsed]:hidden", isActive ? "font-black" : "font-bold")}>{item.label}</span>
              </div>
              <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180 group-data-[state=collapsed]:hidden opacity-50" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
        </SidebarMenuItem>
        <CollapsibleContent>
          <SidebarMenuSub className="border-r-2 border-l-0 ml-0 mr-4 pr-2 space-y-1 mt-1 border-primary/20">
            {item.children.map((child: any, index: number) => {
              const isChildActive = currentPath === child.href;
              return (
                <SidebarMenuSubItem key={child.href}>
                   <SidebarMenuSubButton isActive={isChildActive} asChild className={cn("h-9 font-bold transition-all hover:bg-primary/10 hover:translate-x-[-4px]", isChildActive && "bg-primary/20 text-white shadow-sm")}>
                        <Link href={child.href} onClick={() => setOpenMobile(false)}>
                            <div className="flex items-center gap-2">
                                {child.icon && <child.icon className="h-4 w-4" strokeWidth={2.2} />}
                                <span>{child.label}</span>
                            </div>
                        </Link>
                    </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return null;
}

export function MainNav({ currentUser, onLogout }: { currentUser: AuthenticatedUser, onLogout: () => void }) {
  const pathname = usePathname();
  const { language } = useLanguage();
  const { branding } = useBranding();
  
  const currentNavItems = navItems[language] || navItems.ar;

  return (
    <>
      <SidebarHeader className="p-4 mb-2">
        <div className="flex items-center gap-3">
            <Logo logoUrl={branding?.logo_url} companyName={branding?.company_name} className="shadow-lg border-2 border-primary/20 bg-white/5" />
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tight text-white leading-tight">{branding?.company_name || 'Nova ERP'}</span>
              <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Pulse Suite</span>
            </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-3">
        <SidebarMenu className="gap-1.5">
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
      <SidebarFooter className="p-4 border-t border-white/5 bg-black/20">
        <div className="p-1">
            <div className="flex h-auto w-full items-center justify-start rounded-2xl p-2 bg-card/50 border border-white/10 shadow-lg group hover:bg-card transition-all">
                <Avatar className="h-10 w-10 border-2 border-primary/30 transition-all group-hover:border-primary">
                    <AvatarImage src={currentUser.avatarUrl} alt={currentUser.fullName} />
                    <AvatarFallback className="bg-primary/10 text-primary font-black">{currentUser.fullName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="ml-2 mr-3 flex-grow text-right overflow-hidden group-data-[state=collapsed]:hidden">
                    <p className="text-sm font-black text-slate-50 truncate">{currentUser.fullName}</p>
                    <p className="text-[10px] text-slate-400 truncate font-bold uppercase tracking-wider">{currentUser.role}</p>
                </div>
                <button className="h-9 w-9 rounded-xl hover:bg-destructive/20 hover:text-red-400 group-data-[state=collapsed]:hidden flex items-center justify-center transition-all active:scale-90" onClick={onLogout} title="تسجيل الخروج">
                    <LogOut className="h-4 w-4"/>
                </button>
            </div>
        </div>
      </SidebarFooter>
    </>
  );
}