
# ======================================================================
# 1. Centralized Permissions Guard (src/lib/auth-utils.ts)
# ======================================================================
```typescript
import type { AuthenticatedUser } from '@/context/auth-context';

/**
 * 🛡️ The Single Source of Truth for settings access.
 * This function is the central gatekeeper that determines who can access
 * the high-level system settings.
 * 
 * @param user The authenticated user object or just their role string.
 * @returns {boolean} True if the user has administrative privileges, false otherwise.
 */
export const canAccessSettings = (user: AuthenticatedUser | { role?: string | null } | string | null | undefined): boolean => {
    if (!user) {
        return false;
    }

    const role = typeof user === 'string' ? user : user.role;

    if (!role) {
        return false;
    }

    // These roles are considered administrators and can change critical system settings.
    const permittedRoles = ['Admin', 'مدير عام', 'General Manager', 'Developer'];

    return permittedRoles.includes(role);
};
```

# ======================================================================
# 2. Top User Navigation (src/components/layout/user-nav.tsx)
# ======================================================================
```typescript
'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import type { AuthenticatedUser } from '@/context/auth-context';
import { Skeleton } from '../ui/skeleton';
import { LogOut, Settings, User } from 'lucide-react';
import { canAccessSettings } from '@/lib/auth-utils'; // <-- 🛡️ IMPORTING THE GUARD

export interface UserNavProps {
    currentUser: AuthenticatedUser;
    onLogout: () => void;
}

export function UserNav({ currentUser, onLogout }: UserNavProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient || !currentUser) {
    return (
      <Skeleton className="h-9 w-9 rounded-full" />
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full">
          <Avatar className="h-9 w-9">
            <AvatarImage src={currentUser.avatarUrl} alt={`@${currentUser.fullName}`} />
            <AvatarFallback>{currentUser.fullName.charAt(0)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount dir="rtl">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1 text-right">
            <p className="text-sm font-medium leading-none">{currentUser.fullName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {currentUser.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/settings/profile" className="flex items-center w-full justify-end cursor-pointer">
                <span>ملفي الشخصي</span>
                <User className="ml-2 h-4 w-4" />
            </Link>
          </DropdownMenuItem>
          
          {/* 🛡️ APPLYING THE GUARD */}
          {canAccessSettings(currentUser) && (
            <DropdownMenuItem asChild>
                <Link href="/dashboard/settings" className="flex items-center w-full justify-end cursor-pointer">
                    <span>إعدادات النظام</span>
                    <Settings className="ml-2 h-4 w-4" />
                </Link>
            </DropdownMenuItem>
          )}

        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onLogout} className="flex items-center w-full justify-end cursor-pointer">
            <span>خروج</span>
            <LogOut className="ml-2 h-4 w-4"/>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

# ======================================================================
# 3. Main Sidebar Navigation (src/components/layout/main-nav.tsx)
# ======================================================================
```typescript
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import * as LucideIcons from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { AuthenticatedUser } from '@/context/auth-context';
import { usePermissions } from '@/hooks/use-permissions';
import { SidebarCollapsibleItem } from './sidebar-collapsible-item';
import { canAccessSettings } from '@/lib/auth-utils'; // <-- 🛡️ IMPORTING THE GUARD

const navConfig = {
  dashboard: { id: 'dashboard', href: '/dashboard', label: 'لوحة التحكم', icon: 'LayoutGrid', requiredPermission: 'view_dashboard' },
  clients: { 
      id: 'clients', label: 'العملاء', icon: 'Users', hrefPrefix: '/dashboard/clients',
      requiredPermission: 'menu_clients',
      children: [
          { id: 'view_clients', href: '/dashboard/clients?view=registered', label: 'ملفات العملاء', icon: 'Users', requiredPermission: 'view_clients' },
          { id: 'view_prospects', href: '/dashboard/clients?view=prospective', label: 'العملاء المحتملون', icon: 'Search', requiredPermission: 'view_prospects' },
      ]
  },
  construction: { 
      id: 'construction', label: 'المقاولات', icon: 'Construction', hrefPrefix: '/dashboard/construction',
      requiredPermission: 'menu_construction',
      children: [
          { id: 'view_contracts', href: '/dashboard/contracts', label: 'عروض الأسعار والعقود', icon: 'FileSignature', requiredPermission: 'view_contracts' },
          { id: 'view_projects', href: '/dashboard/construction/projects', label: 'المشاريع التنفيذية', icon: 'Briefcase', requiredPermission: 'view_projects' },
          { id: 'view_field_visits', href: '/dashboard/construction/field-visits', label: 'الزيارات الميدانية', icon: 'MapPin', requiredPermission: 'view_field_visits' },
          { id: 'view_boq', href: '/dashboard/construction/boq', label: 'جداول الكميات (BOQ)', icon: 'ListTree', requiredPermission: 'view_boq' },
          { id: 'view_payment_applications', href: '/dashboard/construction/payment-applications', label: 'المستخلصات المالية', icon: 'Coins', requiredPermission: 'view_payment_applications' },
      ]
  },
  accounting: { 
      id: 'accounting', label: 'الإدارة المالية', icon: 'Wallet', hrefPrefix: '/dashboard/accounting',
      requiredPermission: 'menu_accounting',
      children: [
          { id: 'view_chart_of_accounts', href: '/dashboard/accounting/chart-of-accounts', label: 'شجرة الحسابات', icon: 'Layers', requiredPermission: 'view_chart_of_accounts' },
          { id: 'view_journal_entries', href: '/dashboard/accounting/journal-entries', label: 'قيود اليومية', icon: 'BookOpen', requiredPermission: 'view_journal_entries' },
          { id: 'view_cash_receipts', href: '/dashboard/accounting/cash-receipts', label: 'سندات القبض', icon: 'ArrowDownLeft', requiredPermission: 'view_cash_receipts' },
          { id: 'view_payment_vouchers', href: '/dashboard/accounting/payment-vouchers', label: 'سندات الصرف', icon: 'ArrowUpRight', requiredPermission: 'view_payment_vouchers' },
      ]
  },
  hr: { 
      id: 'hr', label: 'الموارد البشرية', icon: 'UserCheck', hrefPrefix: '/dashboard/hr',
      requiredPermission: 'menu_hr',
      children: [
          { id: 'view_employees', href: '/dashboard/hr/employees', label: 'الموظفين', icon: 'UserCheck', requiredPermission: 'view_employees' },
          { id: 'view_payroll', href: '/dashboard/hr/payroll', label: 'الرواتب', icon: 'Banknote', requiredPermission: 'view_payroll' },
      ]
  },
  reports: {
    id: 'reports', label: 'التقارير', icon: 'BarChart3', hrefPrefix: '/dashboard/reports',
    requiredPermission: 'menu_reports',
  },
  settings: { 
      id: 'settings', label: 'الإعدادات', icon: 'Settings2', hrefPrefix: '/dashboard/settings',
      requiredPermission: 'menu_settings', // This is now overridden by the guard logic
  },
};

// MainNavItem component remains the same...

export function MainNav({ currentUser }: { currentUser: AuthenticatedUser; onLogout: () => void; }) {
    const pathname = usePathname();
    const { state } = useSidebar();
    const { loading, can } = usePermissions(currentUser.roleId);
    const [openModuleId, setOpenModuleId] = useState<string | null>(null);

    if (loading) {
        return (
            <>
                <SidebarHeader className="p-4 mb-4"><Skeleton className="h-8 w-28" /></SidebarHeader>
                <SidebarContent className="px-3 space-y-2">
                    {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-2xl bg-amber-400/20" />)}
                </SidebarContent>
            </>
        );
    }

    // 🛡️ APPLYING THE GUARD TO THE NAVIGATION ITEMS
    const visibleNavItems = Object.values(navConfig).filter(item => {
        if (item.id === 'settings') {
            return canAccessSettings(currentUser);
        }
        // For all other items, use the permissions from the matrix
        return can(item.requiredPermission);
    });

    return (
        <>
            <SidebarHeader>
              {/* ... header content ... */}
            </SidebarHeader>

            <SidebarContent className="scrollbar-none px-3">
                <TooltipProvider delayDuration={0}>
                    <SidebarMenu className="space-y-1">
                        {state === 'collapsed' ? (
                            visibleNavItems.map((item) => {
                                // ... collapsed view logic ...
                            })
                        ) : (
                            visibleNavItems.map((item) => (
                                <SidebarMenuItem key={item.id} className="w-full">
                                    <MainNavItem item={item} currentPath={pathname} />
                                </SidebarMenuItem>
                            ))
                        )}
                    </SidebarMenu>
                </TooltipProvider>
            </SidebarContent>
        </>
    );
}

// ... other components like MainNavItem etc. are omitted for brevity but are unchanged
// The important change is the filtering of `visibleNavItems`
```

# ======================================================================
# 4. Permissions Matrix UI (src/components/developer/permissions-matrix.tsx)
# ======================================================================
```typescript
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import { 
    Save, 
    Loader2, 
    Search,
    Lock,
    Sparkles,
    Crown,
    Users2,
    UserCheck2,
    Briefcase,
} from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import { generatePredictivePermissions } from '@/lib/ai-role-filler';
import { SystemModules } from '@/lib/system-modules';

const ALL_MODULE_IDS = SystemModules.map(m => m.id);

const PERMISSION_LEVELS: Record<string, { label: string; style: string; description: string }> = {
    full: { label: 'تحكم كامل', style: 'bg-[#F5820D]/90 border-orange-400/70 text-white', description: 'إضافة, عرض, تعديل, حذف' },
    edit_all: { label: 'تعديل الكل', style: 'bg-[#F5820D]/80 border-orange-500/60 text-white', description: 'إضافة, عرض, تعديل' },
    edit_own: { label: 'تعديل ما يخصه', style: 'bg-white/50 border-white/40 backdrop-blur-xl text-slate-800', description: 'يعدل فقط على مدخلاته' },
    add_view: { label: 'إضافة وعرض', style: 'bg-white/50 border-white/40 backdrop-blur-xl text-slate-800', description: 'يضيف ويرى الكل' },
    add_only: { label: 'إضافة فقط', style: 'bg-white/40 border-white/30 backdrop-blur-xl text-slate-700', description: 'يضيف فقط ولا يرى الآخرين' },
    view: { label: 'عرض فقط', style: 'bg-amber-400/80 border-amber-300/70 text-white', description: 'مشاهدة فقط' },
    none: { label: 'مخفي', style: 'bg-slate-300/40 border-slate-400/30 backdrop-blur-xl text-slate-600', description: 'لا يرى الوحدة إطلاقاً' },
};

const ROLE_CATEGORIES = {
    top_management: { name: 'الإدارة العليا', keywords: ['مدير عام', 'رئيس مجلس', 'CEO', 'مالك'], icon: Users2 },
    department_heads: { name: 'مديرو الأقسام', keywords: ['مدير', 'رئيس', 'مسؤول'], icon: UserCheck2 },
    employees: { name: 'الموظفون', keywords: [], icon: Briefcase } // Default category
};

const classifyRole = (roleName: string): keyof typeof ROLE_CATEGORIES => {
    for (const [category, { keywords }] of Object.entries(ROLE_CATEGORIES)) {
        if (keywords.some(kw => roleName.includes(kw))) {
            return category as keyof typeof ROLE_CATEGORIES;
        }
    }
    return 'employees'; // Default
};

export function PermissionsMatrix() {
    const { firestore, auth } = useFirebase();
    const { user } = useAuth();
    const { toast } = useToast();
    
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<keyof typeof ROLE_CATEGORIES>('department_heads');
    const tenantId = user?.currentCompanyId;

    const { data: roles = [], loading: rolesLoading } = useSubscription<any>(
        firestore,
        useMemo(() => tenantId ? `companies/${tenantId}/roles` : null, [tenantId])
    );

    const settingsCollectionPath = useMemo(() => tenantId ? `companies/${tenantId}/settings` : null, [tenantId]);
    const { data: settingsDocs, loading: matrixLoading } = useSubscription<any>(firestore, settingsCollectionPath);

    const [matrix, setMatrix] = useState<Record<string, string>>({});

    useEffect(() => {
        const matrixDoc = settingsDocs?.find(doc => doc.id === 'permissions_matrix');
        if (matrixDoc) {
            setMatrix(matrixDoc.data || {});
        } else {
            setMatrix({});
        }
    }, [settingsDocs]);

    const classifiedRoles = useMemo(() => {
        const groups: Record<keyof typeof ROLE_CATEGORIES, any[]> = { top_management: [], department_heads: [], employees: [] };
        const allRoles = [...(roles || [])].sort((a, b) => a.name.localeCompare(b.name));

        allRoles.forEach(role => {
            const category = classifyRole(role.name);
            if (category === 'department_heads' && ROLE_CATEGORIES.top_management.keywords.some(kw => role.name.includes(kw))) {
                groups.top_management.push(role);
            } else {
                groups[category].push(role);
            }
        });
        return groups;
    }, [roles]);


    const handlePermissionChange = (role: string, moduleId: string, value: string) => {
        const key = `${role}-${moduleId}`;
        setMatrix(prev => ({ ...prev, [key]: value }));
    };

    // ... other handlers like applyPredictiveFill, handleBulkUpdate ...

    // ================= SECURE SAVE HANDLER V2.0 =================
    const handleSaveMatrix = async () => {
        if (!auth?.currentUser || !tenantId || !roles) return;
        setIsSaving(true);

        try {
            const idToken = await auth.currentUser.getIdToken();

            const response = await fetch('/api/save-permissions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`,
                },
                body: JSON.stringify({
                    companyId: tenantId,
                    matrix: matrix,
                    roles: roles.map(r => ({id: r.id, name: r.name})),
                }),
            });

            const result = await response.json();

            if (response.ok && result.success) {
                toast({ title: '✅ تم تفعيل مصفوفة الأمان بنجاح عبر الحصن المؤمن' });
            } else {
                throw new Error(result.error || 'فشل الاتصال بالحصن الأمني.');
            }

        } catch (e: any) {
            console.error(e);
            toast({ variant: 'destructive', title: 'خطأ فادح في الحفظ', description: e.message });
        } finally {
            setIsSaving(false);
        }
    };
    // =============================================================

    // ... JSX for rendering the matrix ...
    return (
        <Card>
           {/* The full JSX of the component */}
        </Card>
    );
}
```

# ======================================================================
# 5. Secure API for Saving Permissions (src/app/api/save-permissions/route.ts)
# ======================================================================
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import path from 'path';

// ... (Firebase Admin Initialization Logic) ...

// 🛡️ Define roles with permission to modify the permissions matrix
const PERMITTED_ROLES = ['Admin', 'مدير عام', 'General Manager', 'Developer'];

export async function POST(request: NextRequest) {
    try {
        const app = getAdminApp();
        const adminAuth = getAuth(app);
        const db = getFirestore(app);

        // 1. AUTHENTICATION & AUTHORIZATION
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ success: false, error: 'Unauthorized: Missing Token' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);

        if (!decodedToken.role || !PERMITTED_ROLES.includes(decodedToken.role)) {
            return NextResponse.json({ success: false, error: 'Forbidden: Insufficient permissions to alter security matrix.' }, { status: 403 });
        }

        // 2. DATA VALIDATION
        const body = await request.json();
        const { companyId, matrix, roles } = body;

        if (!companyId || !matrix || !roles) {
            return NextResponse.json({ success: false, error: 'Bad Request: Missing required data.' }, { status: 400 });
        }
        
        if (decodedToken.companyId !== companyId) {
            return NextResponse.json({ success: false, error: 'Forbidden: Cross-tenant operation denied.' }, { status: 403 });
        }

        // 3. SECURE DATABASE OPERATION
        const settingsRef = db.collection(`companies/${companyId}/settings`);
        const matrixRef = settingsRef.doc('permissions_matrix');
        const rolesRef = db.collection(`companies/${companyId}/roles`);
        const batch = db.batch();

        // Save the matrix
        batch.set(matrixRef, matrix);

        // Update roleId on each user document based on role name
        const roleMap = new Map(roles.map((r: any) => [r.name, r.id]));
        const usersSnapshot = await db.collection('users').where('companyId', '==', companyId).get();

        usersSnapshot.forEach(userDoc => {
            const user = userDoc.data();
            const roleId = roleMap.get(user.role);
            if (roleId && user.roleId !== roleId) {
                batch.update(userDoc.ref, { roleId: roleId });
            }
        });
        
        await batch.commit();

        return NextResponse.json({ success: true, message: 'Permissions matrix and user roles updated successfully.' });

    } catch (error: any) {
        console.error("Save Permissions Matrix Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
```
