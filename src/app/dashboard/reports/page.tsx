
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * توجيه سيادي لمركز التقارير الموحد الجديد.
 */
export default function ReportsRedirect() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/dashboard/reports/operational-hub');
    }, [router]);

    return (
        <div className="flex h-64 w-full flex-col items-center justify-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground font-black">جاري الدخول لمركز الذكاء العملياتي...</p>
        </div>
    );
}
