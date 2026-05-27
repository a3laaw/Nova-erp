
'use client';

/**
 * @fileOverview مهايئ النفاذ السيادي (NovaAccessAdapter V150.0).
 * يقوم بترجمة المسمى الوظيفي الفعلي إلى رتبة نظام لضمان مرونة التقسيم الإداري.
 */

import { NOVA_SYSTEM_REGISTRY, type SystemRoleConfig } from './system-registry';
import type { AuthenticatedUser } from '@/context/auth-context';

/**
 * خرائط المواءمة للمهن (Profession-to-Rank Mapping)
 * يتم تحديث هذه الخريطة عند إضافة مهن جديدة في الإعدادات.
 */
const PROFESSION_RANK_MAP: Record<string, string> = {
    'مدير عام': 'owner_executive',
    'مدير مشاريع': 'owner_executive',
    'مدير مالي': 'financial_manager',
    'محاسب رواتب': 'financial_manager',
    'محاسب': 'financial_manager',
    'مهندس موقع': 'engineer',
    'مهندس مدني': 'engineer',
    'مهندس كهرباء': 'engineer',
    'مهندس معماري': 'engineer',
    'مساح ميداني': 'engineer',
    'رسام معماري': 'engineer',
    'سكرتارية': 'engineer', // يرث داشبورد المهام والجدولة
};

export class NovaAccessAdapter {
    /**
     * ترجمة المسمى الوظيفي إلى رتبة نظام برمجية.
     */
    static resolveSystemRole(jobTitle: string | undefined, baseRole: string): string {
        if (baseRole === 'Developer') return 'owner_executive';
        if (baseRole === 'Admin') return 'owner_executive';
        
        const mappedRank = jobTitle ? PROFESSION_RANK_MAP[jobTitle] : null;
        if (mappedRank) return mappedRank;

        // Fallback logic based on base system role
        if (baseRole === 'Accountant') return 'financial_manager';
        if (baseRole === 'Engineer') return 'engineer';
        
        return 'engineer'; // الافتراضي هو رتبة منخفضة الصلاحيات
    }

    /**
     * حقن سياق الأمان والواجهة في جلسة المستخدم.
     */
    static injectSecurityContext(user: AuthenticatedUser): AuthenticatedUser & { systemConfig: SystemRoleConfig } {
        const systemRoleKey = this.resolveSystemRole(user.jobTitle || undefined, user.role);
        const config = NOVA_SYSTEM_REGISTRY[systemRoleKey] || NOVA_SYSTEM_REGISTRY.engineer;

        return {
            ...user,
            systemConfig: config
        };
    }
}
