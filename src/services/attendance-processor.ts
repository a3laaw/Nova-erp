
'use server';

import { initializeApp, getApp, getApps, type FirebaseOptions } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import type { Employee, LeaveRequest, MonthlyAttendance, AttendanceRecord } from '@/lib/types';
import { getDaysInMonth, format } from 'date-fns';

interface ExcelRow {
  'الرقم المدني': string;
  'التاريخ (YYYY-MM-DD)': string;
  'وقت الدخول (HH:MM)': string;
  'وقت الخروج (HH:MM)': string;
}

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
 * Processes attendance data from an uploaded Excel file and saves it to Firestore.
 * @param data The parsed data from the Excel file.
 * @returns An object with the count of processed records and affected employees.
 */
export async function processAttendanceData(data: ExcelRow[]) {
  const firestore = getFirestoreInstance();

  if (!data || data.length === 0) {
    throw new Error('No data provided to process.');
  }

  // 1. Group records by month and civil ID
  const monthlyData = new Map<string, { employeeId: string; year: number; month: number; civilId: string; records: ExcelRow[] }>();
  const civilIds = new Set<string>();

  data.forEach(row => {
    const civilId = String(row['الرقم المدني']);
    const dateStr = row['التاريخ (YYYY-MM-DD)'];
    
    if (!civilId || !dateStr) return;

    try {
      const date = new Date(dateStr);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const key = `${year}-${month}-${civilId}`;

      civilIds.add(civilId);

      if (!monthlyData.has(key)) {
        monthlyData.set(key, { employeeId: '', year, month, civilId, records: [] });
      }
      monthlyData.get(key)!.records.push(row);
    } catch(e) {
      console.warn(`Skipping invalid date row: ${dateStr}`);
    }
  });

  if (civilIds.size === 0) {
    throw new Error("No valid records with Civil IDs found in the file.");
  }
  
  // 2. Fetch all relevant employees in one go
  const employeesRef = collection(firestore, 'employees');
  const q = query(employeesRef, where('civilId', 'in', Array.from(civilIds)));
  const employeesSnapshot = await getDocs(q);

  const civilIdToEmployeeMap = new Map<string, Employee>();
  employeesSnapshot.forEach(doc => {
    const emp = { id: doc.id, ...doc.data() } as Employee;
    civilIdToEmployeeMap.set(emp.civilId, emp);
  });
  
  // 3. Start a batch write to Firestore
  const batch = writeBatch(firestore);

  for (const [key, data] of monthlyData.entries()) {
    const employee = civilIdToEmployeeMap.get(data.civilId);
    if (!employee || !employee.id) {
      console.warn(`No employee found for Civil ID: ${data.civilId}. Skipping ${data.records.length} records.`);
      continue;
    }
    
    // Assign the correct employeeId
    data.employeeId = employee.id;

    // 4. Fetch employee's approved leaves for this month
    const leavesRef = collection(firestore, 'leaveRequests');
    const leavesQuery = query(leavesRef, where('employeeId', '==', employee.id), where('status', '==', 'approved'));
    const leavesSnapshot = await getDocs(leavesQuery);
    const approvedLeaveDays = new Set<string>();
    leavesSnapshot.forEach(doc => {
        const leave = doc.data();
        if (leave.startDate && leave.endDate) {
            const startDate = leave.startDate.toDate();
            const endDate = leave.endDate.toDate();
            for (let d = startDate; d <= endDate; d.setDate(d.getDate() + 1)) {
                if(d.getFullYear() === data.year && d.getMonth() + 1 === data.month) {
                    approvedLeaveDays.add(format(d, 'yyyy-MM-dd'));
                }
            }
        }
    });

    // 5. Process records for the month
    const totalDaysInMonth = getDaysInMonth(new Date(data.year, data.month - 1));
    const processedRecords: AttendanceRecord[] = [];
    
    const recordsByDate = new Map<string, ExcelRow>();
    data.records.forEach(r => recordsByDate.set(r['التاريخ (YYYY-MM-DD)'], r));
    
    let presentDays = 0, absentDays = 0, lateDays = 0, leaveDays = 0;

    for (let day = 1; day <= totalDaysInMonth; day++) {
        const dateStr = format(new Date(data.year, data.month - 1, day), 'yyyy-MM-dd');
        
        if (approvedLeaveDays.has(dateStr)) {
            processedRecords.push({ date: dateStr, status: 'leave' });
            leaveDays++;
            continue;
        }

        const record = recordsByDate.get(dateStr);
        if (record && record['وقت الدخول (HH:MM)'] && record['وقت الدخول (HH:MM)'] !== '-') {
            // Simple logic: present if check-in exists. Late logic can be added here.
            processedRecords.push({
                date: dateStr,
                checkIn: record['وقت الدخول (HH:MM)'],
                checkOut: record['وقت الخروج (HH:MM)'],
                status: 'present'
            });
            presentDays++;
        } else {
            // Assume absent if no record and not on leave (ignoring weekends for simplicity)
            processedRecords.push({ date: dateStr, status: 'absent' });
            absentDays++;
        }
    }
    
    // 6. Prepare the document to be saved
    const attendanceDoc: MonthlyAttendance = {
        employeeId: data.employeeId,
        year: data.year,
        month: data.month,
        records: processedRecords,
        summary: { totalDays: totalDaysInMonth, presentDays, absentDays, lateDays, leaveDays }
    };
    
    const docId = `${data.year}-${String(data.month).padStart(2, '0')}-${data.employeeId}`;
    const docRef = doc(firestore, 'attendance', docId);
    
    // Use set with merge to create or update
    batch.set(docRef, attendanceDoc, { merge: true });
  }
  
  // 7. Commit the batch
  await batch.commit();

  return {
    processedRecords: data.length,
    affectedEmployees: civilIdToEmployeeMap.size
  };
}
