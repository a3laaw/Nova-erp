
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, getDocs, writeBatch, doc, getDoc, serverTimestamp, limit } from 'firebase/firestore';
import type { Employee, MonthlyAttendance, Payslip, LeaveRequest, Holiday, PermissionRequest } from '@/lib/types';
import { Loader2, Sheet, Info, FileWarning, Calculator } from 'lucide-react';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { parse, format, isSameDay, startOfDay, endOfDay } from 'date-fns';
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
  const { data: allLeaves = [], loading: leavesLoading } = useSubscription<LeaveRequest>(firestore, 'leaveRequests');
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
      const payrollStart = new Date(parseInt(year), parseInt(month) - 1, 1);
      const payrollEnd = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);

      const attendanceQuery = query(collection(firestore, 'attendance'), where('year', '==', parseInt(year)), where('month', '==', parseInt(month)));
      const permissionsQuery = query(collection(firestore, 'permissionRequests'), where('status', '==', 'approved'));
      
      const [attendanceSnap, permissionsSnap] = await Promise.all([getDocs(attendanceQuery), getDocs(permissionsQuery)]);
      
      const attendanceMap = new Map<string, MonthlyAttendance>();
      attendanceSnap.forEach(doc => {
          const data = doc.data() as MonthlyAttendance;
          attendanceMap.set(data.employeeId, {id: doc.id, ...data});
      });

      const permissionsMap = new Map<string, Map<string, string>>();
      permissionsSnap.forEach(doc => {
        const perm = doc.data() as PermissionRequest;
        const rawDate = toFirestoreDate(perm.date);
        if (rawDate && rawDate >= payrollStart && rawDate <= payrollEnd) {
            const permDateKey = format(rawDate, 'yyyy-MM-dd');
            if (!permissionsMap.has(perm.employeeId)) permissionsMap.set(perm.employeeId, new Map());
            permissionsMap.get(perm.employeeId)!.set(permDateKey, perm.type);
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
          let payslipNotes = '';

          const attendance = attendanceMap.get(employee.id);
          const employeePermissions = permissionsMap.get(employee.id);

          if (!ignoreAttendance) {
              for (let d = new Date(payrollStart); d <= payrollEnd; d.setDate(d.getDate() + 1)) {
                  const dateKey = format(d, 'yyyy-MM-dd');
                  const { workingDays } = calculateWorkingDays(d, d, companyHolidays, publicHolidays);
                  if (workingDays === 0) continue;

                  const record = attendance?.records?.find((r: any) => isSameDay(toFirestoreDate(r.date)!, d));
                  
                  // ✨ وسم رمضان لليوم المحدد
                  const isRamadanDay = ramadan?.is_enabled && ramStart && ramEnd && 
                                       d >= startOfDay(ramStart) && 
                                       d <= startOfDay(ramEnd);

                  if (record && record.checkIn1) {
                      if (record.status === 'late') {
                          if (employeePermissions?.get(dateKey) !== 'late_arrival') {
                              chargeableLateDays++;
                          }
                      }
                  } else {
                      const isOnApprovedLeave = allLeaves.some(leave => {
                          if (leave.employeeId !== employee.id || !['approved', 'on-leave', 'returned'].includes(leave.status)) return false;
                          const lStart = toFirestoreDate(leave.startDate);
                          const lEnd = toFirestoreDate(leave.endDate);
                          return lStart && lEnd && d >= startOfDay(lStart) && d <= endOfDay(lEnd);
                      });

                      if (!isOnApprovedLeave) {
                          actualAbsentDays++;
                      }
                  }
              }

              absenceDeduction = actualAbsentDays * dailyRate;
              lateDeduction = Math.floor(chargeableLateDays / 3) * dailyRate; 

              if (actualAbsentDays > 0) payslipNotes += `خصم ${actualAbsentDays} يوم غياب غير مبرر. `;
              if (chargeableLateDays > 0) {
                  payslipNotes += `تم رصد ${chargeableLateDays} أيام تأخير (تم خصم ${Math.floor(chargeableLateDays / 3)} أيام). `;
              }
          } else {
              payslipNotes = "حسبة راتب كامل بدون استقطاعات.";
          }

          const earnings = { basicSalary: employee.basicSalary || 0, housingAllowance: employee.housingAllowance || 0, transportAllowance: employee.transportAllowance || 0, commission: 0 };
          const totalEarnings = Object.values(earnings).reduce((sum, val) => sum + val, 0);
          const deductions = { absenceDeduction: absenceDeduction + lateDeduction, otherDeductions: 0 };
          const totalDeductions = Object.values(deductions).reduce((sum, val) => sum + val, 0);

          const payslipId = `${year}-${month}-${employee.id}`;
          const payslipRef = doc(firestore, 'payroll', payslipId);

          batch.set(payslipRef, cleanFirestoreData({
              employeeId: employee.id, employeeName: employee.fullName, year: parseInt(year), month: parseInt(month),
              salaryPaymentType: employee.salaryPaymentType, earnings, deductions, netSalary: totalEarnings - totalDeductions,
              status: 'draft', createdAt: serverTimestamp(), type: 'Monthly', notes: payslipNotes.trim(),
          }), { merge: true });
          payslipsCreated++;
      }
      
      await batch.commit();
      setProcessingResult(`تم بنجاح تحليل ${payslipsCreated} كشوف رواتب مع مراعاة الانتقال التلقائي لرمضان.`);
      toast({ title: 'نجاح المزامنة', description: 'تم تحديث الرواتب بناءً على معايير التقويم.' });

    } catch (error: any) {
      setProcessingResult(`فشل: ${error.message}`);
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };
  
  if (!isMounted) return null;

  return (
    <div className="grid lg:grid-cols-2 gap-8 items-start" dir="rtl">
        <div className="space-y-6">
            <h3 className="font-semibold text-lg">إعدادات الفترة</h3>
            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label>السنة</Label>
                    <Select value={year} onValueChange={setYear}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="grid gap-2">
                    <Label>الشهر</Label>
                    <Select value={month} onValueChange={setMonth}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 12 }, (_, i) => i + 1).map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}</SelectContent></Select>
                </div>
            </div>
            <div className="flex items-center space-x-2 rtl:space-x-reverse pt-2">
                <Checkbox id="ignoreAttendance" checked={ignoreAttendance} onCheckedChange={(checked) => setIgnoreAttendance(checked as boolean)} />
                <Label htmlFor="ignoreAttendance" className="cursor-pointer font-bold text-xs">صرف الراتب كاملاً (تجاهل الغياب والتأخير)</Label>
            </div>
        </div>

        <div className="border rounded-[2rem] p-8 bg-primary/5 space-y-6 border-primary/10 shadow-inner">
            <h3 className="font-black text-xl flex items-center gap-2 text-primary"><Calculator className="h-6 w-6"/> المعالجة الذكية</h3>
            <p className="text-sm leading-relaxed text-muted-foreground font-bold">
                المحرك الآن ذكي بما يكفي ليعرف أن يوم 17 فبراير يتبع قاعدة الـ 8:00 ص، ويوم 18 فبراير يتبع قاعدة الـ 9:30 ص لرمضان، وسيقوم بحساب التأخيرات لكل يوم بشكل منفصل تماماً.
            </p>
            <Button onClick={handleGeneratePayroll} disabled={isProcessing || employeesLoading || !year || !month} className="w-full h-14 rounded-2xl font-black text-lg shadow-xl">
                {isProcessing ? <Loader2 className="animate-spin ml-2 h-5 w-5" /> : <Sheet className="ml-2 h-5 w-5" />}
                توليد ومزامنة الرواتب
            </Button>
             {processingResult && <Alert className="rounded-2xl border-green-200 bg-green-50"><AlertDescription className="font-bold text-green-800">{processingResult}</AlertDescription></Alert>}
        </div>
    </div>
  );
}
