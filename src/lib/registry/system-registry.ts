
import { 
    LayoutGrid, Users, Workflow, FileSignature, 
    Landmark, Wallet, Building2, ShieldCheck, 
    BarChart3, Activity, Zap, Clock, Coins, 
    History, MapPin, ClipboardList, Briefcase 
} from 'lucide-react';

/**
 * 👑 سجل النظام الموحد (NOVA_SYSTEM_REGISTRY V150.0) 👑
 * المصدر الوحيد للحقيقة للصلاحيات وهياكل الداشبورد.
 */

export interface DashboardComponent {
    id: string;
    type: 'kpi' | 'chart' | 'action' | 'list';
    title: string;
    props?: any;
}

export interface SystemRoleConfig {
    rankTitle: string;
    allowedModules: string[];
    dashboard: {
        kpiCards: DashboardComponent[];
        charts: DashboardComponent[];
        quickActions: DashboardComponent[];
        lists: DashboardComponent[];
    };
}

export const NOVA_SYSTEM_REGISTRY: Record<string, SystemRoleConfig> = {
    owner_executive: {
        rankTitle: 'مدير عام / مالك المنشأة',
        allowedModules: [
            'dashboard', 'clients', 'transactions', 'quotations', 'contracts', 
            'tech_workflow', 'site_visits', 'payment_apps', 'journal_entries', 
            'vouchers', 'coa', 'financial_reports', 'liquidity_radar', 
            'wbs_mgmt', 'tasks_scheduling', 'hr_employees', 'payroll_leaves', 'settings'
        ],
        dashboard: {
            kpiCards: [
                { id: 'total_revenue', type: 'kpi', title: 'إجمالي الإيرادات', props: { color: 'bg-green-100 text-green-700', isCurrency: true } },
                { id: 'active_projects', type: 'kpi', title: 'المشاريع النشطة', props: { color: 'bg-blue-100 text-blue-700' } },
                { id: 'client_base', type: 'kpi', title: 'قاعدة العملاء', props: { color: 'bg-orange-100 text-[#FF7A00]' } },
                { id: 'critical_alerts', type: 'kpi', title: 'تنبيهات حرجة', props: { color: 'bg-red-100 text-red-700' } },
                { id: 'team_points', type: 'kpi', title: 'نقاط الإنجاز', props: { color: 'bg-indigo-100 text-indigo-700' } }
            ],
            charts: [
                { id: 'cashflow_projection', type: 'chart', title: 'توقعات التدفق النقدي' },
                { id: 'project_distribution', type: 'chart', title: 'توزيع المشاريع حسب القسم' }
            ],
            quickActions: [
                { id: 'new_client', type: 'action', title: 'تأسيس ملف عميل', props: { href: '/dashboard/clients/new', icon: 'Users' } },
                { id: 'new_contract', type: 'action', title: 'توقيع عقد', props: { href: '/dashboard/contracts/new', icon: 'FileSignature' } },
                { id: 'view_reports', type: 'action', title: 'التقارير المالية', props: { href: '/dashboard/accounting/reports', icon: 'PieChart' } }
            ],
            lists: [
                { id: 'recent_global_activity', type: 'list', title: 'آخر أحداث المنظومة' },
                { id: 'priority_wbs_alerts', type: 'list', title: 'تنبيهات الأولويات' }
            ]
        }
    },
    financial_manager: {
        rankTitle: 'مدير مالي / محاسب رئيسي',
        allowedModules: [
            'dashboard', 'journal_entries', 'vouchers', 'coa', 'financial_reports', 
            'liquidity_radar', 'payment_apps', 'payroll_leaves', 'settings'
        ],
        dashboard: {
            kpiCards: [
                { id: 'available_cash', type: 'kpi', title: 'السيولة المتوفرة', props: { color: 'bg-green-100 text-green-700', isCurrency: true } },
                { id: 'pending_vouchers', type: 'kpi', title: 'سندات غير مرحلة', props: { color: 'bg-orange-100 text-[#FF7A00]' } },
                { id: 'accounts_receivable', type: 'kpi', title: 'مديونيات العملاء', props: { color: 'bg-blue-100 text-blue-700', isCurrency: true } }
            ],
            charts: [
                { id: 'liquidity_radar', type: 'chart', title: 'رادار السيولة' },
                { id: 'aging_debts', type: 'chart', title: 'تقادم الديون' }
            ],
            quickActions: [
                { id: 'new_jv', type: 'action', title: 'قيد يومية يدوي', props: { href: '/dashboard/accounting/journal-entries/new', icon: 'BookOpen' } },
                { id: 'new_receipt', type: 'action', title: 'تحصيل مبلغ', props: { href: '/dashboard/accounting/cash-receipts/new', icon: 'ArrowDownLeft' } }
            ],
            lists: [
                { id: 'pending_collection_claims', type: 'list', title: 'مطالبات بانتظار التحصيل' }
            ]
        }
    },
    engineer: {
        rankTitle: 'مهندس / فني تنفيذ',
        allowedModules: [
            'dashboard', 'site_visits', 'wbs_mgmt', 'tech_workflow', 'tasks_scheduling'
        ],
        dashboard: {
            kpiCards: [
                { id: 'my_active_tasks', type: 'kpi', title: 'مهامي النشطة', props: { color: 'bg-blue-100 text-blue-700' } },
                { id: 'site_progress_avg', type: 'kpi', title: 'متوسط إنجاز المواقع', props: { color: 'bg-green-100 text-green-700' } }
            ],
            charts: [
                { id: 'site_activity_heat', type: 'chart', title: 'كثافة العمل الميداني' }
            ],
            quickActions: [
                { id: 'new_site_visit', type: 'action', title: 'جدولة زيارة موقع', props: { href: '/dashboard/construction/field-visits/new', icon: 'MapPin' } },
                { id: 'submit_daily_report', type: 'action', title: 'إرسال تقرير إنجاز', props: { href: '/dashboard/construction/field-visits', icon: 'CheckCircle2' } }
            ],
            lists: [
                { id: 'personal_tasks_radar', type: 'list', title: 'رادار مهامي الشخصية' },
                { id: 'assigned_docs_review', type: 'list', title: 'وثائق تتطلب مراجعتي' }
            ]
        }
    }
};
