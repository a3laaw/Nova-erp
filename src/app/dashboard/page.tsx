'use client';

import { useMemo } from 'react';
import { useAnalyticalData } from '@/hooks/use-analytical-data';
import { useAuth } from '@/context/auth-context';
import { ExecutiveDashboard } from '@/components/dashboard/executive-view';
import { FinancialDashboard } from '@/components/dashboard/financial-view';
import { SiteDashboard } from '@/components/dashboard/site-view';
import { HrDashboard } from '@/components/dashboard/hr-view';
import { Loader2 } from 'lucide-react';

/**
 * الصفحة الرئيسية الديناميكية (Sovereign Role Switcher):
 * تقوم بتغيير الواجهة بالكامل بناءً على رتبة المستخدم لضمان الخصوصية وسهولة العمل.
 */
export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const analyticalData = useAnalyticalData();

  if (authLoading || analyticalData.loading) {
      return (
          <div className="h-[80vh] flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
              <p className="font-black text-slate-400 text-lg animate-pulse">جاري تجهيز لوحة التحكم المخصصة لك...</p>
          </div>
      );
  }

  // 🛡️ توجيه المسار بناءً على الدور الوظيفي
  switch (user?.role) {
      case 'Developer':
      case 'Admin':
          return <ExecutiveDashboard data={analyticalData} user={user} />;
      
      case 'Accountant':
          return <FinancialDashboard data={analyticalData} user={user} />;
      
      case 'Engineer':
          return <SiteDashboard data={analyticalData} user={user} />;
      
      case 'HR':
          return <HrDashboard data={analyticalData} user={user} />;
      
      default:
          return <ExecutiveDashboard data={analyticalData} user={user} />;
  }
}
