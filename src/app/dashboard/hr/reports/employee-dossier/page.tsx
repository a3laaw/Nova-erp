'use client';

import { EmployeeDossierReport } from '@/components/hr/reports/employee-dossier-report';

/**
 * صفحة تقرير "وثيقة ملف المتغيرات الشامل":
 * تعرض السجل التاريخي المتكامل للموظف (مالياً وإدارياً وميدانياً).
 */
export default function EmployeeDossierReportPage() {
    return (
        <div className="p-2 sm:p-6 animate-in fade-in duration-700">
            <EmployeeDossierReport />
        </div>
    );
}