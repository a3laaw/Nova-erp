'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, cn } from '@/lib/utils';

/**
 * بطاقة الإحصائيات الموحدة (Sovereign Stat Card):
 * تم تحصينها لتدعم عرض الأرقام المجردة أو العملة بمرونة تامة.
 */
export const StatCard = ({ title, value, icon, description, colorClass, loading, subText, isCurrency = false }: any) => (
    <Card className="overflow-hidden border-white/30 bg-white/40 dark:bg-slate-900/40 rounded-[2.5rem] hover-lift group border-2 shadow-sm transition-all duration-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-xl shadow-inner transition-transform group-hover:scale-110 duration-500", colorClass)}>
                    {icon}
                </div>
                <CardTitle className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{title}</CardTitle>
            </div>
        </CardHeader>
        <CardContent>
            {loading ? (
                <Skeleton className="h-10 w-32 mt-1 rounded-lg" />
            ) : (
                <div className={cn("text-3xl font-black font-mono tracking-tighter text-[#1e1b4b]")}>
                    {isCurrency 
                        ? formatCurrency(Number(value) || 0) 
                        : (Number(value) || 0).toLocaleString('en-US')
                    }
                </div>
            )}
            <p className="text-[10px] text-slate-400 mt-1 font-bold italic">{subText || description || 'تحديث فوري'}</p>
        </CardContent>
    </Card>
);