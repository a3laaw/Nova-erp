
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

// Define a serializable Employee type for reports
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

// --- Helper Functions ---

function findValueAsOf(logs: AuditLog[], field: keyof Employee, asOfDate: Date, initialValue: any) {
  const relevantLog = logs.find(log => {
    const effectiveDate = toFirestoreDate(log.effectiveDate);
    return log.field === field && effectiveDate && effectiveDate <= asOfDate;
  });
  return relevantLog ? relevantLog.newValue : initialValue;
}

async function reconstructEmployeeState(db: Firestore, employeeId: string, asOfDate: Date): Promise<SerializableEmployee> {
  try {
    const [empSnap, auditLogsSnap, leaveRequestsSnap] = await Promise.all([
      getDoc(doc(db, 'employees', employeeId)),
      getDocs(query(collection(db, `employees/${employeeId}/auditLogs`), orderBy('effectiveDate', 'desc'), limit(500))),
      getDocs(query(collection(db, 'leaveRequests'), where('employeeId', '==', employeeId))),
    ]);

    if (!empSnap.exists()) {
      throw new Error(`Employee with ID ${employeeId} not found.`);
    }

    const baseData = empSnap.data();
    const hireDate = toFirestoreDate(baseData.hireDate);
    if (!hireDate) {
      throw new Error(`Invalid or missing hire date for employee ID: ${employeeId}`);
    }

    const auditLogs = auditLogsSnap.docs.map(d => d.data() as AuditLog);
    const allLeaveRequests = leaveRequestsSnap.docs.map(d => ({ id: d.id, ...d.data() } as LeaveRequest));
    
    // --- Manual Mapping & Reconstruction ---
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

    // --- Final Manual Mapping to Plain Serializable Object ---
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
        hireDate: hireDate.toISOString(),
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
    
    // Explicitly remove fields that might not be serializable
    delete (finalData as any).lastVacationAccrualDate;
    delete (finalData as any).lastLeaveResetDate;
    delete (finalData as any).createdAt;

    return finalData as SerializableEmployee;

  } catch (error) {
    console.error(`Failed to reconstruct state for employee ${employeeId}:`, error);
    throw new Error(`Could not generate report for employee ${employeeId}. Please check their data. Original error: ${error instanceof Error ? error.message : String(error)}`);
  }
}


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
                employeeNumber: emp.employeeNumber,
                fullName: emp.fullName,
                department: emp.department,
                jobTitle: emp.jobTitle,
                status: emp.status,
                hireDate: hireDate?.toISOString() || null,
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

    // CRITICAL: Final sanitization step to strip any remaining non-serializable prototypes.
    return JSON.parse(JSON.stringify(result));

  } catch (error) {
    console.error("Error in generateReport:", error);
    throw new Error(error instanceof Error ? error.message : 'An unknown error occurred on the server.');
  }
}
