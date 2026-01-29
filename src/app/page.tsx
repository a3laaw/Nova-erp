'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader } from 'lucide-react';
import { Logo } from '@/components/layout/logo';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the main dashboard after a short delay to show the brand.
    const timer = setTimeout(() => {
        router.replace('/dashboard');
    }, 1500);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background">
        <Logo className="h-20 w-20 !p-4" />
        <h1 className="text-3xl font-bold font-headline text-foreground">Nova ERP</h1>
        <div className="flex items-center gap-2 mt-4">
            <Loader className="h-5 w-5 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">جاري تحويلك إلى لوحة التحكم...</p>
        </div>
    </div>
  );
}
