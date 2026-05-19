'use client';

import { ProfileManager } from '@/components/settings/profile-manager';

/**
 * صفحة الملف المهني للموظف:
 * تتيح للموظف إدارة هويته البصرية وسيرته الذاتية داخل النظام.
 */
export default function ProfilePage() {
    return (
        <div className="p-4 sm:p-8 animate-in fade-in duration-1000">
            <ProfileManager />
        </div>
    );
}