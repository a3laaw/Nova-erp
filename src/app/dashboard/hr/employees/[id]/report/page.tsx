'use client';

import { useParams, useRouter } from 'next/navigation';
import { EmployeeSnapshotReport } from '@/components/hr/employee-snapshot-report';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

export default function EmployeeReportPage() {
    const params = useParams();
    const router = useRouter();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    if (!id) {
        return (
            <div className="p-8 text-center" dir='rtl'>
                <p className='text-destructive'>لم يتم العثور على معرّف الموظف.</p>
                <Button onClick={() => router.back()} className="mt-4">العودة</Button>
            </div>
        )
    }

    return (
        <div className="bg-background min-h-screen">
            <EmployeeSnapshotReport employeeId={id} reportDate={new Date()} />
        </div>
    );
}
