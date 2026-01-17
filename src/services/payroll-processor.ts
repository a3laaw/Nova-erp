
'use server';

import { initializeApp, getApp, getApps, type FirebaseOptions } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import type { Employee, Payslip } from '@/lib/types';


// Server-side Firebase initialization
const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getFirestoreInstance() {
    if (!firebaseConfig.projectId) {
        throw new Error("Firebase project ID is missing. Please check your environment variables.");
    }
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    return getFirestore(app);
}

/**
 * Generates payslips for all active employees for a given month and year.
 * @param year The year to generate payslips for.
 * @param month The month to generate payslips for.
 * @returns An array of the generated Payslip objects.
 */
export async function generatePayslipsForMonth(year: number, month: number): Promise<Payslip[]> {
  const firestore = getFirestoreInstance();

  // 1. Fetch all active and on-leave employees
  const employeesRef = collection(firestore, 'employees');
  const q = query(employeesRef, where('status', 'in', ['active', 'on-leave']));
  const employeesSnapshot = await getDocs(q);

  if (employeesSnapshot.empty) {
    throw new Error('لم يتم العثور على موظفين مستحقين للراتب (نشطين أو في إجازة) لهذا الشهر.');
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
        const attendanceData = attendanceSnap.data();
        const absentDays = attendanceData?.summary?.absentDays || 0;
        
        if (absentDays > 0) {
            const dailyRate = (employee.basicSalary || 0) / 30;
            absenceDeduction = dailyRate * absentDays;
        }
    }
    
    // 4. Construct the payslip object
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
      createdAt: serverTimestamp(),
    };
    
    // 5. Add the new payslip to the batch write
    const payslipRef = doc(firestore, 'payroll', payslipId);
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
