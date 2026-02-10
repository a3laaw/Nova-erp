'use client';

import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFirebase } from '@/firebase';
import type { Employee } from '@/lib/types';
import { InlineSearchList } from '../ui/inline-search-list';
import { Skeleton } from '../ui/skeleton';
import { useSubscription } from '@/hooks/use-subscription';
import { calculateGratuity } from '@/services/leave-calculator';
import { formatCurrency } from '@/lib/utils';
import { Calculator } from 'lucide-react';
import { Separator } from '../ui/separator';

interface GratuityResult {
    gratuity: number;
    leaveBalancePay: number;
    total: number;
    notice: string;
    yearsOfService: number;
    lastSalary: number;
    leaveBalance: number;
    dailyWage: number;
}

export function GratuityCalculatorView() {
  const { firestore } = useFirebase();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [terminationReason, setTerminationReason] = useState<'resignation' | 'termination'>('termination');
  const [result, setResult] = useState<GratuityResult | null>(null);

  const { data: employees, loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees');

  const employeeOptions = useMemo(() => {
    return (employees || []).map(e => ({ value: e.id!, label: e.fullName, searchKey: e.employeeNumber }));
  }, [employees]);

  const selectedEmployee = useMemo(() => {
    return employees.find(e => e.id === selectedEmployeeId);
  }, [employees, selectedEmployeeId]);

  const handleCalculate = () => {
    if (selectedEmployee) {
      const calculationResult = calculateGratuity({ ...selectedEmployee, terminationReason }, new Date());
      setResult(calculationResult);
    }
  };

  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="text-primary" />
          حاسبة مكافأة نهاية الخدمة
        </CardTitle>
        <CardDescription>
          تقدير مستحقات الموظف عند إنهاء خدمته بناءً على قانون العمل الكويتي.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="employee">الموظف</Label>
            <InlineSearchList
              value={selectedEmployeeId}
              onSelect={setSelectedEmployeeId}
              options={employeeOptions}
              placeholder="اختر موظفًا..."
              disabled={employeesLoading}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="terminationReason">سبب إنهاء الخدمة</Label>
            <Select value={terminationReason} onValueChange={(v) => setTerminationReason(v as any)}>
              <SelectTrigger id="terminationReason"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="termination">إنهاء خدمات من الشركة</SelectItem>
                <SelectItem value="resignation">استقالة</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-center">
            <Button onClick={handleCalculate} disabled={!selectedEmployeeId}>
                <Calculator className="ml-2 h-4 w-4" />
                حساب المستحقات
            </Button>
        </div>

        {result && selectedEmployee && (
          <div className="pt-6 border-t space-y-6">
            <h3 className="text-lg font-semibold mb-4 text-center">نتيجة الحساب لـِ {selectedEmployee.fullName}</h3>
            <div className="max-w-md mx-auto space-y-2 text-center">
                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="font-medium">مكافأة نهاية الخدمة:</span>
                    <span className="font-bold text-lg">{formatCurrency(result.gratuity)}</span>
                </div>
                 <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="font-medium">بدل رصيد الإجازات:</span>
                    <span className="font-bold text-lg">{formatCurrency(result.leaveBalancePay)}</span>
                </div>
                 <div className="flex justify-between items-center p-3 bg-primary/10 text-primary-foreground rounded-lg mt-4">
                    <span className="font-extrabold text-primary">إجمالي المستحقات:</span>
                    <span className="font-extrabold text-xl text-primary">{formatCurrency(result.total)}</span>
                </div>
                <p className="text-xs text-muted-foreground pt-2">{result.notice}</p>
            </div>
            
            <Card className="bg-slate-50 dark:bg-slate-800/50 max-w-lg mx-auto">
                <CardHeader><CardTitle className="text-base">تفاصيل الحسبة</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-2">
                    <p><strong>آخر راتب شامل:</strong> {formatCurrency(result.lastSalary)}</p>
                    <p><strong>عدد سنوات الخدمة:</strong> {result.yearsOfService.toFixed(1)} سنة</p>
                    <p><strong>رصيد الإجازات المتبقي:</strong> {result.leaveBalance.toFixed(1)} يوم</p>
                    <Separator className="my-2" />
                    <p><strong>معادلة بدل الإجازات:</strong> (أجر اليوم الواحد) × (رصيد الأيام)</p>
                    <p className="font-mono pr-4">= {formatCurrency(result.dailyWage)} × {result.leaveBalance.toFixed(1)} = {formatCurrency(result.leaveBalancePay)}</p>
                </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
