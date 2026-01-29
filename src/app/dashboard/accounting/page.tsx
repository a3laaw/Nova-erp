'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader } from 'lucide-react';

export default function AccountingRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the first meaningful page in the accounting section.
    router.replace('/dashboard/accounting/journal-entries');
  }, [router]);

  return (
    <div className="flex h-64 w-full flex-col items-center justify-center gap-4">
        <Loader className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">جاري إعادة التوجيه...</p>
    </div>
  );
}
