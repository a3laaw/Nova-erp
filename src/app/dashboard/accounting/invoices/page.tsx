
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * صفحة الفواتير: تم دمجها مع المستخلصات المالية في قسم المقاولات والمبيعات.
 */
export default function InvoicesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // التوجيه للقسم الأكثر شمولية للمطالبات المالية
    router.replace('/dashboard/accounting/reports');
  }, [router]);

  return (
    <div className="flex h-64 w-full flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground font-bold">جاري الانتقال للتقارير المالية والمستخلصات...</p>
    </div>
  );
}
