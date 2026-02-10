'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, getDocs, writeBatch, doc, Timestamp, limit, getDoc } from 'firebase/firestore';
import type { Employee, MonthlyAttendance, Payslip, Account, JournalEntry, LeaveRequest } from '@/lib/types';
import { Loader2, Sheet, RefreshCw } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { useAuth } from '@/context/auth-context';
import { createNotification } from '@/services/notification-service';

export function PayrollGenerator() {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingResult, setProcessingResult] = useState<string | null>(null);

  const [isSettlingCommissions, setIsSettlingCommissions] = useState(false);
  const [settleResult, setSettleResult] = useState<string | null>(null);


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
          
          const fullSalary = (employee.basicSalary || 0) + (employee.housingAllowance || 0) + (employee.transportAllowance || 0);
          const dailyRate = fullSalary / 26;

          let absenceDeduction = 0;
          let lateDeduction = 0;

          const attendance = attendanceMap.get(employee.id);
          if (attendance) {
              absenceDeduction = (attendance.summary.absentDays || 0) * dailyRate;
              lateDeduction = Math.floor((attendance.summary.lateDays || 0) / 3) * dailyRate;
          }

          const earnings = {
              basicSalary: employee.basicSalary || 0,
              housingAllowance: employee.housingAllowance || 0,
              transportAllowance: employee.transportAllowance || 0,
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
              attendanceId: attendanceMap.get(employee.id)?.id,
              salaryPaymentType: employee.salaryPaymentType,
              earnings,
              deductions,
              netSalary,
              status: 'draft',
              createdAt: new Date(),
              type: 'Monthly',
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

  const handleSettleCommissions = async () => {
    if (!firestore || !currentUser) return;
    setIsSettlingCommissions(true);
    setSettleResult(null);

    try {
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
        
        const accruedSalaryAccountQuery = query(collection(firestore, 'chartOfAccounts'), where('code', '==', '210201'), limit(1));
        const cashAccountQuery = query(collection(firestore, 'chartOfAccounts'), where('code', '==', '110101'), limit(1));
        const [accruedSalarySnap, cashSnap] = await Promise.all([getDocs(accruedSalaryAccountQuery), getDocs(cashAccountQuery)]);

        if (accruedSalarySnap.empty || cashSnap.empty) {
            throw new Error("لم يتم العثور على حسابات الرواتب المستحقة أو الصندوق. يرجى مراجعة شجرة الحسابات.");
        }
        const accruedSalaryAccount = { id: accruedSalarySnap.docs[0].id, ...accruedSalarySnap.docs[0].data() as Account };
        const cashAccount = { id: cashSnap.docs[0].id, ...cashSnap.docs[0].data() as Account };


        const commissionEntriesQuery = query(
            collection(firestore, 'journalEntries'),
            where('status', '==', 'posted'),
            where('date', '>=', Timestamp.fromDate(startDate)),
            where('date', '<=', Timestamp.fromDate(endDate)),
            where('linkedReceiptId', '!=', null)
        );
        const commissionEntriesSnap = await getDocs(commissionEntriesQuery);
        
        const commissionsByEmployee = new Map<string, { total: number, employeeName: string }>();

        commissionEntriesSnap.forEach(doc => {
            const entry = doc.data() as JournalEntry;
            entry.lines.forEach(line => {
                if (line.accountId === accruedSalaryAccount.id && line.auto_resource_id) {
                    const empId = line.auto_resource_id;
                    const emp = employees.find(e => e.id === empId);
                    if (emp) {
                        const current = commissionsByEmployee.get(empId) || { total: 0, employeeName: emp.fullName };
                        current.total += line.credit || 0;
                        commissionsByEmployee.set(empId, current);
                    }
                }
            });
        });

        if (commissionsByEmployee.size === 0) {
            throw new Error("لا توجد عمولات مسجلة ومرحّلة لهذا الشهر ليتم تسويتها.");
        }

        const batch = writeBatch(firestore);
        let settledEmployeesCount = 0;
        const notificationPromises: Promise<void>[] = [];

        const accountantsQuery = query(collection(firestore, 'users'), where('role', '==', 'Accountant'));
        const accountantsSnap = await getDocs(accountantsQuery);
        const accountantUserIds = accountantsSnap.docs.map(doc => doc.id);

        const currentYear = new Date().getFullYear();
        const jeCounterRef = doc(firestore, 'counters', 'journalEntries');
        const jeCounterDoc = await getDoc(jeCounterRef);
        let jeNextNumber = ((jeCounterDoc.data()?.counts || {})[currentYear] || 0) + 1;


        for (const [employeeId, data] of commissionsByEmployee.entries()) {
            if (data.total > 0) {
                const newEntryNumber = `JV-${currentYear}-${String(jeNextNumber).padStart(4, '0')}`;
                jeNextNumber++;

                const settlementEntryRef = doc(collection(firestore, 'journalEntries'));
                const settlementEntryData = {
                    entryNumber: newEntryNumber,
                    date: serverTimestamp(),
                    narration: `تسوية عمولات ${data.employeeName} عن شهر ${month}/${year}`,
                    totalDebit: data.total,
                    totalCredit: data.total,
                    status: 'draft',
                    lines: [
                        { accountId: accruedSalaryAccount.id, accountName: accruedSalaryAccount.name, debit: data.total, credit: 0, auto_resource_id: employeeId },
                        { accountId: cashAccount.id, accountName: cashAccount.name, debit: 0, credit: data.total }
                    ],
                    createdAt: serverTimestamp(),
                    createdBy: currentUser?.id,
                };
                batch.set(settlementEntryRef, settlementEntryData);

                accountantUserIds.forEach(userId => {
                   notificationPromises.push(createNotification(firestore, {
                        userId,
                        title: 'قيد تسوية عمولات جاهز للمراجعة',
                        body: `تم إنشاء قيد تسوية عمولات للموظف ${data.employeeName} عن شهر ${month}/${year}. الرجاء مراجعته وترحيله.`,
                        link: `/dashboard/accounting/journal-entries/${settlementEntryRef.id}`
                   }));
                });

                settledEmployeesCount++;
            }
        }
        
        batch.set(jeCounterRef, { counts: { [currentYear]: jeNextNumber - 1 } }, { merge: true });
        
        await batch.commit();
        await Promise.all(notificationPromises);

        const message = `تم إنشاء قيود تسوية غير مرحّلة لـ ${settledEmployeesCount} موظف بنجاح.`;
        setSettleResult(message);
        toast({ title: 'نجاح', description: message });

    } catch (error) {
        const message = error instanceof Error ? error.message : 'فشل تسوية العمولات.';
        setSettleResult(message);
        toast({ variant: 'destructive', title: 'خطأ', description: message });
    } finally {
        setIsSettlingCommissions(false);
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
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
         <Button onClick={handleSettleCommissions} disabled={isSettlingCommissions || employeesLoading} variant="outline">
            {isSettlingCommissions ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <RefreshCw className="ml-2 h-4 w-4" />}
            {isSettlingCommissions ? 'جاري التسوية...' : 'تسوية العمولات'}
          </Button>
      </div>

       {processingResult && (
        <Alert>
            <AlertTitle>نتيجة معالجة الرواتب</AlertTitle>
            <AlertDescription>{processingResult}</AlertDescription>
        </Alert>
      )}
       {settleResult && (
        <Alert variant="default" className="bg-blue-50 border-blue-200">
            <AlertTitle className="text-blue-800">نتيجة تسوية العمولات</AlertTitle>
            <AlertDescription className="text-blue-700">{settleResult}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
