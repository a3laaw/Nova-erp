
'use server';

import type { Employee, MonthlyAttendance, Payslip } from '@/lib/types';

/**
 * Generates payslips for all active employees for a given month and year.
 * @param year The year to generate payslips for.
 * @param month The month to generate payslips for.
 * @returns An array of the generated Payslip objects.
 */
export async function generatePayslipsForMonth(year: number, month: number): Promise<Payslip[]> {
  // --- Start of new Firebase Admin init logic ---
  const admin = await import('firebase-admin');
  const { FieldValue } = admin.firestore;
  
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : undefined;

  if (!admin.apps.length) {
    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      console.error("Firebase Admin service account is not available in environment variables.");
      throw new Error("Firebase Admin service account is not available. Cannot generate payslips.");
    }
  }
  const firestore = admin.firestore();
  // --- End of new Firebase Admin init logic ---

  // 1. Fetch all active and on-leave employees
  const employeesRef = firestore.collection('employees');
  const q = employeesRef.where('status', 'in', ['active', 'on-leave']);
  const employeesSnapshot = await q.get();

  if (employeesSnapshot.empty) {
    throw new Error('لم يتم العثور على موظفين نشطين أو في إجازة لإنشاء كشوف الرواتب لهم.');
  }

  const generatedPayslips: Payslip[] = [];
  const batch = firestore.batch();

  for (const empDoc of employeesSnapshot.docs) {
    const employee = { id: empDoc.id, ...empDoc.data() } as Employee;
    
    // 2. Fetch the corresponding attendance record for the employee and month
    const attendanceId = `${year}-${String(month).padStart(2, '0')}-${employee.id}`;
    const attendanceRef = firestore.collection('attendance').doc(attendanceId);
    const attendanceSnap = await attendanceRef.get();

    let absenceDeduction = 0;
    
    // 3. Calculate deductions if attendance exists and deduction is enabled for the employee
    // Using top-level basicSalary for calculation.
    if (attendanceSnap.exists() && employee.salaryConfig?.deductForAbsence) {
        const attendanceData = attendanceSnap.data() as MonthlyAttendance;
        const absentDays = attendanceData.summary.absentDays || 0;
        
        if (absentDays > 0) {
            const dailyRate = (employee.basicSalary || 0) / 30; // Corrected: use top-level basicSalary
            absenceDeduction = dailyRate * absentDays;
        }
    }
    
    // 4. Construct the payslip object using top-level salary fields
    const earnings = {
        basicSalary: employee.basicSalary || 0,
        housingAllowance: employee.housingAllowance || 0,
        transportAllowance: employee.transportAllowance || 0,
    };
    
    const totalEarnings = earnings.basicSalary + earnings.housingAllowance + earnings.transportAllowance;
    const totalDeductions = absenceDeduction;
    const netSalary = totalEarnings - totalDeductions;
    
    const payslipId = `${year}-${String(month).padStart(2, '0')}-${employee.id}`;
    
    const newPayslipForDb = {
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
      createdAt: FieldValue.serverTimestamp(),
    };
    
    // 5. Add the new payslip to the batch write
    const payslipRef = firestore.collection('payroll').doc(payslipId);
    batch.set(payslipRef, newPayslipForDb);
    
    // Create a serializable version for the client
    const payslipForClient: Payslip = {
      id: payslipId,
      ...newPayslipForDb,
      createdAt: new Date(), // Use current date as a placeholder for the client
    };
    generatedPayslips.push(payslipForClient);
  }
  
  // 6. Commit the batch write to Firestore
  await batch.commit();
  
  return generatedPayslips;
}
