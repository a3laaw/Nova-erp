
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader } from 'lucide-react';

export default function ProjectsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/construction/projects');
  }, [router]);

  return (
    <div className="flex h-64 w-full flex-col items-center justify-center gap-4">
        <Loader className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">جاري إعادة التوجيه إلى صفحة المشاريع الجديدة...</p>
    </div>
  );
}
