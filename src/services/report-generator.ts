

import { 
    collection, 
    getDocs, 
    query, 
    where, 
    orderBy,
    Timestamp, 
    type Firestore,
    type DocumentData 
} from 'firebase/firestore';
import type { Employee, LeaveRequest, AuditLog, Holiday } from '@/lib/types';
import { format, intervalToDuration, isFriday, eachDayOfInterval, parseISO } from 'date-fns';

export type ReportType = 'Comprehensive' | 'SalaryChange' | 'JobChange' | 'ResidencyRenewal' | 'LeaveActivity';

export interface ReportHeader {
    key: string;
    label: string;
    type?: 'date' | 'currency' | 'number';
}

export interface ReportFooter {
    colSpan: number;
    label: string;
    value: string | number;
    type?: 'date' | 'currency' | 'number';
}

export interface ReportData {
    title: string;
    subtitle: string;
    headers: ReportHeader[];
    rows: DocumentData[];
    footer?: ReportFooter;
}

interface ReportOptions {
    dateFrom?: string;
    dateTo?: string;
    asOfDate?: string;
}

// --- Data Fetching Utilities ---

async function fetchAllData(db: Firestore, collectionName: string, conditions: any[] = []) {
    let q = query(collection(db, collectionName));
    conditions.forEach(cond => {
        q = query(q, where(cond.field, cond.op, cond.value));
    });
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function fetchSubcollection(db: Firestore, parentCollection: string, parentId: string, subcollectionName: string) {
    const subcollectionRef = collection(db, parentCollection, parentId, subcollectionName);
    const snapshot = await getDocs(query(subcollectionRef));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}


// --- Historical Data Reconstruction Logic ---

function toDate(timestampOrString: any): Date | null {
  if (timestampOrString === null || timestampOrString === undefined) return null;
  const date = timestampOrString?.toDate ? timestampOrString.toDate() : new Date(timestampOrString);
  return isNaN(date.getTime()) ? null : date;
}

function findValueAsOf(logs: AuditLog[], field: string, asOfDate: Date, initialValue: any) {
    const relevantLog = logs
        .filter(log => (log.field === field || (Array.isArray(log.field) && log.field.includes(field))) && toDate(log.effectiveDate)! <= asOfDate)
        .sort((a, b) => toDate(b.effectiveDate)!.getTime() - toDate(a.effectiveDate)!.getTime())[0];
    
    if (relevantLog) {
         if (typeof initialValue === 'object' && initialValue !== null && !Array.isArray(initialValue)) {
            return relevantLog.newValue?.[field] ?? initialValue;
        }
        return relevantLog.newValue;
    }
    return initialValue;
}

async function reconstructEmployeeState(db: Firestore, employee: Employee, asOfDate: Date): Promise<Partial<Employee>> {
    if (!employee.id) return {};
    const auditLogs = await fetchSubcollection(db, 'employees', employee.id, 'auditLogs') as AuditLog[];

    const reconstructedState: Partial<Employee> = {
        jobTitle: findValueAsOf(auditLogs, 'jobTitle', asOfDate, employee.jobTitle),
        department: findValueAsOf(auditLogs, 'department', asOfDate, employee.department),
        position: findValueAsOf(auditLogs, 'position', asOfDate, employee.position),
        basicSalary: findValueAsOf(auditLogs, 'basicSalary', asOfDate, employee.basicSalary),
        housingAllowance: findValueAsOf(auditLogs, 'housingAllowance', asOfDate, employee.housingAllowance),
        transportAllowance: findValueAsOf(auditLogs, 'transportAllowance', asOfDate, employee.transportAllowance),
        residencyExpiry: findValueAsOf(auditLogs, 'residencyExpiry', asOfDate, employee.residencyExpiry),
    };
    
    return reconstructedState;
}


// --- Calculation Utilities (as of date) ---

function calculateEosb(employee: Partial<Employee>, hireDate: Date, asOfDate: Date): number {
    const basicSalary = employee.basicSalary || 0;
    if (basicSalary === 0 || hireDate > asOfDate) return 0;
    
    const serviceDays = (asOfDate.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24);
    const yearsOfService = serviceDays / 365.25;

    let gratuity = 0;
    if (yearsOfService <= 5) {
        gratuity = (15 / 26) * basicSalary * yearsOfService;
    } else {
        gratuity += (15 / 26) * basicSalary * 5; // First 5 years
        gratuity += basicSalary * (yearsOfService - 5); // After 5 years
    }

    return gratuity;
}

function calculateLeaveBalance(allLeaveRequests: LeaveRequest[], holidays: Set<string>, employeeId: string | undefined, hireDate: Date, asOfDate: Date): number {
    if (!employeeId || hireDate > asOfDate) return 0;
    
    const yearsOfService = (asOfDate.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (yearsOfService < 1) return 0;
    
    const accruedDays = Math.floor(yearsOfService) * 30; // Simplified: 30 days per year after first year
    
    const leavesTaken = allLeaveRequests.filter(lr => {
        const startDate = toDate(lr.startDate);
        return lr.employeeId === employeeId && 
               lr.status === 'approved' && 
               lr.leaveType === 'Annual' && 
               startDate && startDate <= asOfDate;
    });

    let usedDays = 0;
    leavesTaken.forEach(leave => {
        const leaveStart = toDate(leave.startDate)!;
        const leaveEnd = toDate(leave.endDate)! > asOfDate ? asOfDate : toDate(leave.endDate)!;

        if(leaveStart > leaveEnd) return;

        const interval = eachDayOfInterval({ start: leaveStart, end: leaveEnd });
        interval.forEach(day => {
            const dayStr = format(day, 'yyyy-MM-dd');
            if (!isFriday(day) && !holidays.has(dayStr)) {
                usedDays++;
            }
        });
    });

    return accruedDays - usedDays;
}


// --- Report Generation Functions ---

async function generateComprehensiveReport(db: Firestore, options: ReportOptions): Promise<ReportData> {
    const asOfDate = options.asOfDate ? parseISO(options.asOfDate) : new Date();
    asOfDate.setHours(23, 59, 59, 999);

    const [employees, allLeaveRequests, holidaysSnapshot] = await Promise.all([
        fetchAllData(db, 'employees', [{ field: 'status', op: '==', value: 'active' }]) as Promise<Employee[]>,
        fetchAllData(db, 'leaveRequests') as Promise<LeaveRequest[]>,
        fetchAllData(db, 'holidays') as Promise<Holiday[]>
    ]);
    
    const holidays = new Set(holidaysSnapshot.map(h => {
        const holidayDate = toDate(h.date);
        return holidayDate ? format(holidayDate, 'yyyy-MM-dd') : '';
    }));

    const rows: DocumentData[] = [];

    for (const emp of employees) {
        const hireDate = toDate(emp.hireDate);
        if (!hireDate || hireDate > asOfDate) continue;

        const reconstructedState = await reconstructEmployeeState(db, emp, asOfDate);
        
        rows.push({
            fullName: emp.fullName,
            jobTitle: reconstructedState.jobTitle,
            department: reconstructedState.department,
            hireDate: emp.hireDate,
            eosb: calculateEosb(reconstructedState, hireDate, asOfDate),
            leaveBalance: calculateLeaveBalance(allLeaveRequests, holidays, emp.id, hireDate, asOfDate),
            residencyExpiry: reconstructedState.residencyExpiry
        });
    }

    return {
        title: 'تقرير الموظفين الشامل',
        subtitle: `البيانات كما في تاريخ: ${format(asOfDate, 'dd/MM/yyyy')}`,
        headers: [
            { key: 'fullName', label: 'اسم الموظف' },
            { key: 'jobTitle', label: 'المسمى الوظيفي' },
            { key: 'department', label: 'القسم' },
            { key: 'hireDate', label: 'تاريخ التعيين', type: 'date' },
            { key: 'residencyExpiry', label: 'انتهاء الإقامة', type: 'date' },
            { key: 'leaveBalance', label: 'رصيد الإجازة (يوم)', type: 'number' },
            { key: 'eosb', label: 'مكافأة نهاية الخدمة', type: 'currency' },
        ],
        rows,
    };
}


async function generateAuditLogReport(db: Firestore, changeType: AuditLog['changeType'], fields: string[], title: string, options: ReportOptions): Promise<ReportData> {
    const dateFrom = options.dateFrom ? parseISO(options.dateFrom) : new Date(0);
    const dateTo = options.dateTo ? parseISO(options.dateTo) : new Date();
    dateTo.setHours(23, 59, 59, 999);

    const employees = await fetchAllData(db, 'employees') as Employee[];
    const rows: DocumentData[] = [];

    const headersMap: Record<string, ReportHeader> = {
        employeeName: { key: 'employeeName', label: 'اسم الموظف' },
        effectiveDate: { key: 'effectiveDate', label: 'تاريخ التغيير', type: 'date' },
        oldValue: { key: 'oldValue', label: 'القيمة القديمة' },
        newValue: { key: 'newValue', label: 'القيمة الجديدة' },
        changedBy: { key: 'changedBy', label: 'تم بواسطة' },
    };

    for (const emp of employees) {
        if (!emp.id) continue;
        const auditLogs = await fetchSubcollection(db, 'employees', emp.id, 'auditLogs') as AuditLog[];
        const filteredLogs = auditLogs.filter(log => {
            const logDate = toDate(log.effectiveDate);
            return log.changeType === changeType && logDate && logDate >= dateFrom && logDate <= dateTo;
        });

        for (const log of filteredLogs) {
             const changedByEmp = employees.find(e => e.id === log.changedBy);
             let row: DocumentData = {
                employeeName: emp.fullName,
                effectiveDate: log.effectiveDate,
                changedBy: changedByEmp?.fullName || log.changedBy,
            };

            if (changeType === 'JobChange') {
                headersMap.oldJobTitle = { key: 'oldJobTitle', label: 'الوظيفة القديمة' };
                headersMap.newJobTitle = { key: 'newJobTitle', label: 'الوظيفة الجديدة' };
                headersMap.oldDepartment = { key: 'oldDepartment', label: 'القسم القديم' };
                headersMap.newDepartment = { key: 'newDepartment', label: 'القسم الجديد' };
                row = { 
                    ...row, 
                    oldJobTitle: log.oldValue?.jobTitle, 
                    newJobTitle: log.newValue?.jobTitle, 
                    oldDepartment: log.oldValue?.department, 
                    newDepartment: log.newValue?.department
                };
            } else {
                 if(fields.includes('residencyExpiry')) headersMap.oldValue.type = 'date';
                 if(fields.includes('residencyExpiry')) headersMap.newValue.type = 'date';
                 if(fields.includes('basicSalary')) headersMap.oldValue.type = 'currency';
                 if(fields.includes('basicSalary')) headersMap.newValue.type = 'currency';

                 row.oldValue = log.oldValue;
                 row.newValue = log.newValue;
            }
             rows.push(row);
        }
    }
    
    // Sort combined logs by date
    rows.sort((a,b) => toDate(b.effectiveDate)!.getTime() - toDate(a.effectiveDate)!.getTime());

    const finalHeaders = (changeType === 'JobChange')
        ? [headersMap.employeeName, headersMap.effectiveDate, headersMap.oldJobTitle, headersMap.newJobTitle, headersMap.oldDepartment, headersMap.newDepartment, headersMap.changedBy]
        : [headersMap.employeeName, headersMap.effectiveDate, headersMap.oldValue, headersMap.newValue, headersMap.changedBy];


    return {
        title,
        subtitle: `للفترة من ${format(dateFrom, 'dd/MM/yyyy')} إلى ${format(dateTo, 'dd/MM/yyyy')}`,
        headers: finalHeaders,
        rows
    };
}


async function generateLeaveActivityReport(db: Firestore, options: ReportOptions): Promise<ReportData> {
    const dateFrom = options.dateFrom ? parseISO(options.dateFrom) : new Date(0);
    const dateTo = options.dateTo ? parseISO(options.dateTo) : new Date();
    dateTo.setHours(23, 59, 59, 999);

    const allLeaveRequests = await fetchAllData(db, 'leaveRequests') as LeaveRequest[];
    
    const rows = allLeaveRequests.filter(lr => {
        const leaveDate = toDate(lr.startDate);
        return leaveDate && leaveDate >= dateFrom && leaveDate <= dateTo;
    }).map(lr => ({
        employeeName: lr.employeeName,
        leaveType: lr.leaveType,
        startDate: lr.startDate,
        endDate: lr.endDate,
        days: lr.workingDays ?? lr.days,
        status: lr.status
    })).sort((a,b) => toDate(b.startDate)!.getTime() - toDate(a.startDate)!.getTime());
    
    return {
        title: 'تقرير حركة الإجازات',
        subtitle: `للفترة من ${format(dateFrom, 'dd/MM/yyyy')} إلى ${format(dateTo, 'dd/MM/yyyy')}`,
        headers: [
            { key: 'employeeName', label: 'اسم الموظف' },
            { key: 'leaveType', label: 'نوع الإجازة' },
            { key: 'startDate', label: 'من تاريخ', type: 'date' },
            { key: 'endDate', label: 'إلى تاريخ', type: 'date' },
            { key: 'days', label: 'الأيام', type: 'number' },
            { key: 'status', label: 'الحالة' }
        ],
        rows
    };
}


// --- Main Entry Point ---

export async function generateReport(db: Firestore, reportType: ReportType, options: ReportOptions): Promise<ReportData> {
    switch (reportType) {
        case 'Comprehensive':
            return generateComprehensiveReport(db, options);
        case 'SalaryChange':
            return generateAuditLogReport(db, 'SalaryChange', ['basicSalary', 'housingAllowance', 'transportAllowance'], 'تقرير تغيرات الرواتب', options);
        case 'JobChange':
            return generateAuditLogReport(db, 'JobChange', ['jobTitle', 'department', 'position'], 'تقرير التغييرات الوظيفية', options);
        case 'ResidencyRenewal':
            return generateAuditLogReport(db, 'DataUpdate', ['residencyExpiry'], 'تقرير تجديد الإقامات', options);
        case 'LeaveActivity':
            return generateLeaveActivityReport(db, options);
        default:
            throw new Error('نوع التقرير غير معروف.');
    }
}
