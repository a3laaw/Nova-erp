'use client';

import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import type { Employee, MonthlyAttendance, Payslip, LeaveRequest } from '@/lib/types';
import { Loader2, Sheet, Info, FileWarning } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { useAuth } from '@/context/auth-context';
import { toFirestoreDate } from '@/services/date-converter';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '../ui/separator';

export function PayrollGenerator() {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingResult, setProcessingResult] = useState<string | null>(null);
  const [ignoreAttendance, setIgnoreAttendance] = useState(false);

  const { data: employees = [], loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);
  const { data: allLeaves = [], loading: leavesLoading } = useSubscription<LeaveRequest>(firestore, 'leaveRequests');

  const [attendanceRecordsExist, setAttendanceRecordsExist] = useState(false);

  // Check if attendance for the selected month/year exists
  useEffect(() => {
    if(!firestore) return;
    const checkAttendance = async () => {
        const q = query(collection(firestore, 'attendance'), where('year', '==', parseInt(year)), where('month', '==', parseInt(month)), where('__name__', '!=', ''));
        const snap = await getDocs(q);
        setAttendanceRecordsExist(!snap.empty);
    };
    checkAttendance();
  }, [firestore, year, month]);

  const handleGeneratePayroll = async () => {
    if (!firestore || !currentUser) return;

    setIsProcessing(true);
    setProcessingResult(null);

    try {
      const attendanceQuery = query(collection(firestore, 'attendance'), where('year', '==', parseInt(year)), where('month', '==', parseInt(month)));
      const attendanceSnap = await getDocs(attendanceQuery);
      
      const attendanceMap = new Map<string, MonthlyAttendance>();
      attendanceSnap.forEach(doc => {
          const data = doc.data() as MonthlyAttendance;
          attendanceMap.set(data.employeeId, {id: doc.id, ...data});
      });
      
      const batch = writeBatch(firestore);
      let payslipsCreated = 0;

      for (const employee of employees) {
          if (!employee.id) continue;
          
          const fullSalary = (employee.basicSalary || 0) + (employee.housingAllowance || 0) + (employee.transportAllowance || 0);
          const dailyRate = fullSalary > 0 ? fullSalary / 26 : 0;

          let absenceDeduction = 0;
          let lateDeduction = 0;
          let payslipNotes = '';

          const attendance = attendanceMap.get(employee.id);
          
          if (ignoreAttendance) {
            payslipNotes = "تم احتساب حضور كامل بناءً على طلب المستخدم.";
          } else if (attendance && attendance.summary) {
              absenceDeduction = (attendance.summary.absentDays || 0) * dailyRate;
              lateDeduction = Math.floor((attendance.summary.lateDays || 0) / 3) * dailyRate;
          } else {
              const requiresAttendance = employee.contractType === 'permanent' || employee.contractType === 'temporary' || (employee.contractType === 'piece-rate' && employee.pieceRateMode === 'salary_with_target');
              if (requiresAttendance) {
                 payslipNotes = "لم يتم العثور على سجل حضور، تم احتساب الراتب على أساس الحضور الكامل.";
              }
          }

          const unpaidLeaveDaysInMonth = (allLeaves || []).reduce((totalDays, leave) => {
            if (leave.employeeId === employee.id && leave.leaveType === 'Unpaid' && leave.status === 'approved') {
                const leaveStart = toFirestoreDate(leave.startDate);
                const leaveEnd = toFirestoreDate(leave.endDate);
                const payrollStart = new Date(parseInt(year), parseInt(month) - 1, 1);
                const payrollEnd = new Date(parseInt(year), parseInt(month), 0);
                
                if(leaveStart && leaveEnd) {
                    if (leaveStart <= payrollEnd && leaveEnd >= payrollStart) {
                       return totalDays + (leave.workingDays || 0);
                    }
                }
            }
            return totalDays;
          }, 0);
          
          if (unpaidLeaveDaysInMonth > 0) {
              absenceDeduction += unpaidLeaveDaysInMonth * dailyRate;
              payslipNotes += (payslipNotes ? '\n' : '') + `تم خصم ${unpaidLeaveDaysInMonth} أيام إجازة بدون راتب.`;
          }

          const earnings = {
              basicSalary: employee.basicSalary || 0,
              housingAllowance: employee.housingAllowance || 0,
              transportAllowance: employee.transportAllowance || 0,
              commission: 0,
          };
          const totalEarnings = Object.values(earnings).reduce((sum, val) => sum + val, 0);

          const deductions = {
              absenceDeduction: absenceDeduction + lateDeduction,
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
              salaryPaymentType: employee.salaryPaymentType,
              earnings,
              deductions,
              netSalary,
              status: 'draft',
              createdAt: new Date(),
              type: 'Monthly',
              notes: payslipNotes.trim(),
              ...(attendance?.id && { attendanceId: attendance.id }),
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

  const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString('ar', { month: 'long' });

  return (
    <div className="grid lg:grid-cols-2 gap-8 items-start">
        <div className="space-y-6">
            <h3 className="font-semibold text-lg">1. حدد الإعدادات</h3>
            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="payroll-year-select">السنة</Label>
                    <Select value={year} onValueChange={setYear}>
                        <SelectTrigger id="payroll-year-select"><SelectValue /></SelectTrigger>
                        <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="payroll-month-select">الشهر</Label>
                    <Select value={month} onValueChange={setMonth}>
                        <SelectTrigger id="payroll-month-select"><SelectValue /></SelectTrigger>
                        <SelectContent>{months.map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </div>
            <div className="flex items-center space-x-2 rtl:space-x-reverse self-center pt-2">
                <Checkbox id="ignoreAttendance" checked={ignoreAttendance} onCheckedChange={(checked) => setIgnoreAttendance(checked as boolean)} />
                <Label htmlFor="ignoreAttendance">تجاهل سجلات الحضور واحتساب حضور كامل للجميع</Label>
            </div>
        </div>

        <div className="border rounded-lg p-6 bg-muted/50 space-y-4">
            <h3 className="font-semibold text-lg">2. تأكيد العملية</h3>
            <p className="text-sm text-muted-foreground">
                أنت على وشك إنشاء كشوف رواتب لشهر <strong>{monthName} {year}</strong> لـِ <strong>{employees.length}</strong> موظف نشط.
            </p>
            {!ignoreAttendance && !attendanceRecordsExist && (
                <Alert variant="destructive">
                    <FileWarning className="h-4 w-4" />
                    <AlertTitle>تنبيه</AlertTitle>
                    <AlertDescription>
                        لم يتم رفع سجلات الحضور لهذا الشهر. سيتم احتساب حضور كامل للموظفين ذوي العقود التي تتطلب حضورًا.
                    </AlertDescription>
                </Alert>
            )}
            {ignoreAttendance && (
                 <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>ملاحظة</AlertTitle>
                    <AlertDescription>
                       سيتم تجاهل أي سجلات حضور مرفوعة لهذا الشهر واحتساب حضور كامل لجميع الموظفين.
                    </AlertDescription>
                </Alert>
            )}
            <Separator />
            <Button onClick={handleGeneratePayroll} disabled={isProcessing || employeesLoading} className="w-full">
                {isProcessing ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Sheet className="ml-2 h-4 w-4" />}
                {isProcessing ? 'جاري المعالجة...' : `توليد كشوف رواتب شهر ${monthName}`}
            </Button>
             {processingResult && (
                <Alert>
                    <AlertTitle>نتيجة المعالجة</AlertTitle>
                    <AlertDescription>{processingResult}</AlertDescription>
                </Alert>
            )}
        </div>
    </div>
  );
}
