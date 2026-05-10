'use client';
import { useAuth } from '@/context/auth-context';
import { AlertCircle, RefreshCw } from 'lucide-react';

/**
 * بنر أخطاء المصادقة:
 * يظهر في حال وجود مشاكل في تفعيل الحساب أو الجلسة.
 */
export const AuthErrorBanner = () => {
  const { error, refreshUserData } = useAuth();
  if (!error) return null;

  return (
    <div dir="rtl" className="bg-red-50 border-r-4 border-red-500 p-4 mb-6 rounded-2xl shadow-lg animate-in slide-in-from-top-4 duration-500 no-print">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-6 w-6 text-red-600" />
          <div>
            <h3 className="text-sm font-black text-red-800">تنبيه أمني وحماية</h3>
            <p className="text-xs font-bold text-red-700 mt-0.5">{error}</p>
          </div>
        </div>
        <button
          onClick={() => refreshUserData()}
          className="flex items-center gap-2 text-xs font-black bg-red-100 hover:bg-red-200 text-red-800 px-4 py-2 rounded-xl transition-all active:scale-95"
        >
          <RefreshCw className="h-3 w-3" />
          تحديث البيانات
        </button>
      </div>
    </div>
  );
};
