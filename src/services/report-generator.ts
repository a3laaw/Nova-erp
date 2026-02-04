
'use server';

import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  type Firestore,
  type DocumentData,
  doc,
  getDoc,
} from 'firebase/firestore';
import type { Employee, LeaveRequest, AuditLog, Holiday } from '@/lib/types';
import { format, differenceInYears, eachDayOfInterval, isFriday, intervalToDuration, parseISO } from 'date-fns';
import { toFirestoreDate, fromFirestoreDate } from './date-converter';
import { calculateAnnualLeaveBalance } from './leave-calculator';

export type ReportType = 'EmployeeDossier' | 'EmployeeRoster';

export interface ReportHeader {
  key: string;
  label: string;
  type?: 'date' | 'currency' | 'number' | 'component';
}

export interface ReportFooter {
  colSpan: number;
  label: string;
  value: string | number;
  type?: 'date' | 'currency' | 'number';
}

export interface StandardReportData {
  type: 'EmployeeRoster';
  title: string;
  subtitle: string;
  headers: ReportHeader[];
  rows: DocumentData[];
  footer?: ReportFooter;
}

export interface DossierReportData {
  type: 'EmployeeDossier';
  employee: Employee;
}

export interface BulkReportData {
  type: 'BulkEmployeeDossiers';
  dossiers: Employee[];
}

export type ReportData = StandardReportData | DossierReportData | BulkReportData;

interface ReportOptions {
  asOfDate: string;
  employeeId?: string;
  statusFilter?: 'active' | 'all';
}

// --- Helper Functions ---

/**
 * Finds the correct value of a field as of a specific date by searching through sorted audit logs.
 */
function findValueAsOf(logs: AuditLog[], field: keyof Employee, asOfDate: Date, initialValue: any) {
  // .find() is efficient because the logs are pre-sorted by Firestore.
  const relevantLog = logs.find(log => {
    const effectiveDate = toFirestoreDate(log.effectiveDate);
    return log.field === field && effectiveDate && effectiveDate <= asOfDate;
  });
  return relevantLog ? relevantLog.newValue : initialValue;
}

/**
 * Fetches all necessary data for a single employee and reconstructs their state
 * as of a specific date. This is the core "time-travel" logic.
 */
async function reconstructEmployeeState(db: Firestore, employeeId: string, asOfDate: Date): Promise<Employee> {
  try {
    const [empSnap, auditLogsSnap, leaveRequestsSnap] = await Promise.all([
      getDoc(doc(db, 'employees', employeeId)),
      getDocs(query(collection(db, `employees/${employeeId}/auditLogs`), orderBy('effectiveDate', 'desc'), limit(500))),
      getDocs(query(collection(db, 'leaveRequests'), where('employeeId', '==', employeeId))),
    ]);

    if (!empSnap.exists()) {
      throw new Error(`Employee with ID ${employeeId} not found.`);
    }

    const baseEmployee = { id: empSnap.id, ...empSnap.data() } as Employee;
    const auditLogs = auditLogsSnap.docs.map(d => d.data() as AuditLog);
    const allLeaveRequests = leaveRequestsSnap.docs.map(d => ({ id: d.id, ...d.data() } as LeaveRequest));

    const hireDate = toFirestoreDate(baseEmployee.hireDate);
    if (!hireDate) {
      throw new Error(`Invalid hire date for employee ID: ${employeeId}`);
    }

    // --- Reconstruct state as of the report date ---
    const reconstructedState: Partial<Employee> = {
      ...baseEmployee, // Start with current data, then override with historical values
      jobTitle: findValueAsOf(auditLogs, 'jobTitle', asOfDate, baseEmployee.jobTitle),
      department: findValueAsOf(auditLogs, 'department', asOfDate, baseEmployee.department),
      basicSalary: findValueAsOf(auditLogs, 'basicSalary', asOfDate, baseEmployee.basicSalary),
      housingAllowance: findValueAsOf(auditLogs, 'housingAllowance', asOfDate, baseEmployee.housingAllowance),
      transportAllowance: findValueAsOf(auditLogs, 'transportAllowance', asOfDate, baseEmployee.transportAllowance),
    };

    // --- Calculate dynamic values based on reconstructed state ---
    const leaveBalance = calculateAnnualLeaveBalance(baseEmployee, asOfDate);
    const lastReturn = allLeaveRequests
      .filter(lr => {
        const returnDate = toFirestoreDate(lr.actualReturnDate);
        return lr.isBackFromLeave && returnDate && returnDate <= asOfDate;
      })
      .sort((a, b) => (toFirestoreDate(b.actualReturnDate)?.getTime() || 0) - (toFirestoreDate(a.actualReturnDate)?.getTime() || 0))[0] || null;

    const serviceDuration = intervalToDuration({ start: hireDate, end: asOfDate });
    const serviceInYears = (asOfDate.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    let calculatedEosb = 0;
    const currentSalary = reconstructedState.basicSalary || 0;

    if (serviceInYears > 0 && currentSalary > 0) {
      if (serviceInYears <= 5) {
        calculatedEosb = (15 / 26) * currentSalary * serviceInYears;
      } else {
        const first5YearsGratuity = (15 / 26) * currentSalary * 5;
        const remainingYearsGratuity = currentSalary * (serviceInYears - 5);
        calculatedEosb = first5YearsGratuity + remainingYearsGratuity;
      }
    }

    // Combine base, reconstructed, and calculated data into a final object
    const finalEmployeeData = {
      ...baseEmployee,
      ...reconstructedState,
      auditLogs,
      eosb: calculatedEosb,
      leaveBalance,
      lastLeave: lastReturn,
      serviceDuration,
    };

    return finalEmployeeData;

  } catch (error) {
    console.error(`Failed to reconstruct state for employee ${employeeId}:`, error);
    throw new Error(`Could not generate report for employee ${employeeId}. Please check their data. Original error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// --- Main Exported Server Action ---

export async function generateReport(db: Firestore, reportType: ReportType, options: ReportOptions): Promise<ReportData> {
  let result: ReportData;

  try {
    const asOfDate = parseISO(options.asOfDate);

    if (reportType === 'EmployeeRoster') {
      const q = options.statusFilter === 'all'
        ? query(collection(db, 'employees'))
        : query(collection(db, 'employees'), where('status', '==', 'active'));
        
      const empSnap = await getDocs(q);
      const rows = empSnap.docs
        .map(doc => doc.data() as Employee)
        .map(emp => {
            const hireDate = toFirestoreDate(emp.hireDate);
            const serviceYears = hireDate ? differenceInYears(asOfDate, hireDate) : 0;
            return {
                ...emp,
                hireDate, // pass date object
                serviceYears,
            };
        })
        .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', 'ar'));

      result = {
        type: 'EmployeeRoster',
        title: 'قائمة الموظفين',
        subtitle: `الحالة كما في تاريخ: ${format(asOfDate, 'dd/MM/yyyy')}`,
        headers: [
          { key: 'employeeNumber', label: 'الرقم الوظيفي' },
          { key: 'fullName', label: 'الاسم الكامل' },
          { key: 'department', label: 'القسم' },
          { key: 'jobTitle', label: 'المسمى الوظيفي' },
          { key: 'status', label: 'الحالة', type: 'component' },
          { key: 'hireDate', label: 'تاريخ التعيين', type: 'date' },
          { key: 'serviceYears', label: 'سنوات الخدمة', type: 'number' },
        ],
        rows,
      };
    } else if (reportType === 'EmployeeDossier') {
      if (!options.employeeId) throw new Error("Employee ID is required for Dossier report.");

      if (options.employeeId !== 'all') {
        const employeeData = await reconstructEmployeeState(db, options.employeeId, asOfDate);
        result = {
          type: 'EmployeeDossier',
          employee: employeeData,
        };
      } else {
        const q = options.statusFilter === 'all'
          ? query(collection(db, 'employees'), limit(50))
          : query(collection(db, 'employees'), where('status', '==', 'active'), limit(50));
        const empSnap = await getDocs(q);
        const dossiers = await Promise.all(empSnap.docs.map(doc => reconstructEmployeeState(db, doc.id, asOfDate)));
        result = {
          type: 'BulkEmployeeDossiers',
          dossiers,
        };
      }
    } else {
      throw new Error(`Report type '${reportType}' is not implemented.`);
    }

    // CRITICAL FIX: Serialize the result to remove any non-serializable Firestore objects
    return JSON.parse(JSON.stringify(result));

  } catch (error) {
    console.error("Error in generateReport:", error);
    // Re-throw a serializable error to the client
    throw new Error(error instanceof Error ? error.message : 'An unknown error occurred on the server.');
  }
}
