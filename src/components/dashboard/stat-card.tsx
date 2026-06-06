'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils'; // أبقينا فقط على cn المستقرة

/**
 * دالة مساعدة داخلية ومستقلة لتنسيق العملة (الدينار الكويتي بـ 3 فواصل عشرية)
 * قمنا بدمجها هنا مباشرة لحل مشكلة الشاشة الحمراء نهائياً وبأمان
 */
const localFormatCurrency = (val: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'KWD',
    minimumFractionDigits: 3
  }).format(val);
};

/**
 * بطاقة الإحصائيات الموحدة (Sovereign Stat Card V150.1):
 * تم تحصينها لتدعم عرض الأرقام المجردة أو العملة بمرونة تامة مع دعم الـ Glassmorphism.
 */
export const StatCard = ({ title, value, icon, description, colorClass, loading, subText, isCurrency = false }: any) => (
    <Card className="overflow-hidden border-white/30 bg-white/40 dark:bg-slate-900/40 rounded-[2.5rem] hover-lift group border-2 shadow-sm transition-all duration-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-6">
            <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-xl shadow-inner transition-transform group-hover:scale-110 duration-500", colorClass)}>
                    {icon}
                </div>
                <CardTitle className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{title}</CardTitle>
            </div>
        </CardHeader>
        <CardContent className="px-8 pb-8 pt-0">
            {loading ? (
                <Skeleton className="h-10 w-32 mt-1 rounded-lg" />
            ) : (
                <div className={cn("text-3xl font-black font-mono tracking-tighter text-[#1e1b4b]")}>
                    {isCurrency 
                        ? localFormatCurrency(Number(value) || 0) // استخدام الدالة الداخلية الآمنة
                        : (Number(value) || 0).toLocaleString('en-US')
                    }
                </div>
            )}
            <p className="text-[10px] text-slate-400 mt-2 font-bold italic">{subText || description || 'تحديث فوري من الميدان'}</p>
        </CardContent>
    </Card>
);

export default StatCard;