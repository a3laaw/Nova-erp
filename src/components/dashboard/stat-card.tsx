'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, cn } from '@/lib/utils';

export const StatCard = ({ title, value, icon, description, colorClass, loading, subText, isCurrency = false }: any) => (
    <Card className="overflow-hidden border-white/30 bg-white/40 dark:bg-slate-900/40 rounded-[2.5rem] hover-lift group border-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-xl shadow-inner", colorClass)}>{icon}</div>
                <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{title}</CardTitle>
            </div>
        </CardHeader>
        <CardContent>
            {loading ? <Skeleton className="h-10 w-32 mt-1" /> : (
                <div className={cn("text-3xl font-black font-mono tracking-tighter text-foreground")}>
                    {isCurrency ? formatCurrency(value) : value}
                </div>
            )}
            <p className="text-[10px] text-muted-foreground mt-1 font-bold">{subText || description}</p>
        </CardContent>
    </Card>
);
