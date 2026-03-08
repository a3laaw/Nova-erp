'use client';

import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, getDocs, writeBatch, doc, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { Employee, MonthlyAttendance, Payslip, LeaveRequest, Holiday, PermissionRequest } from '@/lib/types';
import { Loader2, Sheet, Calculator, Info } from 'lucide-react';
import { cleanFirestoreData } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { isSameDay, startOfMonth, endOfMonth, startOfDay, endOfDay, format } from 'date-fns';
import { toFirestoreDate } from '@/services/date-converter';
import { useAuth } from '@/context/auth-context';
import { Checkbox } from '../ui/checkbox';
import { calculateWorkingDays } from '@/services/leave-calculator';
import { useBranding } from '@/context/branding-context';

export function PayrollGenerator() {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const { branding } = useBranding();

  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingResult, setProcessingResult] = useState<string | null>(null);
  const [ignoreAttendance, setIgnoreAttendance] = useState(false);

  const { data: employees = [], loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);
  const { data: allLeaves = [] } = useSubscription<LeaveRequest>(firestore, 'leaveRequests', [where('status', 'in', ['approved', 'on-leave', 'returned'])]);
  const { data: publicHolidays = [] } = useSubscription<Holiday>(firestore, 'holidays');

  useEffect(() => {
    setIsMounted(true);
    const now = new Date();
    setYear(now.getFullYear().toString());
    setMonth((now.getMonth() + 1).toString());
  }, []);

  const handleGeneratePayroll = async () => {
    if (!firestore || !currentUser || !year || !month) return;

    setIsProcessing(true);
    setProcessingResult(null);

    try {
      const selectedYearNum = parseInt(year);
      const selectedMonthNum = parseInt(month);
      const payrollStart = startOfMonth(new Date(selectedYearNum, selectedMonthNum - 1));
      const payrollEnd = endOfMonth(new Date(selectedYearNum, selectedMonthNum - 1));

      const attendanceQuery = query(
          collection(firestore, 'attendance'), 
          where('year', '==', selectedYearNum), 
          where('month', '==', selectedMonthNum)
      );
      const permissionsQuery = query(collection(firestore, 'permissionRequests'), where('status', '==', 'approved'));
      
      const [attendanceSnap, permissionsSnap] = await Promise.all([getDocs(attendanceQuery), getDocs(permissionsQuery)]);
      
      const attendanceMap = new Map<string, MonthlyAttendance>();
      attendanceSnap.forEach(doc => {
          const data = doc.data() as MonthlyAttendance;
          attendanceMap.set(data.employeeId, { id: doc.id, ...data });
      });

      const permissionsMap = new Map<string, Map<string, string>>();
      permissionsSnap.forEach(doc => {
        const perm = doc.data() as PermissionRequest;
        const rawDate = toFirestoreDate(perm.date);
        if (rawDate && rawDate >= payrollStart && rawDate <= payrollEnd) {
            const dateKey = format(rawDate, 'yyyy-MM-dd');
            if (!permissionsMap.has(perm.employeeId)) permissionsMap.set(perm.employeeId, new Map());
            permissionsMap.get(perm.employeeId)!.set(dateKey, perm.type);
        }
      });
      
      const batch = writeBatch(firestore);
      const companyHolidays = branding?.work_hours?.holidays || [];
      const ramadan = branding?.work_hours?.ramadan;
      const ramStart = toFirestoreDate(ramadan?.start_date);
      const ramEnd = toFirestoreDate(ramadan?.end_date);

      let payslipsCreated = 0;

      for (const employee of employees) {
          if (!employee.id) continue;
          
          const fullSalary = (employee.basicSalary || 0) + (employee.housingAllowance || 0) + (employee.transportAllowance || 0);
          const dailyRate = fullSalary > 0 ? fullSalary / 26 : 0;

          let absenceDeduction = 0;
          let lateDeduction = 0;
          let chargeableLateDays = 0;
          let actualAbsentDays = 0;
          let logs: string[] = [];

          const attendance = attendanceMap.get(employee.id);
          const employeePermissions = permissionsMap.get(employee.id);

          if (!ignoreAttendance) {
              // 🛡️ الرقابة اليومية الصارمة: المرور على كل يوم في الشهر
              for (let d = new Date(payrollStart); d <= payrollEnd; d.setDate(d.getDate() + 1)) {
                  const dateKey = format(d, 'yyyy-MM-dd');
                  
                  // 1. هل هو يوم عمل أصلاً؟ (استثناء العطل والجمعة)
                  const { workingDays } = calculateWorkingDays(d, d, companyHolidays, publicHolidays);
                  if (workingDays === 0) continue;

                  // 2. البحث عن بصمة لهذا اليوم تحديداً
                  const record = attendance?.records?.find((r: any) => {
                      const punchDate = toFirestoreDate(r.date);
                      return punchDate && isSameDay(punchDate, d);
                  });
                  
                  if (record && record.checkIn1) {
                      // الموظف حضر -> فحص التأخير
                      if (record.status === 'late') {
                          if (employeePermissions?.get(dateKey) !== 'late_arrival') {
                              chargeableLateDays++;
                          }
                      }
                  } else {
                      // الموظف لم يحضر -> فحص الإجازات المعتمدة
                      const isOnApprovedLeave = allLeaves.some(leave => {
                          if (leave.employeeId !== employee.id) return false;
                          const lStart = startOfDay(toFirestoreDate(leave.startDate)!);
                          const lEnd = endOfDay(toFirestoreDate(leave.endDate)!);
                          return d >= lStart && d <= lEnd;
                      });

                      if (!isOnApprovedLeave) {
                          // غياب حقيقي وغير مبرر
                          actualAbsentDays++;
                      }
                  }
              }

              absenceDeduction = actualAbsentDays * dailyRate;
              lateDeduction = Math.floor(chargeableLateDays / 3) * dailyRate; 

              if (actualAbsentDays > 0) logs.push(`خصم ${actualAbsentDays} يوم غياب غير مبرر.`);
              if (chargeableLateDays > 0) {
                  logs.push(`رصد ${chargeableLateDays} أيام تأخير (خصم ${Math.floor(chargeableLateDays / 3)} أيام).`);
              }
          } else {
              logs.push("صرف راتب كامل (تجاهل الرقابة).");
          }

          const earnings = { 
              basicSalary: employee.basicSalary || 0, 
              housingAllowance: employee.housingAllowance || 0, 
              transportAllowance: employee.transportAllowance || 0, 
              commission: 0 
          };
          const totalEarnings = Object.values(earnings).reduce((sum, val) => sum + val, 0);
          const deductions = { absenceDeduction: absenceDeduction + lateDeduction, otherDeductions: 0 };
          const totalDeductions = Object.values(deductions).reduce((sum, val) => sum + val, 0);

          const payslipId = `${year}-${month}-${employee.id}`;
          const payslipRef = doc(firestore, 'payroll', payslipId);

          batch.set(payslipRef, cleanFirestoreData({
              employeeId: employee.id, 
              employeeName: employee.fullName, 
              year: selectedYearNum, 
              month: selectedMonthNum,
              salaryPaymentType: employee.salaryPaymentType, 
              earnings, 
              deductions, 
              netSalary: Math.max(0, totalEarnings - totalDeductions),
              status: 'draft', 
              createdAt: serverTimestamp(), 
              type: 'Monthly', 
              notes: logs.join(' '),
          }), { merge: true });
          payslipsCreated++;
      }
      
      await batch.commit();
      setProcessingResult(`نجاح الرقابة: تم اكتشاف الغيابات وتوليد ${payslipsCreated} كشوف رواتب.`);
      toast({ title: 'نجاح المعالجة', description: 'تم تحديث الرواتب بناءً على فحص الحضور اليومي.' });

    } catch (error: any) {
      setProcessingResult(`خطأ: ${error.message}`);
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };
  
  if (!isMounted) return null;

  return (
    <div className="grid lg:grid-cols-2 gap-8 items-start" dir="rtl">
        <div className="space-y-6">
            <h3 className="font-semibold text-lg">تحديد فترة المعالجة</h3>
            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label>السنة</Label>
                    <Select value={year} onValueChange={setYear}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2">
                    <Label>الشهر</Label>
                    <Select value={month} onValueChange={setMonth}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{Array.from({ length: 12 }, (_, i) => i + 1).map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </div>
            <div className="flex items-center space-x-2 rtl:space-x-reverse pt-2">
                <Checkbox id="ignoreAttendance" checked={ignoreAttendance} onCheckedChange={(checked) => setIgnoreAttendance(checked as boolean)} />
                <Label htmlFor="ignoreAttendance" className="cursor-pointer font-bold text-xs text-red-600">تجاوز الرقابة وصرف الراتب كاملاً</Label>
            </div>
        </div>

        <div className="border rounded-[2.5rem] p-8 bg-primary/5 space-y-6 border-primary/10 shadow-inner">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-2xl text-primary"><Calculator className="h-6 w-6"/></div>
                <h3 className="font-black text-xl">محرك الرقابة اليومية الصارم</h3>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground font-bold">
                المحرك الآن لا يعتمد على ملخص الملف المرفوع؛ بل يقوم بمسح كل يوم عمل في الشهر. إذا لم يجد بصمة دخول للموظف في يوم عمل ولم يجد إجازة معتمدة تغطي ذلك التاريخ، سيتم احتسابه غياباً فوراً وخصم أجره.
            </p>
            <Button onClick={handleGeneratePayroll} disabled={isProcessing || employeesLoading || !year || !month} className="w-full h-14 rounded-2xl font-black text-lg shadow-xl gap-2">
                {isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : <Sheet className="h-5 w-5" />}
                بدء فحص الحضور وتوليد الرواتب
            </Button>
             {processingResult && <Alert className="rounded-2xl border-green-200 bg-green-50"><AlertDescription className="font-bold text-green-800">{processingResult}</AlertDescription></Alert>}
        </div>
    </div>
  );
}
