
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * صفحة تقارير الإجازات: تم دمجها مع لوحة تقارير الموارد البشرية العامة.
 */
export default function LeaveReportsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/hr/reports');
  }, [router]);

  return (
    <div className="flex h-64 w-full flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground font-bold">جاري توجيهك إلى لوحة تقارير الموارد البشرية...</p>
    </div>
  );
}
