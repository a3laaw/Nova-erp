
import { DollarSign, Users, Briefcase, TrendingUp, HandCoins } from 'lucide-react';

/**
 * =====================================================================================
 * |                   NOVA ERP - CENTRAL DASHBOARD WIDGET DEFINITIONS                 |
 * =====================================================================================
 * |    *** THIS FILE IS THE SINGLE SOURCE OF TRUTH FOR DASHBOARD WIDGETS ***          |
 * =====================================================================================
 * |                                                                                   |
 * | This schema defines all possible dashboard widgets (stats cards, charts, etc.).   |
 * | Each widget is mapped to a specific permission level from the user's              |
 * | permissionMap. The dynamic dashboard consumes this to render a grid tailored      |
 * | to the user's role.                                                               |
 * |                                                                                   |
 * =====================================================================================
 */

export type DashboardWidget = {
    id: string;
    title: string;
    // The specific permission level required to see this widget.
    // The format is `moduleId.permissionLevel` (e.g., 'clients.view')
    // A user must have AT LEAST this permission to see the widget.
    requiredPermission: string; 
    icon: React.ElementType;
    dataKey: string; // Key to fetch data from a potential API response
    color: string;
    // Optional: for widgets that are actions, not stats
    isAction?: boolean; 
    href?: string;
};


export const SystemDashboardWidgets: DashboardWidget[] = [
    // --- Sales & CRM Widgets ---
    {
        id: 'active-clients',
        title: 'العملاء النشطين',
        requiredPermission: 'clients.view', 
        icon: Users,
        dataKey: 'activeClients',
        color: '#3498db',
    },
    
    // --- Project Management Widgets ---
    {
        id: 'ongoing-projects',
        title: 'المشاريع الجارية',
        requiredPermission: 'projects.view',
        icon: Briefcase,
        dataKey: 'ongoingProjects',
        color: '#9b59b6',
    },
    {
        id: 'project-completion-rate',
        title: 'متوسط نسبة الإنجاز',
        requiredPermission: 'projects.view',
        icon: TrendingUp,
        dataKey: 'avgProjectCompletion',
        color: '#e67e22',
    },

    // --- Financial Widgets ---
    {
        id: 'total-revenue',
        title: 'إجمالي الإيرادات',
        requiredPermission: 'accounting_reports.view',
        icon: DollarSign,
        dataKey: 'totalRevenue',
        color: '#2ecc71',
    },
    {
        id: 'net-profit',
        title: 'صافي الربح',
        requiredPermission: 'accounting_reports.view',
        icon: DollarSign,
        dataKey: 'netProfit',
        color: '#27ae60',
    },
    {
        id: 'pending-invoices',
        title: 'فواتير مستحقة',
        requiredPermission: 'payment_applications.view',
        icon: HandCoins,
        dataKey: 'pendingInvoices',
        color: '#f1c40f',
    },

    // --- Action Widgets (Buttons) ---
    {
        id: 'action-add-client',
        title: 'إضافة عميل جديد',
        requiredPermission: 'clients.add_only',
        icon: Users,
        dataKey: '',
        color: ''
        isAction: true,
        href: '/dashboard/clients/new'
    },
    {
        id: 'action-add-project',
        title: 'إضافة مشروع جديد',
        requiredPermission: 'projects.add_only',
        icon: Briefcase,
        dataKey: '',
        color: '',
        isAction: true,
        href: '/dashboard/projects/new'
    },
    {
        id: 'action-add-invoice',
        title: 'إصدار مستخلص',
        requiredPermission: 'payment_applications.add_only',
        icon: HandCoins,
        dataKey: '',
        color: '',
        isAction: true,
        href: '/dashboard/payment-applications/new'
    },
];

/**
 * A helper function to check if a user's permissionMap grants them
 * access to a widget.
 * It uses a simple hierarchy: full > edit_all > edit_own > add_view > add_only > view
 */
const PERMISSION_HIERARCHY = ['view', 'add_only', 'add_view', 'edit_own', 'edit_all', 'full'];

export const canViewWidget = (userPermissionMap: Record<string, string>, requiredPermission: string): boolean => {
    const [requiredModule, requiredLevel] = requiredPermission.split('.');
    
    if (!requiredModule || !requiredLevel) return false;

    const userLevel = userPermissionMap[requiredModule];
    if (!userLevel || userLevel === 'none') return false;

    const userLevelIndex = PERMISSION_HIERARCHY.indexOf(userLevel);
    const requiredLevelIndex = PERMISSION_HIERARCHY.indexOf(requiredLevel);

    if (userLevelIndex === -1 || requiredLevelIndex === -1) return false;

    // User has permission if their level is equal to or higher than the required level
    return userLevelIndex >= requiredLevelIndex;
};
