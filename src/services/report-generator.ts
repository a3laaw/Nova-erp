
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
import type { Employee, LeaveRequest, AuditLog } from '@/lib/types';
import { intervalToDuration, differenceInYears, parseISO } from 'date-fns';
import { toFirestoreDate } from './date-converter';
import { calculateAnnualLeaveBalance } from './leave-calculator';

// A completely serializable version of the Employee, safe to pass to clients.
// All date-like objects are converted to strings.
type SerializableEmployee = Omit<Employee, 'hireDate' | 'dob' | 'residencyExpiry' | 'contractExpiry' | 'terminationDate' | 'lastVacationAccrualDate' | 'lastLeaveResetDate' | 'createdAt' | 'lastLeave' | 'auditLogs'> & {
  hireDate: string | null;
  dob: string | null;
  residencyExpiry: string | null;
  contractExpiry: string | null;
  terminationDate: string | null;
  lastLeave: (Omit<LeaveRequest, 'startDate' | 'endDate' | 'actualReturnDate'> & { startDate: string, endDate: string, actualReturnDate: string | null }) | null;
  auditLogs: (Omit<AuditLog, 'effectiveDate'> & { effectiveDate: string })[];
  serviceDuration: Duration;
};

// --- Report Data Types ---
export type ReportType = 'EmployeeDossier' | 'EmployeeRoster';

export interface ReportHeader {
  key: string;
  label: string;
  type?: 'date' | 'currency' | 'number' | 'component';
}

export interface StandardReportData {
  type: 'EmployeeRoster';
  title: string;
  subtitle: string;
  headers: ReportHeader[];
  rows: DocumentData[];
}

export interface DossierReportData {
  type: 'EmployeeDossier';
  employee: SerializableEmployee;
}

export interface BulkReportData {
  type: 'BulkEmployeeDossiers';
  dossiers: SerializableEmployee[];
}

export type ReportData = StandardReportData | DossierReportData | BulkReportData;

interface ReportOptions {
  asOfDate: string;
  employeeId?: string;
  statusFilter?: 'active' | 'all';
}

// --- Helper to find historical value ---
function findValueAsOf(logs: AuditLog[], field: keyof Employee, asOfDate: Date, initialValue: any) {
  // .find() is efficient because the query is already ordered by date descending.
  const relevantLog = logs.find(log => {
    const effectiveDate = toFirestoreDate(log.effectiveDate);
    return log.field === field && effectiveDate && effectiveDate <= asOfDate;
  });
  return relevantLog ? relevantLog.newValue : initialValue;
}

// --- Core state reconstruction function ---
async function reconstructEmployeeState(db: Firestore, employeeId: string, asOfDate: Date): Promise<SerializableEmployee> {
  try {
    const [empSnap, auditLogsSnap, leaveRequestsSnap] = await Promise.all([
      getDoc(doc(db, 'employees', employeeId)),
      // Optimized query: order and limit directly in Firestore.
      getDocs(query(collection(db, `employees/${employeeId}/auditLogs`), orderBy('effectiveDate', 'desc'), limit(500))),
      getDocs(query(collection(db, 'leaveRequests'), where('employeeId', '==', employeeId))),
    ]);

    if (!empSnap.exists()) {
      throw new Error(`Employee with ID ${employeeId} not found.`);
    }

    // --- Strict Manual Mapping ---
    // Do NOT use `...empSnap.data()`. Manually map fields to create a plain object.
    const baseData = empSnap.data();
    const hireDate = toFirestoreDate(baseData.hireDate);
    
    // CRITICAL: Validate hireDate before proceeding.
    if (!hireDate) {
      throw new Error(`Invalid or missing hire date for employee ID: ${employeeId}`);
    }

    const auditLogs = auditLogsSnap.docs.map(d => d.data() as AuditLog);
    const allLeaveRequests = leaveRequestsSnap.docs.map(d => ({ id: d.id, ...d.data() } as LeaveRequest));
    
    const reconstructedState: Partial<Employee> = {
      jobTitle: findValueAsOf(auditLogs, 'jobTitle', asOfDate, baseData.jobTitle),
      department: findValueAsOf(auditLogs, 'department', asOfDate, baseData.department),
      basicSalary: findValueAsOf(auditLogs, 'basicSalary', asOfDate, baseData.basicSalary),
      housingAllowance: findValueAsOf(auditLogs, 'housingAllowance', asOfDate, baseData.housingAllowance),
      transportAllowance: findValueAsOf(auditLogs, 'transportAllowance', asOfDate, baseData.transportAllowance),
    };

    // --- Safe Calculations ---
    let leaveBalance = 0;
    try {
        // Pass a reconstructed object to the calculator
        leaveBalance = calculateAnnualLeaveBalance({ ...baseData, ...reconstructedState } as Employee, asOfDate);
    } catch (e) {
        console.error(`Could not calculate leave balance for ${employeeId}:`, e);
    }
    
    const lastReturn = allLeaveRequests
      .filter(lr => {
        const returnDate = toFirestoreDate(lr.actualReturnDate);
        return lr.isBackFromLeave && returnDate && returnDate <= asOfDate;
      })
      .sort((a, b) => (toFirestoreDate(b.actualReturnDate)?.getTime() || 0) - (toFirestoreDate(a.actualReturnDate)?.getTime() || 0))[0] || null;

    const serviceDuration = intervalToDuration({ start: hireDate, end: asOfDate });
    const serviceInYears = (asOfDate.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    let calculatedEosb = 0;
    const currentSalary = Number(reconstructedState.basicSalary) || 0;

    if (serviceInYears > 0 && currentSalary > 0) {
      if (serviceInYears <= 5) {
        calculatedEosb = (15 / 26) * currentSalary * serviceInYears;
      } else {
        const first5YearsGratuity = (15 / 26) * currentSalary * 5;
        const remainingYears = serviceInYears - 5;
        const remainingYearsGratuity = currentSalary * remainingYears;
        calculatedEosb = first5YearsGratuity + remainingYearsGratuity;
      }
    }

    // --- Final Manual Mapping to a Plain, Serializable Object ---
    // This creates a clean object with no Firestore prototypes.
    const finalData = {
        id: empSnap.id,
        employeeNumber: baseData.employeeNumber,
        fullName: baseData.fullName,
        nameEn: baseData.nameEn,
        dob: toFirestoreDate(baseData.dob)?.toISOString() || null,
        gender: baseData.gender,
        civilId: baseData.civilId,
        nationality: baseData.nationality,
        residencyExpiry: toFirestoreDate(reconstructedState.residencyExpiry ?? baseData.residencyExpiry)?.toISOString() || null,
        contractExpiry: toFirestoreDate(reconstructedState.contractExpiry ?? baseData.contractExpiry)?.toISOString() || null,
        mobile: baseData.mobile,
        emergencyContact: baseData.emergencyContact,
        email: baseData.email,
        jobTitle: reconstructedState.jobTitle,
        position: reconstructedState.position,
        department: reconstructedState.department,
        contractType: baseData.contractType,
        hireDate: hireDate.toISOString(), // Immediate serialization
        terminationDate: toFirestoreDate(baseData.terminationDate)?.toISOString() || null,
        terminationReason: baseData.terminationReason,
        status: baseData.status,
        basicSalary: reconstructedState.basicSalary,
        housingAllowance: reconstructedState.housingAllowance,
        transportAllowance: reconstructedState.transportAllowance,
        salaryPaymentType: baseData.salaryPaymentType,
        bankName: baseData.bankName,
        iban: baseData.iban,
        eosb: calculatedEosb,
        leaveBalance,
        serviceDuration,
        auditLogs: auditLogs.map(log => ({
            ...log,
            effectiveDate: toFirestoreDate(log.effectiveDate)?.toISOString() || ''
        })),
        lastLeave: lastReturn ? {
            ...lastReturn,
            startDate: toFirestoreDate(lastReturn.startDate)?.toISOString() || '',
            endDate: toFirestoreDate(lastReturn.endDate)?.toISOString() || '',
            actualReturnDate: toFirestoreDate(lastReturn.actualReturnDate)?.toISOString() || null,
        } : null,
    };
    
    return finalData as SerializableEmployee;

  } catch (error) {
    console.error(`Failed to reconstruct state for employee ${employeeId}:`, error);
    throw new Error(`Could not generate report for employee ${employeeId}. Please check their data. Original error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// --- Main Report Generation Function ---
export async function generateReport(db: Firestore, reportType: ReportType, options: ReportOptions): Promise<ReportData> {
  let result: ReportData;

  try {
    const asOfDate = parseISO(options.asOfDate);

    if (reportType === 'EmployeeRoster') {
      const q = options.statusFilter === 'all'
        ? query(collection(db, 'employees'), limit(100))
        : query(collection(db, 'employees'), where('status', '==', 'active'), limit(100));
        
      const empSnap = await getDocs(q);
      const rows = empSnap.docs
        .map(doc => {
            const data = doc.data() as Employee;
            const hireDate = toFirestoreDate(data.hireDate);
            const serviceYears = hireDate ? differenceInYears(asOfDate, hireDate) : 0;
            // Manual mapping for rows
            return {
                id: doc.id,
                employeeNumber: data.employeeNumber ?? '-',
                fullName: data.fullName ?? 'غير معروف',
                department: data.department ?? '-',
                jobTitle: data.jobTitle ?? '-',
                status: data.status,
                hireDate: hireDate?.toISOString() || null, // Serialize date
                serviceYears,
            };
        })
        .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', 'ar'));

      result = {
        type: 'EmployeeRoster',
        title: 'قائمة الموظفين',
        subtitle: `الحالة كما في تاريخ: ${asOfDate.toLocaleDateString('ar-KW')}`,
        headers: [
          { key: 'employeeNumber', label: 'الرقم الوظيفي' },
          { key: 'fullName', label: 'الاسم الكامل' },
          { key: 'department', label: 'القسم' },
          { key: 'jobTitle', label: 'المسمى الوظيفي' },
          { key: 'status', label: 'الحالة' },
          { key: 'hireDate', label: 'تاريخ التعيين', type: 'date' },
          { key: 'serviceYears', label: 'سنوات الخدمة', type: 'number' },
        ],
        rows,
      };
    } else if (reportType === 'EmployeeDossier') {
      if (!options.employeeId) throw new Error("Employee ID is required for Dossier report.");

      if (options.employeeId === 'all') {
        const q = options.statusFilter === 'all'
          ? query(collection(db, 'employees'), limit(50)) // Limit for bulk operations
          : query(collection(db, 'employees'), where('status', '==', 'active'), limit(50));
        const empSnap = await getDocs(q);
        
        const dossiers: SerializableEmployee[] = [];
        // Using for...of loop to avoid overwhelming the stack with Promise.all on large datasets.
        for (const doc of empSnap.docs) {
          try {
            const dossier = await reconstructEmployeeState(db, doc.id, asOfDate);
            dossiers.push(dossier);
          } catch(e) {
             console.error(`Skipping employee ${doc.id} in bulk report due to error:`, e);
          }
        }
        
        result = {
          type: 'BulkEmployeeDossiers',
          dossiers,
        };
      } else {
        const employeeData = await reconstructEmployeeState(db, options.employeeId, asOfDate);
        result = {
          type: 'EmployeeDossier',
          employee: employeeData,
        };
      }
    } else {
      throw new Error(`Report type '${reportType}' is not implemented.`);
    }

    // CRITICAL: Final sanitization step. This strips any remaining non-serializable prototypes
    // (like from deep inside a nested object) that might have been missed.
    return JSON.parse(JSON.stringify(result));

  } catch (error) {
    console.error("Error in generateReport:", error);
    // Rethrow a serializable error to be caught by the client component.
    throw new Error(error instanceof Error ? error.message : 'An unknown server error occurred during report generation.');
  }
}
