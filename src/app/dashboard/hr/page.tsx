'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader } from 'lucide-react';

export default function HRRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the first meaningful page in the HR section.
    router.replace('/dashboard/hr/employees');
  }, [router]);

  return (
    <div className="flex h-64 w-full flex-col items-center justify-center gap-4">
        <Loader className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">جاري إعادة التوجيه...</p>
    </div>
  );
}
