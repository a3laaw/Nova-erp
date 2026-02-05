
'use server';

import { 
    collection, getDocs, getDoc, doc, query, where, orderBy, limit, type Firestore 
} from 'firebase/firestore';
import { parseISO, isValid, intervalToDuration, differenceInYears } from 'date-fns';
import { toFirestoreDate } from './date-converter';
import { calculateAnnualLeaveBalance } from './leave-calculator';
import type { Employee, LeaveRequest, AuditLog } from '@/lib/types';


// Define a serializable Employee type for reports
// This ensures no complex objects (like Firestore Timestamps) are passed to the client.
type SerializableEmployee = Omit<Employee, 'hireDate' | 'dob' | 'residencyExpiry' | 'contractExpiry' | 'terminationDate' | 'lastVacationAccrualDate' | 'lastLeaveResetDate' | 'createdAt' | 'lastLeave' | 'auditLogs' | 'serviceDuration'> & {
  hireDate: string | null;
  dob: string | null;
  residencyExpiry: string | null;
  contractExpiry: string | null;
  terminationDate: string | null;
  lastLeave: {
    leaveType: LeaveRequest['leaveType'];
    startDate: string;
    endDate: string;
    actualReturnDate: string | null;
    days: number;
    workingDays: number | undefined;
  } | null;
  auditLogs: { field: string; oldValue: any; newValue: any; effectiveDate: string }[];
  serviceDuration: { years: number, months: number, days: number };
};

// Report Data Types
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
  rows: any[];
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


// A helper to convert any value to a safe, serializable format.
// Complex objects are stringified to prevent circular references.
function safeValue(val: any): any {
    if (val === null || val === undefined) return null;

    const date = toFirestoreDate(val);
    if (date) return date.toISOString();

    if (typeof val === 'object') {
        try {
            // Attempt to stringify, but catch potential circular reference errors
            // This is a fallback; primary sanitization should be manual mapping.
            return JSON.stringify(val);
        } catch {
            return '[Complex Object]';
        }
    }
    return val;
}

// Builds a clean, plain JavaScript object from Firestore data, field by field.
// NO SPREAD OPERATOR (...) on the root `data` object.
function mapSafeEmployee(id: string, data: any): Omit<SerializableEmployee, 'lastLeave' | 'auditLogs' | 'serviceDuration' | 'eosb' | 'leaveBalance'> {
    return {
        id: id,
        employeeNumber: data.employeeNumber ?? '',
        fullName: data.fullName ?? '',
        nameEn: data.nameEn ?? '',
        dob: toFirestoreDate(data.dob)?.toISOString() || null,
        gender: data.gender,
        civilId: data.civilId ?? '',
        nationality: data.nationality ?? '',
        residencyExpiry: toFirestoreDate(data.residencyExpiry)?.toISOString() || null,
        contractExpiry: toFirestoreDate(data.contractExpiry)?.toISOString() || null,
        mobile: data.mobile ?? '',
        emergencyContact: data.emergencyContact ?? '',
        email: data.email ?? '',
        jobTitle: data.jobTitle ?? '',
        position: data.position,
        workStartTime: data.workStartTime,
        workEndTime: data.workEndTime,
        salaryPaymentType: data.salaryPaymentType,
        bankName: data.bankName,
        accountNumber: data.accountNumber,
        iban: data.iban,
        profilePicture: data.profilePicture,
        hireDate: toFirestoreDate(data.hireDate)?.toISOString() || null,
        noticeStartDate: toFirestoreDate(data.noticeStartDate)?.toISOString() || null,
        terminationDate: toFirestoreDate(data.terminationDate)?.toISOString() || null,
        terminationReason: data.terminationReason,
        contractType: data.contractType,
        department: data.department ?? '',
        basicSalary: Number(data.basicSalary) || 0,
        housingAllowance: Number(data.housingAllowance) || 0,
        transportAllowance: Number(data.transportAllowance) || 0,
        status: data.status || 'active',
        annualLeaveAccrued: Number(data.annualLeaveAccrued) || 0,
        annualLeaveUsed: Number(data.annualLeaveUsed) || 0,
        carriedLeaveDays: Number(data.carriedLeaveDays) || 0,
        sickLeaveUsed: Number(data.sickLeaveUsed) || 0,
        emergencyLeaveUsed: Number(data.emergencyLeaveUsed) || 0,
        maxEmergencyLeave: Number(data.maxEmergencyLeave) || 0,
    };
}


async function reconstructEmployeeState(db: Firestore, employeeId: string, asOfDate: Date) {
    // 1. Fetch all necessary data concurrently.
    const [empSnap, auditLogsSnap, leaveRequestsSnap] = await Promise.all([
        getDoc(doc(db, 'employees', employeeId)),
        getDocs(query(collection(db, `employees/${employeeId}/auditLogs`), orderBy('effectiveDate', 'desc'))),
        getDocs(query(collection(db, 'leaveRequests'), where('employeeId', '==', employeeId))),
    ]);

    if (!empSnap.exists()) {
        throw new Error(`Employee with ID ${employeeId} not found.`);
    }

    const currentData = empSnap.data();
    const hireDate = toFirestoreDate(currentData.hireDate);
    if (!hireDate) {
        throw new Error(`Invalid or missing hire date for employee ID: ${employeeId}`);
    }

    // 2. Create a clean, plain base object using manual mapping.
    let historicalState = mapSafeEmployee(empSnap.id, currentData);
    
    // 3. Sanitize audit logs immediately after fetching.
    const sanitizedAuditLogs = auditLogsSnap.docs.map(logDoc => {
        const logData = logDoc.data();
        return {
            id: logDoc.id,
            field: String(logData.field || ''),
            oldValue: safeValue(logData.oldValue),
            newValue: safeValue(logData.newValue),
            effectiveDate: toFirestoreDate(logData.effectiveDate)?.toISOString() || null,
        };
    });

    // 4. "Travel back in time" by applying the audit log changes.
    for (const log of sanitizedAuditLogs) {
        const logDate = log.effectiveDate ? new Date(log.effectiveDate) : null;
        if (logDate && logDate > asOfDate) {
            const fieldName = log.field as keyof typeof historicalState;
            if (Object.prototype.hasOwnProperty.call(historicalState, fieldName)) {
                // Since log.oldValue is already sanitized, this is safe.
                (historicalState as any)[fieldName] = log.oldValue;
            }
        }
    }
    
    // 5. Calculate derived data based on the reconstructed historical state.
    const serviceInYears = differenceInYears(asOfDate, hireDate);
    let calculatedEosb = 0;
    const basicSalaryForCalc = Number(historicalState.basicSalary) || 0;
    
    if (serviceInYears > 0 && basicSalaryForCalc > 0) {
      if (serviceInYears <= 5) {
        calculatedEosb = (15 / 26) * basicSalaryForCalc * serviceInYears;
      } else {
        calculatedEosb = ((15 / 26) * basicSalaryForCalc * 5) + (basicSalaryForCalc * (serviceInYears - 5));
      }
    }
    
    const leaveBalance = calculateAnnualLeaveBalance({ ...historicalState, hireDate } as Employee, asOfDate);
    
    const lastReturn = leaveRequestsSnap.docs
      .map(d => d.data() as LeaveRequest)
      .filter(lr => lr.isBackFromLeave && toFirestoreDate(lr.actualReturnDate) && toFirestoreDate(lr.actualReturnDate)! <= asOfDate)
      .sort((a, b) => toFirestoreDate(b.actualReturnDate)!.getTime() - toFirestoreDate(a.actualReturnDate)!.getTime())[0] || null;

    const duration = intervalToDuration({ start: hireDate, end: asOfDate });

    // 6. Assemble the final, completely sanitized object.
    const finalSerializableData: SerializableEmployee = {
        ...historicalState,
        auditLogs: sanitizedAuditLogs,
        eosb: calculatedEosb,
        leaveBalance,
        serviceDuration: {
            years: duration.years || 0,
            months: duration.months || 0,
            days: duration.days || 0,
        },
        lastLeave: lastReturn ? {
            leaveType: lastReturn.leaveType,
            startDate: toFirestoreDate(lastReturn.startDate)?.toISOString() || '',
            endDate: toFirestoreDate(lastReturn.endDate)?.toISOString() || '',
            actualReturnDate: toFirestoreDate(lastReturn.actualReturnDate)?.toISOString() || null,
            days: lastReturn.days || 0,
            workingDays: lastReturn.workingDays,
        } : null,
    };
    
    return finalSerializableData;
}


export async function generateReport(db: Firestore, reportType: ReportType, options: ReportOptions): Promise<ReportData> {
  try {
    const asOfDate = parseISO(options.asOfDate);
    if (!isValid(asOfDate)) throw new Error("التاريخ المحدد غير صالح.");

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

      return {
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
      if (!options.employeeId) throw new Error("مطلوب تحديد الموظف لتقرير الملف الشامل.");

      if (options.employeeId === 'all') { // Bulk Dossier Report
        const q = options.statusFilter === 'all'
          ? query(collection(db, 'employees'), limit(50))
          : query(collection(db, 'employees'), where('status', '==', 'active'), limit(50));
        const empSnap = await getDocs(q);
        
        const dossiers: SerializableEmployee[] = [];
        for (const doc of empSnap.docs) {
          try {
            const dossier = await reconstructEmployeeState(db, doc.id, asOfDate);
            if(dossier) dossiers.push(dossier);
          } catch(e) {
             console.warn(`Skipping employee ${doc.id} in bulk report due to error:`, e instanceof Error ? e.message : String(e));
          }
        }
        
        return { type: 'BulkEmployeeDossiers', dossiers };
      } else { // Single Dossier Report
        const employeeData = await reconstructEmployeeState(db, options.employeeId, asOfDate);
        if(!employeeData) throw new Error("لم يتم العثور على بيانات الموظف.");
        return { type: 'EmployeeDossier', employee: employeeData };
      }
    } else {
        throw new Error(`نوع التقرير '${reportType}' غير مدعوم.`);
    }
  } catch (error: any) {
    // 🔥 SAFE ERROR HANDLING: Only throw the error message, not the full object.
    console.error("REPORT GENERATION FAILED:", error);
    throw new Error(error.message || 'حدث خطأ غير متوقع في الخادم أثناء إنشاء التقرير.');
  }
}
