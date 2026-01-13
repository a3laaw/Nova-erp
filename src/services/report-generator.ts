
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

export type ReportType = 'EmployeeDossier' | 'LeaveActivity' | 'EmployeeRoster';

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
    type: 'LeaveActivity' | 'EmployeeRoster';
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
  if (timestampOrString === null || timestampOrString === undefined) return null;
  const date = timestampOrString?.toDate ? timestampOrString.toDate() : new Date(timestampOrString);
  return isNaN(date.getTime()) ? null : date;
};

async function fetchCollection<T>(db: Firestore, collectionName: string): Promise<T[]> {
    const snapshot = await getDocs(collection(db, collectionName));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
}

// --- HISTORICAL DATA RECONSTRUCTION ---

function findValueAsOf(logs: AuditLog[], field: string, asOfDate: Date, initialValue: any) {
    const relevantLog = logs
        .filter(log => (log.field === field || (Array.isArray(log.field) && log.field.includes(field))) && toDate(log.effectiveDate)! <= asOfDate)
        .sort((a, b) => toDate(b.effectiveDate)!.getTime() - toDate(a.effectiveDate)!.getTime())[0];
    
    if (relevantLog) {
         if (typeof initialValue === 'object' && initialValue !== null && !Array.isArray(initialValue) && relevantLog.newValue.hasOwnProperty(field)) {
            return relevantLog.newValue[field] ?? initialValue;
        }
        return relevantLog.newValue;
    }
    return initialValue;
}

async function reconstructEmployeeState(db: Firestore, employee: Employee, asOfDate: Date): Promise<Employee> {
    const auditLogs = await fetchCollection<AuditLog>(db, `employees/${employee.id}/auditLogs`);

    const reconstructed: Partial<Employee> = {};
    const fieldsToReconstruct: (keyof Employee)[] = ['jobTitle', 'department', 'position', 'basicSalary', 'housingAllowance', 'transportAllowance', 'residencyExpiry', 'contractExpiry', 'visaType', 'contractType', 'iban', 'salaryPaymentType', 'bankName'];

    fieldsToReconstruct.forEach(field => {
        (reconstructed as any)[field] = findValueAsOf(auditLogs, field as string, asOfDate, employee[field as keyof Employee]);
    });

    return { ...employee, ...reconstructed, auditLogs };
}

// --- CALCULATION FUNCTIONS ---

function calculateEosb(employee: Employee, asOfDate: Date): number {
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
    
    // In case of resignation
    if (employee.terminationReason === 'resignation' && toDate(employee.terminationDate) === toDate(asOfDate)) {
         if (yearsOfService < 3) return 0;
         if (yearsOfService < 5) return gratuity * 0.5;
         if (yearsOfService < 10) return gratuity * (2/3);
    }
    
    return Math.max(0, gratuity);
}

function calculateLeaveBalance(employee: Employee, asOfDate: Date, allLeaveRequests: LeaveRequest[], holidays: Set<string>): number {
    const hireDate = toDate(employee.hireDate);
    if (!hireDate || hireDate > asOfDate) return 0;
    
    const yearsOfService = differenceInYears(asOfDate, hireDate);
    if (yearsOfService < 1) return 0;
    
    // Simplified accrual: 30 days per year of service after the first year.
    const accruedDays = (yearsOfService -1) * 30 + (employee.carriedLeaveDays || 0);

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
    
    const allEmployees = await fetchCollection<Employee>(db, 'employees');
    const allLeaveRequests = await fetchCollection<LeaveRequest>(db, 'leaveRequests');
    const allHolidays = await fetchCollection<Holiday>(db, 'holidays');
    const holidaysSet = new Set(allHolidays.map(h => format(toDate(h.date)!, 'yyyy-MM-dd')));

    const processEmployee = async (emp: Employee) => {
        const reconstructed = await reconstructEmployeeState(db, emp, asOfDate);
        reconstructed.eosb = calculateEosb(reconstructed, asOfDate);
        reconstructed.leaveBalance = calculateLeaveBalance(reconstructed, asOfDate, allLeaveRequests, holidaysSet);
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

async function generateLeaveActivityReport(db: Firestore, options: ReportOptions): Promise<StandardReportData> {
     const asOfDate = parseISO(options.asOfDate);
    const startDate = new Date(asOfDate.getFullYear(), 0, 1); // Start of the report year

    let q = query(
        collection(db, 'leaveRequests'),
        where('startDate', '>=', startDate),
        where('startDate', '<=', asOfDate)
    );

    if (options.employeeId && options.employeeId !== 'all') {
        q = query(q, where('employeeId', '==', options.employeeId));
    }
    
    const snapshot = await getDocs(q);
    const rows = snapshot.docs.map(doc => doc.data() as LeaveRequest);
    
    const approvedLeaves = rows.filter(r => r.status === 'approved');
    const totalDays = approvedLeaves.reduce((sum, r) => sum + (r.workingDays || r.days), 0);
    const affectedEmployees = new Set(approvedLeaves.map(r => r.employeeId)).size;

    return {
        type: 'LeaveActivity',
        title: 'تقرير حركة الإجازات',
        subtitle: `للفترة من ${format(startDate, 'dd/MM/yyyy')} إلى ${format(asOfDate, 'dd/MM/yyyy')}`,
        headers: [
            { key: 'employeeName', label: 'اسم الموظف' },
            { key: 'leaveType', label: 'نوع الإجازة' },
            { key: 'startDate', label: 'تاريخ البدء', type: 'date' },
            { key: 'endDate', label: 'تاريخ الانتهاء', type: 'date' },
            { key: 'workingDays', label: 'أيام العمل', type: 'number' },
            { key: 'status', label: 'الحالة' },
        ],
        rows,
        footer: {
            colSpan: 5,
            label: `الإجمالي: ${totalDays} يوم عمل لـ ${affectedEmployees} موظفين`,
            value: ''
        }
    };
}

async function generateEmployeeRoster(db: Firestore, options: ReportOptions): Promise<StandardReportData> {
    const asOfDate = parseISO(options.asOfDate);
    const employees = await fetchCollection<Employee>(db, 'employees');

    const rows = employees.map(emp => {
        const residencyExpiry = toDate(emp.residencyExpiry);
        const contractExpiry = toDate(emp.contractExpiry);
        let alerts = [];
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
        case 'LeaveActivity':
            return generateLeaveActivityReport(db, options);
        case 'EmployeeRoster':
            return generateEmployeeRoster(db, options);
        default:
            throw new Error('نوع التقرير غير معروف.');
    }
}
