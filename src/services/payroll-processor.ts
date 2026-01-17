
'use server';

import { firestore } from '@/firebase/admin';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import type { Employee, MonthlyAttendance, Payslip } from '@/lib/types';
import { serverTimestamp } from 'firebase/firestore';

/**
 * Generates payslips for all active employees for a given month and year.
 * @param year The year to generate payslips for.
 * @param month The month to generate payslips for.
 * @returns An array of the generated Payslip objects.
 */
export async function generatePayslipsForMonth(year: number, month: number): Promise<Payslip[]> {
  // 1. Fetch all active employees
  const employeesRef = collection(firestore, 'employees');
  const q = query(employeesRef, where('status', '==', 'active'));
  const employeesSnapshot = await getDocs(q);

  if (employeesSnapshot.empty) {
    throw new Error('No active employees found to generate payroll for.');
  }

  const generatedPayslips: Payslip[] = [];
  const batch = writeBatch(firestore);

  for (const empDoc of employeesSnapshot.docs) {
    const employee = { id: empDoc.id, ...empDoc.data() } as Employee;
    
    // 2. Fetch the corresponding attendance record for the employee and month
    const attendanceId = `${year}-${String(month).padStart(2, '0')}-${employee.id}`;
    const attendanceRef = doc(firestore, 'attendance', attendanceId);
    const attendanceSnap = await getDoc(attendanceRef);

    let absenceDeduction = 0;
    
    // 3. Calculate deductions if attendance exists and deduction is enabled for the employee
    if (attendanceSnap.exists() && employee.salaryConfig?.deductForAbsence) {
        const attendanceData = attendanceSnap.data() as MonthlyAttendance;
        const absentDays = attendanceData.summary.absentDays || 0;
        
        if (absentDays > 0) {
            const dailyRate = (employee.salaryConfig.basicSalary || 0) / 30;
            absenceDeduction = dailyRate * absentDays;
        }
    }
    
    // 4. Construct the payslip object
    const earnings = {
        basicSalary: employee.salaryConfig?.basicSalary || 0,
        housingAllowance: employee.salaryConfig?.housingAllowance || 0,
        transportAllowance: employee.salaryConfig?.transportAllowance || 0,
    };
    
    const totalEarnings = earnings.basicSalary + earnings.housingAllowance + earnings.transportAllowance;
    const totalDeductions = absenceDeduction;
    const netSalary = totalEarnings - totalDeductions;
    
    const payslipId = `${year}-${String(month).padStart(2, '0')}-${employee.id}`;
    
    const newPayslip: Omit<Payslip, 'id'> = {
      employeeId: employee.id!,
      employeeName: employee.fullName,
      year: year,
      month: month,
      attendanceId: attendanceSnap.exists() ? attendanceId : undefined,
      earnings: earnings,
      deductions: {
        absenceDeduction: absenceDeduction,
        otherDeductions: 0, // Placeholder for other deduction types
      },
      netSalary: netSalary,
      status: 'draft',
      createdAt: serverTimestamp(),
    };
    
    // 5. Add the new payslip to the batch write
    const payslipRef = doc(firestore, 'payroll', payslipId);
    batch.set(payslipRef, newPayslip);
    
    generatedPayslips.push({ id: payslipId, ...newPayslip });
  }
  
  // 6. Commit the batch write to Firestore
  await batch.commit();
  
  return generatedPayslips;
}
