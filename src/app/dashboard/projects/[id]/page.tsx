
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader } from 'lucide-react';

export default function ProjectDetailsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // We can't redirect to a specific project, so we go to the list.
    router.replace('/dashboard/construction/projects');
  }, [router]);

  return (
    <div className="flex h-64 w-full flex-col items-center justify-center gap-4">
        <Loader className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">تم نقل هذه الصفحة. جاري إعادة التوجيه...</p>
    </div>
  );
}
