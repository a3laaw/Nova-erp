'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * @fileOverview صفحة تسجيل دخول المطور (محذوفة ومحوّلة).
 * تم دمج هذا المسار في الصفحة الرئيسية لضمان واجهة موحدة.
 */
export default function RedirectToMainLogin() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#0f172a] text-white">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <p className="font-black tracking-widest text-xs uppercase opacity-40">Redirecting to Unified Gateway...</p>
    </div>
  );
}
