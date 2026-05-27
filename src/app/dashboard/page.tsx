
'use client';

import { useMemo } from 'react';
import { useAnalyticalData } from '@/hooks/use-analytical-data';
import { useAuth } from '@/context/auth-context';
import { UpgradedDashboardContainer } from '@/components/dashboard/dynamic-dashboard-container';
import { NovaAccessAdapter } from '@/lib/registry/access-adapter';
import { Loader2 } from 'lucide-react';

/**
 * الصفحة الرئيسية المتطورة (Sovereign Metadata Switcher V150.0):
 * تقوم بالربط بين المسمى الوظيفي وسجل النظام (Registry) لبناء واجهة ذكية 
 * تماماً كما طلبت، بعيداً عن الكود الصلب.
 */
export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const analyticalData = useAnalyticalData();

  const userContext = useMemo(() => {
    if (!user) return null;
    // استدعاء المهايئ لترجمة المسمى الوظيفي وحقن الصلاحيات
    return NovaAccessAdapter.injectSecurityContext(user);
  }, [user]);

  if (authLoading || analyticalData.loading) {
      return (
          <div className="h-[80vh] flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
              <p className="font-black text-slate-400 text-lg animate-pulse">جاري فحص رتبة الدخول وتحضير سجل النظام...</p>
          </div>
      );
  }

  if (!userContext) return null;

  // الرندرة الديناميكية: الحاوية تستلم الـ Config المولد من الـ Registry
  return (
    <UpgradedDashboardContainer 
        config={userContext.systemConfig} 
        analyticsData={analyticalData} 
    />
  );
}
