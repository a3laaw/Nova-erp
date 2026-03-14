'use client';

import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { runCashFlowProjection } from '@/ai/flows/cash-flow-projection';
import { formatCurrency, cn } from '@/lib/utils';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Label } from '@/components/ui/label';
import { useAppTheme } from '@/context/theme-context';

const CustomTooltip = ({ active, payload, label, isGlass }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className={cn(
          "border shadow-md p-3 rounded-lg",
          isGlass ? "bg-black/80 backdrop-blur-md border-white/20 text-white" : "bg-background"
      )}>
        <p className="font-bold">{label}</p>
        <p className={isGlass ? "text-cyan-400" : "text-green-600"}>{`الإيرادات المتوقعة: ${formatCurrency(payload[0].value)}`}</p>
        <p className={isGlass ? "text-pink-400" : "text-red-600"}>{`المصروفات المتوقعة: ${formatCurrency(payload[1].value)}`}</p>
        <hr className="my-1 opacity-20" />
        <p className="font-semibold">{`صافي التدفق: ${formatCurrency(payload[0].value - payload[1].value)}`}</p>
      </div>
    );
  }
  return null;
};

export function CashFlowProjectionChart() {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [months, setMonths] = useState('6');
  const { theme } = useAppTheme();
  const isGlass = theme === 'glass';

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await runCashFlowProjection({ months: parseInt(months, 10) });
        setData(result);
      } catch (e: any) {
        console.error(e);
        setError('فشل في حساب التنبؤات. الرجاء المحاولة مرة أخرى.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [months]);

  const chartData = useMemo(() => {
    return data?.projections.map((p: any) => ({
      name: p.monthName,
      'الإيرادات المتوقعة': p.expectedRevenue,
      'المصروفات المتوقعة': p.fixedExpenses,
    })) || [];
  }, [data]);
  
  const negativeFlowMonths = useMemo(() => {
    return data?.projections.filter((p: any) => p.netCashFlow < 0) || [];
  }, [data]);


  if (loading) {
    return (
      <div className="flex justify-center items-center h-80">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="mr-2">جاري حساب التوقعات المالية...</p>
      </div>
    );
  }

  if (error) {
    return <p className="text-destructive text-center">{error}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Label htmlFor="months-select" className={isGlass ? "text-white/70" : ""}>عرض توقعات لـ:</Label>
        <Select value={months} onValueChange={setMonths}>
            <SelectTrigger id="months-select" className="w-[180px]">
                <SelectValue />
            </SelectTrigger>
            <SelectContent dir="rtl">
                <SelectItem value="3">3 أشهر</SelectItem>
                <SelectItem value="6">6 أشهر</SelectItem>
                <SelectItem value="12">12 شهرًا</SelectItem>
            </SelectContent>
        </Select>
      </div>

      <div style={{ width: '100%', height: 400 }} className={cn(isGlass && "bg-white/5 p-4 rounded-3xl border border-white/10")}>
        <ResponsiveContainer>
          <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={isGlass ? "rgba(255,255,255,0.1)" : "#ccc"} vertical={false} />
            <XAxis dataKey="name" tick={{ fill: isGlass ? "rgba(255,255,255,0.6)" : "#666" }} />
            <YAxis tick={{ fill: isGlass ? "rgba(255,255,255,0.6)" : "#666" }} tickFormatter={(value) => formatCurrency(value)} />
            <Tooltip content={<CustomTooltip isGlass={isGlass} />} />
            <Legend />
            <Bar dataKey="الإيرادات المتوقعة" fill={isGlass ? "#22d3ee" : "#22c55e"} radius={[10, 10, 0, 0]} />
            <Bar dataKey="المصروفات المتوقعة" fill={isGlass ? "#f472b6" : "#ef4444"} radius={[10, 10, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
       {negativeFlowMonths.length > 0 && (
         <Alert variant="destructive" className={cn(isGlass && "glass-effect border-red-500/50 bg-red-500/10 text-white")}>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="font-black">تحذير: تدفق نقدي سالب متوقع!</AlertTitle>
            <AlertDescription>
                <ul className="list-disc pr-5 mt-2">
                    {negativeFlowMonths.map((month: any) => (
                        <li key={month.month}>
                            في شهر <strong>{month.monthName}</strong>، من المتوقع أن يكون صافي التدفق النقدي سالبًا بقيمة <strong>{formatCurrency(Math.abs(month.netCashFlow))}</strong>.
                        </li>
                    ))}
                </ul>
            </AlertDescription>
        </Alert>
       )}

        {data?.assumptions && (
            <div className={cn(
                "text-[10px] p-4 border rounded-2xl",
                isGlass ? "bg-white/5 border-white/10 text-white/50" : "bg-muted/50 text-muted-foreground"
            )}>
                <h4 className="font-black mb-1 uppercase tracking-widest opacity-80">الافتراضات المستخدمة في الحساب (Engine v2.0):</h4>
                <p>• المصروفات الثابتة تشمل إجمالي رواتب {data.assumptions.employeeCount} موظفاً (بقيمة {formatCurrency(data.assumptions.totalSalaries)} شهرياً) + إيجار تقديري {formatCurrency(data.assumptions.fixedRent)}.</p>
                <p>• الإيرادات المتوقعة مستخلصة من جداول دفعات العقود "المستحقة والقادمة" في المعاملات النشطة فقط.</p>
            </div>
        )}

    </div>
  );
}