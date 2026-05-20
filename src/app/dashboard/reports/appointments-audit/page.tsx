'use client';

import { AppointmentsAuditReport } from '@/components/reports/appointments-audit-report';

/**
 * صفحة تقرير تدقيق المواعيد:
 * مركز إداري لمراجعة كافة حركات المواعيد، من حجزها ومن عدلها، مع إمكانية فرزها حسب العميل.
 */
export default function AppointmentsAuditPage() {
    return (
        <div className="p-4 sm:p-8" dir="rtl">
            <AppointmentsAuditReport />
        </div>
    );
}
