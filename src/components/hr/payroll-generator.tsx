'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import type { Employee, MonthlyAttendance, Payslip } from '@/lib/types';
import { Loader2, Sheet } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

export function PayrollGenerator() {
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingResult, setProcessingResult] = useState<string | null>(null);

  const { data: employees = [], loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);

  const handleGeneratePayroll = async () => {
    if (!firestore) return;

    setIsProcessing(true);
    setProcessingResult(null);

    try {
      const attendanceQuery = query(collection(firestore, 'attendance'), where('year', '==', parseInt(year)), where('month', '==', parseInt(month)));
      const attendanceSnap = await getDocs(attendanceQuery);
      
      if (attendanceSnap.empty) {
        throw new Error('لم يتم العثور على سجلات حضور للشهر المحدد. يرجى رفعها أولاً.');
      }
      
      const attendanceMap = new Map<string, MonthlyAttendance>();
      attendanceSnap.forEach(doc => {
          const data = doc.data() as MonthlyAttendance;
          attendanceMap.set(data.employeeId, {id: doc.id, ...data});
      });

      const batch = writeBatch(firestore);
      let payslipsCreated = 0;

      for (const employee of employees) {
          if (!employee.id) continue;
          
          const attendance = attendanceMap.get(employee.id);
          const basicSalary = employee.basicSalary || 0;
          const dailyRate = basicSalary / 30;

          let absenceDeduction = 0;
          if (attendance) {
              absenceDeduction = (attendance.summary.absentDays || 0) * dailyRate;
          }

          const earnings = {
              basicSalary: basicSalary,
              housingAllowance: employee.housingAllowance || 0,
              transportAllowance: employee.transportAllowance || 0,
          };
          const totalEarnings = Object.values(earnings).reduce((sum, val) => sum + val, 0);

          const deductions = {
              absenceDeduction: absenceDeduction,
              otherDeductions: 0,
          };
          const totalDeductions = Object.values(deductions).reduce((sum, val) => sum + val, 0);

          const netSalary = totalEarnings - totalDeductions;
          
          const payslipId = `${year}-${month}-${employee.id}`;
          const payslipRef = doc(firestore, 'payroll', payslipId);

          const payslipData: Omit<Payslip, 'id'> = {
              employeeId: employee.id,
              employeeName: employee.fullName,
              year: parseInt(year),
              month: parseInt(month),
              attendanceId: attendance?.id,
              salaryPaymentType: employee.salaryPaymentType,
              earnings,
              deductions,
              netSalary,
              status: 'draft',
              createdAt: new Date(),
          };
          
          batch.set(payslipRef, payslipData, { merge: true });
          payslipsCreated++;
      }
      
      await batch.commit();

      const message = `تم إنشاء أو تحديث ${payslipsCreated} كشوف رواتب بنجاح للشهر المحدد.`;
      setProcessingResult(message);
      toast({ title: 'نجاح', description: message });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'فشل إنشاء كشوف الرواتب.';
      setProcessingResult(message);
      toast({ variant: 'destructive', title: 'خطأ', description: message });
    } finally {
      setIsProcessing(false);
    }
  };
  
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div className="grid gap-2">
          <Label htmlFor="payroll-year-select">السنة</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger id="payroll-year-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="payroll-month-select">الشهر</Label>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger id="payroll-month-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              {months.map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
         <Button onClick={handleGeneratePayroll} disabled={isProcessing || employeesLoading}>
            {isProcessing ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Sheet className="ml-2 h-4 w-4" />}
            {isProcessing ? 'جاري المعالجة...' : 'توليد كشوف الرواتب'}
          </Button>
      </div>

       {processingResult && (
        <Alert>
            <AlertTitle>نتيجة المعالجة</AlertTitle>
            <AlertDescription>{processingResult}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
