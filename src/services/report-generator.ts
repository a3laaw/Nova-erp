

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

export type ReportType = 'EmployeeDossier' | 'EmployeeRoster' | 'SalaryChange' | 'JobChange' | 'ResidencyRenewal';

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
    type: 'EmployeeRoster' | 'SalaryChange' | 'JobChange' | 'ResidencyRenewal';
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
    dateFrom?: string;
    dateTo?: string;
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

async function reconstructEmployeeState(db: Firestore, employee: Employee, asOfDate: Date): Promise<Employee> {
     if (!employee || !employee.id) {
        throw new Error('Invalid employee data provided for reconstruction.');
    }
    const auditLogsSnapshot = await getDocs(collection(db, `employees/${employee.id}/auditLogs`));
    const auditLogs = auditLogsSnapshot.docs.map(d => d.data() as AuditLog);
    
    if (auditLogs.length === 0) {
        return { ...employee, auditLogs: [] };
    }

    const reconstructed: Partial<Employee> = {};
    const fieldsToReconstruct: (keyof Employee)[] = ['jobTitle', 'department', 'position', 'basicSalary', 'housingAllowance', 'transportAllowance', 'residencyExpiry', 'contractExpiry', 'visaType', 'contractType', 'iban', 'salaryPaymentType', 'bankName'];

    fieldsToReconstruct.forEach(field => {
        (reconstructed as any)[field] = findValueAsOf(auditLogs, field as string, asOfDate, employee[field as keyof Employee]);
    });

    return { ...employee, ...reconstructed, auditLogs };
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
    
    // From Article 70 - payment for unused annual leave. Balance is pre-calculated.
    const validLeaveBalance = Math.max(0, leaveBalance); // Ensure balance is not negative
    const leavePayout = (basicSalary / 26) * validLeaveBalance;
    const totalPayout = gratuity + leavePayout;

    // From Article 52 - rules for resignation
    if (employee.terminationReason === 'resignation' && toDate(employee.terminationDate) && toDate(employee.terminationDate)! <= asOfDate) {
         if (yearsOfService < 3) return 0; // No gratuity, only leave payout
         if (yearsOfService < 5) return (gratuity * 0.5) + leavePayout;
         if (yearsOfService < 10) return (gratuity * (2/3)) + leavePayout;
    }
    
    return Math.max(0, totalPayout);
}

function calculateLeaveBalance(employee: Employee, asOfDate: Date, allLeaveRequests: LeaveRequest[], holidays: Set<string>): number {
    const hireDate = toDate(employee.hireDate);
    if (!hireDate || hireDate > asOfDate) return 0;
    
    const yearsOfService = (asOfDate.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (yearsOfService < 1) {
        return 0; // No leave entitlement in the first year
    }
    
    // Pro-rata accrual based on exact years of service.
    const accruedDays = yearsOfService * 30 + (employee.carriedLeaveDays || 0);

    const leavesTaken = allLeaveRequests.filter(lr => 
        lr.employeeId === employee.id && 
        lr.status === 'approved' && 
        lr.leaveType === 'Annual' && // IMPORTANT: Only count Annual leave against the annual balance
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
    
    const allEmployees = await fetchCollection<Employee>(db, 'employees');
    const allLeaveRequests = await fetchCollection<LeaveRequest>(db, 'leaveRequests');
    const allHolidays = await fetchCollection<Holiday>(db, 'holidays');
    const holidaysSet = new Set(allHolidays.map(h => format(toDate(h.date)!, 'yyyy-MM-dd')));

    const processEmployee = async (emp: Employee) => {
        const reconstructed = await reconstructEmployeeState(db, emp, asOfDate);
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

async function generateAuditLogReport(db: Firestore, options: ReportOptions, changeType: 'SalaryChange' | 'JobChange' | 'ResidencyRenewal'): Promise<StandardReportData> {
    const { dateFrom, dateTo } = options;
    if (!dateFrom || !dateTo) {
        throw new Error("Date range is required for audit log reports.");
    }
    
    const startDate = parseISO(dateFrom);
    startDate.setHours(0,0,0,0);
    const endDate = parseISO(dateTo);
    endDate.setHours(23,59,59,999);

    const headersMap: Record<string, ReportHeader[]> = {
        'SalaryChange': [
            { key: 'employeeName', label: 'الموظف' },
            { key: 'effectiveDate', label: 'تاريخ السريان', type: 'date' },
            { key: 'oldBasicSalary', label: 'الراتب الأساسي القديم', type: 'currency' },
            { key: 'newBasicSalary', label: 'الراتب الأساسي الجديد', type: 'currency' },
            { key: 'changedBy', label: 'تم التغيير بواسطة' },
        ],
        'JobChange': [
            { key: 'employeeName', label: 'الموظف' },
            { key: 'effectiveDate', label: 'تاريخ السريان', type: 'date' },
            { key: 'oldJobTitle', label: 'المسمى الوظيفي القديم' },
            { key: 'newJobTitle', label: 'المسمى الوظيفي الجديد' },
            { key: 'oldDepartment', label: 'القسم القديم' },
            { key: 'newDepartment', label: 'القسم الجديد' },
        ],
        'ResidencyRenewal': [
            { key: 'employeeName', label: 'الموظف' },
            { key: 'effectiveDate', label: 'تاريخ التجديد', type: 'date' },
            { key: 'oldValue', label: 'تاريخ الانتهاء القديم', type: 'date' },
            { key: 'newValue', label: 'تاريخ الانتهاء الجديد', type: 'date' },
        ],
    };
    
    const finalHeaders = headersMap[changeType];
    const fieldToFilter = changeType === 'ResidencyRenewal' ? 'residencyExpiry' : undefined;
    const typeToFilter = changeType === 'ResidencyRenewal' ? 'DataUpdate' : changeType;


    let auditLogsQuery = query(
        collectionGroup(db, 'auditLogs'),
        where('effectiveDate', '>=', startDate),
        where('effectiveDate', '<=', endDate),
        orderBy('effectiveDate', 'desc')
    );

    if (typeToFilter) {
         auditLogsQuery = query(auditLogsQuery, where('changeType', '==', typeToFilter));
    }
    if(fieldToFilter){
        auditLogsQuery = query(auditLogsQuery, where('field', '==', fieldToFilter));
    }

    const auditLogsSnapshot = await getDocs(auditLogsQuery);
    if (auditLogsSnapshot.empty) {
        return {
            type: changeType,
            title: `تقرير ${changeType === 'SalaryChange' ? 'تغيرات الرواتب' : changeType === 'JobChange' ? 'التغييرات الوظيفية' : 'تجديد الإقامات'}`,
            subtitle: `للفترة من ${format(startDate, 'dd/MM/yyyy')} إلى ${format(endDate, 'dd/MM/yyyy')}`,
            headers: finalHeaders,
            rows: []
        };
    }
    
    const employeeIds = [...new Set(auditLogsSnapshot.docs.map(log => log.ref.parent.parent!.id))];
    const employeesSnapshot = await getDocs(query(collection(db, 'employees'), where('__name__', 'in', employeeIds)));
    const employeesMap = new Map(employeesSnapshot.docs.map(doc => [doc.id, doc.data() as Employee]));

    const rows = auditLogsSnapshot.docs.map(logDoc => {
        const log = logDoc.data() as AuditLog;
        const employeeId = logDoc.ref.parent.parent!.id;
        const employee = employeesMap.get(employeeId);
        
        const baseRow = {
            id: logDoc.id,
            employeeName: employee?.fullName || `موظف (ID: ${employeeId})`,
            effectiveDate: toDate(log.effectiveDate),
            changedBy: log.changedBy || 'نظام',
        };

        if (changeType === 'SalaryChange') {
            return {
                ...baseRow,
                oldBasicSalary: log.oldValue,
                newBasicSalary: log.newValue,
            };
        }
        
        if (changeType === 'JobChange') {
            return {
                ...baseRow,
                oldJobTitle: log.oldValue?.jobTitle ?? '-',
                newJobTitle: log.newValue?.jobTitle ?? '-',
                oldDepartment: log.oldValue?.department ?? '-',
                newDepartment: log.newValue?.department ?? '-',
            };
        }

        if (changeType === 'ResidencyRenewal') {
             return {
                ...baseRow,
                oldValue: log.oldValue,
                newValue: log.newValue,
            };
        }
        
        return baseRow;
    });

    return {
        type: changeType,
        title: `تقرير ${changeType === 'SalaryChange' ? 'تغيرات الرواتب' : changeType === 'JobChange' ? 'التغييرات الوظيفية' : 'تجديد الإقامات'}`,
        subtitle: `للفترة من ${format(startDate, 'dd/MM/yyyy')} إلى ${format(endDate, 'dd/MM/yyyy')}`,
        headers: finalHeaders,
        rows: rows
    };
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
        case 'SalaryChange':
        case 'JobChange':
        case 'ResidencyRenewal':
            return generateAuditLogReport(db, options, reportType);
        default:
            // This is a type guard, should not be reached if all cases are handled
            const exhaustiveCheck: never = reportType;
            throw new Error(`نوع التقرير غير معروف: ${exhaustiveCheck}`);
    }
}
