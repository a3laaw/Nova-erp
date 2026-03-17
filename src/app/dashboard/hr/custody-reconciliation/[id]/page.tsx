
'use client';

import { useParams } from 'next/navigation';
import { CustodyReconciliationDetails } from '@/components/hr/custody-reconciliation-details';

/**
 * صفحة تفاصيل التسوية (منظور المحاسب):
 * تتيح للمحاسب ربط بنود التسوية بحسابات المصاريف الصحيحة قبل اعتماد القيد المالي.
 */
export default function ReconciliationDetailsPage() {
    const params = useParams();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    return (
        <div className="p-4 sm:p-8" dir="rtl">
            <CustodyReconciliationDetails reconciliationId={id} />
        </div>
    );
}
