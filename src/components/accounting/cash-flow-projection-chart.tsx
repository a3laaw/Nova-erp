'use client';

import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { runCashFlowProjection, type CashFlowProjectionOutput } from '@/ai/flows/cash-flow-projection';
import { formatCurrency } from '@/lib/utils';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border shadow-md p-3 rounded-lg">
        <p className="font-bold">{label}</p>
        <p className="text-green-600">{`الإيرادات المتوقعة: ${formatCurrency(payload[0].value)}`}</p>
        <p className="text-red-600">{`المصروفات المتوقعة: ${formatCurrency(payload[1].value)}`}</p>
        <hr className="my-1" />
        <p className="font-semibold">{`صافي التدفق: ${formatCurrency(payload[0].value - payload[1].value)}`}</p>
      </div>
    );
  }
  return null;
};

export function CashFlowProjectionChart() {
  const [data, setData] = useState<CashFlowProjectionOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [months, setMonths] = useState('6');

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
    return data?.projections.map(p => ({
      name: p.monthName,
      'الإيرادات المتوقعة': p.expectedRevenue,
      'المصروفات المتوقعة': p.fixedExpenses,
    })) || [];
  }, [data]);
  
  const negativeFlowMonths = useMemo(() => {
    return data?.projections.filter(p => p.netCashFlow < 0) || [];
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
        <Label htmlFor="months-select">عرض توقعات لـ:</Label>
        <Select value={months} onValueChange={setMonths}>
            <SelectTrigger id="months-select" className="w-[180px]">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="3">3 أشهر</SelectItem>
                <SelectItem value="6">6 أشهر</SelectItem>
                <SelectItem value="12">12 شهرًا</SelectItem>
            </SelectContent>
        </Select>
      </div>

      <div style={{ width: '100%', height: 400 }}>
        <ResponsiveContainer>
          <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis tickFormatter={(value) => formatCurrency(value)} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="الإيرادات المتوقعة" fill="#22c55e" />
            <Bar dataKey="المصروفات المتوقعة" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
       {negativeFlowMonths.length > 0 && (
         <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>تحذير: تدفق نقدي سالب متوقع!</AlertTitle>
            <AlertDescription>
                <ul className="list-disc pr-5 mt-2">
                    {negativeFlowMonths.map(month => (
                        <li key={month.month}>
                            في شهر <strong>{month.monthName}</strong>، من المتوقع أن يكون صافي التدفق النقدي سالبًا بقيمة <strong>{formatCurrency(Math.abs(month.netCashFlow))}</strong>.
                        </li>
                    ))}
                </ul>
            </AlertDescription>
        </Alert>
       )}

        {data?.assumptions && (
            <div className="text-xs text-muted-foreground p-3 border rounded-lg bg-muted/50">
                <h4 className="font-bold mb-1">الافتراضات المستخدمة في الحساب:</h4>
                <p>- المصروفات الثابتة تشمل إجمالي رواتب {data.assumptions.employeeCount} موظفًا حاليًا (بقيمة {formatCurrency(data.assumptions.totalSalaries)} شهريًا) + إيجار ثابت مقدّر بـ {formatCurrency(data.assumptions.fixedRent)}.</p>
                <p>- الإيرادات المتوقعة محسوبة من الدفعات المستحقة والقادمة في العقود الموقعة فقط.</p>
            </div>
        )}

    </div>
  );
}
