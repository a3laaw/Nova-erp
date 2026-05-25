'use client';

import { DeveloperHub } from '@/components/developer/developer-hub';

/**
 * @fileOverview صفحة مركز تحكم المطور.
 * تتيح الوصول للأدوات السيادية لتخصيص النظام.
 */
export default function DeveloperHubPage() {
    return (
        <div className="p-2 sm:p-4 animate-in fade-in duration-1000" dir="rtl">
            <DeveloperHub />
        </div>
    );
}
