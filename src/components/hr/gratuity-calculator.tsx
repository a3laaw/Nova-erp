
'use client';

import { useState, useMemo, useEffect } from 'react';
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

const calculateAnnualLeaveBalance = (employee: Employee | null): number => {
    if (!employee) return 0;
    const hireDate = new Date(employee.hireDate);
    const today = new Date();
    const yearsOfService = (today.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

    if (yearsOfService < 1) {
        return 0;
    }
    
    const accrued = employee.annualLeaveAccrued || 0;
    const used = employee.annualLeaveUsed || 0;
    const carried = employee.carriedLeaveDays || 0;

    const totalBalance = accrued + Math.min(carried, 15) - used;
    
    return Math.min(45, totalBalance);
};


export function GratuityCalculator() {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [terminationDate, setTerminationDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [terminationReason, setTerminationReason] = useState<TerminationReason | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

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

    const totalMonthlySalary =
      (selectedEmployee.basicSalary || 0) +
      (selectedEmployee.housingAllowance || 0) +
      (selectedEmployee.transportAllowance || 0);

    let gratuity = 0;
    if (yearsOfService >= 1) {
        if (terminationReason === 'resignation') {
            if (yearsOfService < 3) {
                gratuity = totalMonthlySalary * 0.5 * yearsOfService;
            } else {
                gratuity = totalMonthlySalary * yearsOfService;
            }
        } else { // 'termination' (by employer)
            gratuity = totalMonthlySalary * yearsOfService;
        }
    }
    
    const leaveBalance = calculateAnnualLeaveBalance(selectedEmployee);
    const leavePayout = (totalMonthlySalary / 30) * leaveBalance;
    
    const totalPayout = gratuity + leavePayout;

    return { yearsOfService, totalMonthlySalary, gratuity, leaveBalance, leavePayout, totalPayout, error: null };
  }, [selectedEmployee, terminationDate, terminationReason]);

  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle>حاسبة مكافأة نهاية الخدمة</CardTitle>
        <CardDescription>
          حساب تقديري لمكافأة نهاية الخدمة وبدل الإجازات وفقاً لقانون العمل الكويتي.
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
              disabled={!isClient}
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

        {isClient && calculationResult && !calculationResult.error && selectedEmployee && (
          <Alert>
             <Landmark className="h-4 w-4" />
            <AlertTitle>ملخص الحساب (وفقاً للمادة 64 من قانون العمل الكويتي)</AlertTitle>
            <AlertDescription>
              <div className="mt-4 space-y-3">
                <div className='flex justify-between'>
                    <span>سنوات الخدمة المكتملة:</span>
                    <span className='font-bold'>{calculationResult.yearsOfService} سنة</span>
                </div>
                 {terminationReason === 'resignation' && calculationResult.yearsOfService < 3 && calculationResult.yearsOfService >= 1 && (
                    <p className='text-xs text-amber-700 p-2 bg-amber-50 rounded-md'>
                        ملاحظة: الموظف مستحق لنصف شهر راتب عن كل سنة خدمة لتقديم استقالته قبل إكمال 3 سنوات.
                    </p>
                 )}
                <div className='flex justify-between'>
                    <span>الراتب الشهري المحتسب:</span>
                    <span className='font-mono'>{formatCurrency(calculationResult.totalMonthlySalary)}</span>
                </div>
                 <hr className='my-2' />
                <div className='flex justify-between'>
                    <span>مكافأة نهاية الخدمة المستحقة:</span>
                    <span className='font-mono'>{formatCurrency(calculationResult.gratuity)}</span>
                </div>
                <div className='flex justify-between'>
                    <span>بدل رصيد الإجازات ({calculationResult.leaveBalance} يوم):</span>
                    <span className='font-mono'>{formatCurrency(calculationResult.leavePayout)}</span>
                </div>
                <hr className='my-2 border-dashed' />
                <div className='flex justify-between items-center text-lg'>
                    <span className='font-semibold'>إجمالي المستحقات التقريبية:</span>
                    <span className='font-bold text-primary'>{formatCurrency(calculationResult.totalPayout)}</span>
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
            هذا الحساب هو تقدير تقريبي ومبني على البيانات المدخلة. المحسوب وفقًا لقانون العمل الكويتي رقم 6 لسنة 2010. لا تُستحق مكافأة نهاية الخدمة إذا كانت مدة الخدمة أقل من سنة واحدة. يجب مراجعة الحسابات النهائية من قبل قسم المحاسبة.
            </AlertDescription>
        </Alert>

      </CardContent>
    </Card>
  );
}
