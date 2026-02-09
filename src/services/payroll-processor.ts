'use server';

import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { getFirebaseServices } from '@/firebase/init';
import type { Employee, MonthlyAttendance, Payslip } from '@/lib/types';
import { numberToArabicWords } from '@/lib/utils';

interface PayrollInput {
  year: number;
  month: number; // 1-12
}

interface PayrollResult {
  success: boolean;
  message: string;
  payslipsCreated: number;
  errors: string[];
}

/**
 * Processes payroll for a given month and year for all active employees.
 * This function can be adapted to be used within a Firebase Cloud Function.
 * 
 * @param {PayrollInput} input - The year and month to process payroll for.
 * @returns {Promise<PayrollResult>} - The result of the payroll processing.
 */
export async function processMonthlyPayroll({ year, month }: PayrollInput): Promise<PayrollResult> {
  const firebaseServices = getFirebaseServices();
  if (!firebaseServices) {
    throw new Error('Firebase is not initialized.');
  }
  const { firestore } = firebaseServices;

  const result: PayrollResult = {
    success: false,
    message: '',
    payslipsCreated: 0,
    errors: [],
  };

  try {
    // 1. Fetch all active employees
    const employeesRef = collection(firestore, 'employees');
    const q = query(employeesRef, where('status', '==', 'active'));
    const activeEmployeesSnap = await getDocs(q);
    const activeEmployees = activeEmployeesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
    
    if (activeEmployees.length === 0) {
        result.message = 'No active employees found to process payroll.';
        result.success = true;
        return result;
    }

    const batch = writeBatch(firestore);

    // 2. Loop through each employee
    for (const employee of activeEmployees) {
      try {
        if (!employee.id) {
          result.errors.push(`Employee with name ${employee.fullName} is missing an ID.`);
          continue;
        }

        // 3. Find the corresponding attendance record
        const attendanceRef = collection(firestore, 'attendance');
        const attendanceQuery = query(
          attendanceRef,
          where('employeeId', '==', employee.id),
          where('year', '==', year),
          where('month', '==', month)
        );
        const attendanceSnap = await getDocs(attendanceQuery);
        
        let attendanceRecord: MonthlyAttendance | null = null;
        if (!attendanceSnap.empty) {
          attendanceRecord = { id: attendanceSnap.docs[0].id, ...attendanceSnap.docs[0].data() } as MonthlyAttendance;
        }

        const basicSalary = employee.basicSalary || 0;
        const housingAllowance = employee.housingAllowance || 0;
        const transportAllowance = employee.transportAllowance || 0;
        const grossSalary = basicSalary + housingAllowance + transportAllowance;
        
        // 4. Calculate deductions
        let absenceDeduction = 0;
        const absentDays = attendanceRecord?.summary?.absentDays || 0;
        
        if (absentDays > 0 && basicSalary > 0) {
            absenceDeduction = (basicSalary / 30) * absentDays;
        }

        // Note: Overtime calculation is not included as 'overtimeDays' is not in the provided schema.
        // This can be added here if the attendance schema is updated.

        const totalDeductions = absenceDeduction;
        const netSalary = grossSalary - totalDeductions;
        
        // 5. Create a new Payslip record
        const payslipRef = doc(collection(firestore, 'payroll'));
        
        const payslipData: Omit<Payslip, 'id'> = {
            employeeId: employee.id,
            employeeName: employee.fullName,
            year: year,
            month: month,
            attendanceId: attendanceRecord?.id,
            salaryPaymentType: employee.salaryPaymentType,
            earnings: {
                basicSalary: basicSalary,
                housingAllowance: housingAllowance,
                transportAllowance: transportAllowance,
                commission: 0 // Assuming no commission for now
            },
            deductions: {
                absenceDeduction: absenceDeduction,
                otherDeductions: 0
            },
            netSalary: netSalary,
            status: 'draft',
            createdAt: new Date()
        };

        batch.set(payslipRef, payslipData);
        result.payslipsCreated++;

      } catch (employeeError) {
        const message = employeeError instanceof Error ? employeeError.message : String(employeeError);
        result.errors.push(`Failed to process payroll for ${employee.fullName}: ${message}`);
      }
    }

    await batch.commit();

    result.success = true;
    result.message = `Payroll processing completed for ${year}-${month}. ${result.payslipsCreated} payslips created.`;
    
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.message = `An error occurred during payroll processing: ${message}`;
    result.errors.push(message);
  }

  return result;
}
