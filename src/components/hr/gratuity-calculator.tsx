
'use client';

import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { initialEmployees } from './employees-table';
import type { Employee } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Calculator, Landmark, ShieldCheck } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

type TerminationReason = 'resignation' | 'termination';

export function GratuityCalculator() {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [terminationDate, setTerminationDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [terminationReason, setTerminationReason] = useState<TerminationReason | null>(null);

  const selectedEmployee = useMemo(() => {
    return initialEmployees.find((emp) => emp.id === selectedEmployeeId) || null;
  }, [selectedEmployeeId]);

  const calculationResult = useMemo(() => {
    if (!selectedEmployee || !terminationDate || !terminationReason) {
      return null;
    }

    const hireDate = new Date(selectedEmployee.hireDate);
    const termDate = new Date(terminationDate);

    if (termDate < hireDate) {
        return { error: 'تاريخ انتهاء الخدمة لا يمكن أن يكون قبل تاريخ التعيين.' };
    }

    const yearsOfService = Math.floor((termDate.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25));

    if (yearsOfService < 1) {
      return { yearsOfService, totalMonthlySalary: 0, gratuity: 0 };
    }

    const totalMonthlySalary =
      (selectedEmployee.basicSalary || 0) +
      (selectedEmployee.housingAllowance || 0) +
      (selectedEmployee.transportAllowance || 0);

    let gratuity = 0;

    if (terminationReason === 'resignation') {
      if (yearsOfService < 3) {
        gratuity = totalMonthlySalary * 0.5 * yearsOfService;
      } else {
        gratuity = totalMonthlySalary * yearsOfService;
      }
    } else { // 'termination'
      gratuity = totalMonthlySalary * yearsOfService;
    }

    return { yearsOfService, totalMonthlySalary, gratuity, error: null };
  }, [selectedEmployee, terminationDate, terminationReason]);

  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle>حاسبة مكافأة نهاية الخدمة</CardTitle>
        <CardDescription>
          حساب تقديري لمكافأة نهاية الخدمة وفقاً لقانون العمل الكويتي.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="employee">اختر الموظف</Label>
            <Select onValueChange={setSelectedEmployeeId} dir="rtl">
              <SelectTrigger id="employee">
                <SelectValue placeholder="قائمة الموظفين..." />
              </SelectTrigger>
              <SelectContent>
                {initialEmployees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="termination-date">تاريخ انتهاء الخدمة</Label>
            <Input
              id="termination-date"
              type="date"
              value={terminationDate}
              onChange={(e) => setTerminationDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="termination-reason">سبب انتهاء الخدمة</Label>
            <Select onValueChange={(v) => setTerminationReason(v as TerminationReason)} dir='rtl'>
              <SelectTrigger id="termination-reason">
                <SelectValue placeholder="اختر السبب..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="resignation">استقالة</SelectItem>
                <SelectItem value="termination">إنهاء من صاحب العمل</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {calculationResult && !calculationResult.error && selectedEmployee && (
          <Alert>
             <Landmark className="h-4 w-4" />
            <AlertTitle>ملخص الحساب</AlertTitle>
            <AlertDescription>
              <div className="mt-4 space-y-3">
                <div className='flex justify-between'>
                    <span>سنوات الخدمة الكاملة:</span>
                    <span className='font-bold'>{calculationResult.yearsOfService} سنة</span>
                </div>
                <div className='flex justify-between'>
                    <span>الراتب الشهري المحتسب:</span>
                    <span className='font-mono'>{formatCurrency(calculationResult.totalMonthlySalary)}</span>
                </div>
                <hr className='my-2' />
                <div className='flex justify-between items-center text-lg'>
                    <span className='font-semibold'>القيمة التقريبية للمكافأة:</span>
                    <span className='font-bold text-primary'>{formatCurrency(calculationResult.gratuity)}</span>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {calculationResult?.error && (
            <Alert variant="destructive">
                <Calculator className="h-4 w-4" />
                <AlertTitle>خطأ في الحساب</AlertTitle>
                <AlertDescription>{calculationResult.error}</AlertDescription>
            </Alert>
        )}

        {!selectedEmployeeId && (
             <div className="p-8 text-center border-2 border-dashed rounded-lg">
                <Calculator className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">ابدأ الحساب</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                    الرجاء اختيار موظف وتحديد تفاصيل إنهاء الخدمة لبدء العملية.
                </p>
            </div>
        )}

        <Alert variant="default" className="bg-muted/50 mt-8">
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>ملاحظة قانونية</AlertTitle>
            <AlertDescription>
            هذا الحساب هو تقدير تقريبي ومبني على البيانات المدخلة. المحسوب وفقًا لقانون العمل الكويتي رقم 6 لسنة 2010. يجب مراجعة الحسابات النهائية من قبل قسم المحاسبة.
            </AlertDescription>
        </Alert>

      </CardContent>
    </Card>
  );
}
