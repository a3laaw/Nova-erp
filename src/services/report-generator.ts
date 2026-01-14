
'use server';

import { 
    collection, 
    getDocs, 
    query, 
    where, 
    orderBy,
    Timestamp, 
    type Firestore,
    type DocumentData,
    collectionGroup
} from 'firebase/firestore';
import type { Employee, LeaveRequest, AuditLog, Holiday } from '@/lib/types';
import { format, differenceInYears, eachDayOfInterval, isFriday, intervalToDuration, parseISO, differenceInDays } from 'date-fns';

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

// --- UTILITY FUNCTIONS ---

const toDate = (timestampOrString: any): Date | null => {
  if (timestampOrString === null || timestampOrString === undefined || timestampOrString === '') return null;
  const date = timestampOrString?.toDate ? timestampOrString.toDate() : new Date(timestampOrString);
  return isNaN(date.getTime()) ? null : date;
};


async function fetchCollection<T>(db: Firestore, collectionName: string): Promise<T[]> {
    const snapshot = await getDocs(collection(db, collectionName));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
}

// --- HISTORICAL DATA RECONSTRUCTION ---

function findValueAsOf(logs: AuditLog[], field: string, asOfDate: Date, initialValue: any) {
    if (!logs || logs.length === 0) {
        return initialValue;
    }
    const relevantLog = logs
        .filter(log => {
            const logDate = toDate(log.effectiveDate);
            if (!logDate) return false;
            const logField = log.field;
            const fieldMatch = Array.isArray(logField) ? logField.includes(field) : logField === field;
            return fieldMatch && logDate <= asOfDate;
        })
        .sort((a, b) => toDate(b.effectiveDate)!.getTime() - toDate(a.effectiveDate)!.getTime())[0];
    
    if (relevantLog) {
         if (typeof relevantLog.newValue === 'object' && relevantLog.newValue !== null && !Array.isArray(relevantLog.newValue) && relevantLog.newValue.hasOwnProperty(field)) {
            return relevantLog.newValue[field];
        }
        return relevantLog.newValue;
    }
    return initialValue;
}

async function reconstructEmployeeState(employee: Employee, asOfDate: Date, allAuditLogs: Map<string, AuditLog[]>): Promise<Employee> {
     if (!employee || !employee.id) {
        throw new Error('Invalid employee data provided for reconstruction.');
    }
    const employeeLogs = allAuditLogs.get(employee.id) || [];
    
    // Sort logs by date to ensure correct historical reconstruction
    employeeLogs.sort((a, b) => toDate(a.effectiveDate)!.getTime() - toDate(b.effectiveDate)!.getTime());

    const reconstructed: Partial<Employee> = {};
    const fieldsToReconstruct: (keyof Employee)[] = ['jobTitle', 'department', 'position', 'basicSalary', 'housingAllowance', 'transportAllowance', 'residencyExpiry', 'contractExpiry', 'visaType', 'contractType', 'iban', 'salaryPaymentType', 'bankName'];

    fieldsToReconstruct.forEach(field => {
        (reconstructed as any)[field] = findValueAsOf(employeeLogs, field as string, asOfDate, employee[field as keyof Employee]);
    });

    return { ...employee, ...reconstructed, auditLogs: employeeLogs };
}

// --- CALCULATION FUNCTIONS ---

function calculateEosb(employee: Employee, asOfDate: Date, leaveBalance: number): number {
    const hireDate = toDate(employee.hireDate);
    const basicSalary = employee.basicSalary || 0;
    if (!hireDate || basicSalary === 0 || hireDate > asOfDate) return 0;
    
    const serviceDays = (asOfDate.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24);
    const yearsOfService = serviceDays / 365.25;

    let gratuity = 0;
    if (yearsOfService <= 5) {
        gratuity = (15 / 26) * basicSalary * yearsOfService;
    } else {
        gratuity += (15 / 26) * basicSalary * 5; // First 5 years
        gratuity += basicSalary * (yearsOfService - 5); // After 5 years
    }
    
    const validLeaveBalance = Math.max(0, leaveBalance); 
    const leavePayout = (basicSalary / 26) * validLeaveBalance;
    
    // Article 52 - rules for resignation
    if (employee.terminationReason === 'resignation' && toDate(employee.terminationDate) && toDate(employee.terminationDate)! <= asOfDate) {
         if (yearsOfService < 3) return leavePayout; // No gratuity, only leave payout
         if (yearsOfService < 5) return (gratuity * 0.5) + leavePayout;
         if (yearsOfService < 10) return (gratuity * (2/3)) + leavePayout;
    }
    
    const totalPayout = gratuity + leavePayout;
    return Math.max(0, totalPayout);
}

function calculateLeaveBalance(employee: Employee, asOfDate: Date, allLeaveRequests: LeaveRequest[], holidays: Set<string>): number {
    const hireDate = toDate(employee.hireDate);
    if (!hireDate || hireDate > asOfDate) return 0;
    
    const yearsOfService = (asOfDate.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (yearsOfService < 1) {
        return 0; // No leave entitlement in the first year
    }
    
    const accruedDays = yearsOfService * 30 + (employee.carriedLeaveDays || 0);

    const leavesTaken = allLeaveRequests.filter(lr => 
        lr.employeeId === employee.id && 
        lr.status === 'approved' && 
        lr.leaveType === 'Annual' &&
        toDate(lr.startDate)! <= asOfDate
    );
    
    let usedDays = 0;
    leavesTaken.forEach(leave => {
        const leaveStart = toDate(leave.startDate)!;
        const leaveEnd = toDate(leave.endDate)! > asOfDate ? asOfDate : toDate(leave.endDate)!;
        if(leaveStart > leaveEnd) return;
        eachDayOfInterval({ start: leaveStart, end: leaveEnd }).forEach(day => {
            if (!isFriday(day) && !holidays.has(format(day, 'yyyy-MM-dd'))) {
                usedDays++;
            }
        });
    });

    return accruedDays - usedDays;
}

// --- REPORT GENERATORS ---

async function generateEmployeeDossier(db: Firestore, options: ReportOptions): Promise<ReportData> {
    const asOfDate = parseISO(options.asOfDate);
    asOfDate.setHours(23, 59, 59, 999);
    
    // Fetch all collections in parallel for efficiency
    const [allEmployees, allLeaveRequests, allHolidays, auditLogsSnapshot] = await Promise.all([
        fetchCollection<Employee>(db, 'employees'),
        fetchCollection<LeaveRequest>(db, 'leaveRequests'),
        fetchCollection<Holiday>(db, 'holidays'),
        getDocs(collectionGroup(db, 'auditLogs'))
    ]);
    
    const holidaysSet = new Set(allHolidays.map(h => format(toDate(h.date)!, 'yyyy-MM-dd')));

    // Organize all audit logs by employee ID for quick lookup
    const allAuditLogs = new Map<string, AuditLog[]>();
    auditLogsSnapshot.forEach(doc => {
        const logData = doc.data() as AuditLog & { employeeId: string };
        const { employeeId } = logData;
        if (!employeeId) return;

        if (!allAuditLogs.has(employeeId)) {
            allAuditLogs.set(employeeId, []);
        }
        allAuditLogs.get(employeeId)!.push(logData);
    });

    const processEmployee = async (emp: Employee) => {
        const reconstructed = await reconstructEmployeeState(emp, asOfDate, allAuditLogs);
        const leaveBalance = calculateLeaveBalance(reconstructed, asOfDate, allLeaveRequests, holidaysSet);
        reconstructed.leaveBalance = leaveBalance;
        reconstructed.eosb = calculateEosb(reconstructed, asOfDate, leaveBalance);
        reconstructed.lastLeave = allLeaveRequests.filter(lr => lr.employeeId === emp.id && lr.isBackFromLeave && toDate(lr.actualReturnDate)! <= asOfDate)
                                   .sort((a,b) => toDate(b.actualReturnDate)!.getTime() - toDate(a.actualReturnDate)!.getTime())[0] || null;
        reconstructed.serviceDuration = intervalToDuration({ start: toDate(emp.hireDate)!, end: asOfDate });
        return reconstructed;
    };

    if (options.employeeId && options.employeeId !== 'all') {
        const employee = allEmployees.find(e => e.id === options.employeeId);
        if (!employee) throw new Error('لم يتم العثور على الموظف.');
        const dossier = await processEmployee(employee);
        return { type: 'EmployeeDossier', employee: dossier };
    } else {
        let filteredEmployees = allEmployees;
        if (options.statusFilter === 'active') {
            filteredEmployees = allEmployees.filter(e => e.status === 'active');
        }
        
        const dossiers = await Promise.all(filteredEmployees.map(emp => processEmployee(emp)));
        return { type: 'BulkEmployeeDossiers', dossiers };
    }
}


async function generateEmployeeRoster(db: Firestore, options: ReportOptions): Promise<StandardReportData> {
    const asOfDate = parseISO(options.asOfDate);
    const employees = await fetchCollection<Employee>(db, 'employees');

    const rows = employees.map(emp => {
        const residencyExpiry = toDate(emp.residencyExpiry);
        const contractExpiry = toDate(emp.contractExpiry);
        let alerts: string[] = [];
        if (residencyExpiry && differenceInDays(residencyExpiry, asOfDate) <= 30 && differenceInDays(residencyExpiry, asOfDate) > 0) {
            alerts.push(`⚠️ الإقامة تنتهي خلال ${differenceInDays(residencyExpiry, asOfDate)} يوم`);
        }
        if (contractExpiry && differenceInDays(contractExpiry, asOfDate) <= 30 && differenceInDays(contractExpiry, asOfDate) > 0) {
            alerts.push(`⚠️ العقد ينتهي خلال ${differenceInDays(contractExpiry, asOfDate)} يوم`);
        }
        
        return {
            ...emp,
            alerts: alerts.join(', ')
        }
    });

     return {
        type: 'EmployeeRoster',
        title: 'ملخص جميع الموظفين',
        subtitle: `الحالة كما في تاريخ: ${format(asOfDate, 'dd/MM/yyyy')}`,
        headers: [
            { key: 'fullName', label: 'الاسم' },
            { key: 'civilId', label: 'الرقم المدني' },
            { key: 'department', label: 'القسم' },
            { key: 'jobTitle', label: 'المسمى الوظيفي' },
            { key: 'status', label: 'الحالة' },
            { key: 'alerts', label: 'تنبيهات حرجة' },
        ],
        rows,
    };
}


// --- MAIN EXPORT ---

export async function generateReport(db: Firestore, reportType: ReportType, options: ReportOptions): Promise<ReportData> {
    switch (reportType) {
        case 'EmployeeDossier':
            return generateEmployeeDossier(db, options);
        case 'EmployeeRoster':
            return generateEmployeeRoster(db, options);
        default:
            // This is a type guard, should not be reached if all cases are handled
            const exhaustiveCheck: never = reportType;
            throw new Error(`نوع التقرير غير معروف: ${exhaustiveCheck}`);
    }
}

    