'use client';

import { NOVA_SYSTEM_REGISTRY, type SystemRoleConfig } from './system-registry';
import type { AuthenticatedUser } from '@/context/auth-context';

/**
 * @fileOverview مهايئ النفاذ السيادي (NovaAccessAdapter V150.0).
 * يقوم بترجمة المسمى الوظيفي الفعلي إلى رتبة نظام لضمان مرونة التقسيم الإداري.
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
    'سكرتارية': 'engineer',
};

export class NovaAccessAdapter {
    static resolveSystemRole(jobTitle: string | undefined, baseRole: string): string {
        if (baseRole === 'Developer' || baseRole === 'Admin') return 'owner_executive';
        
        const mappedRank = jobTitle ? PROFESSION_RANK_MAP[jobTitle] : null;
        if (mappedRank) return mappedRank;

        // Fallback logic
        if (baseRole === 'Accountant') return 'financial_manager';
        if (baseRole === 'Engineer') return 'engineer';
        
        return 'engineer'; 
    }

    static injectSecurityContext(user: AuthenticatedUser): AuthenticatedUser & { systemConfig: SystemRoleConfig } {
        const systemRoleKey = this.resolveSystemRole(user.jobTitle || undefined, user.role);
        const config = NOVA_SYSTEM_REGISTRY[systemRoleKey] || NOVA_SYSTEM_REGISTRY.engineer;

        return {
            ...user,
            systemConfig: config
        };
    }
}
