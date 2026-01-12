

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

export type ReportType = 'Comprehensive' | 'SalaryChange' | 'JobChange' | 'ResidencyRenewal';

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

    // Statically define headers based on report type
    let finalHeaders: ReportHeader[];

    if (changeType === 'JobChange') {
        finalHeaders = [
            { key: 'employeeName', label: 'اسم الموظف' },
            { key: 'effectiveDate', label: 'تاريخ التغيير', type: 'date' },
            { key: 'oldJobTitle', label: 'الوظيفة القديمة' },
            { key: 'newJobTitle', label: 'الوظيفة الجديدة' },
            { key: 'oldDepartment', label: 'القسم القديم' },
            { key: 'newDepartment', label: 'القسم الجديد' },
            { key: 'changedBy', label: 'تم بواسطة' },
        ];
    } else {
        const oldValueHeader: ReportHeader = { key: 'oldValue', label: 'القيمة القديمة' };
        const newValueHeader: ReportHeader = { key: 'newValue', label: 'القيمة الجديدة' };

        if (fields.includes('residencyExpiry')) {
            oldValueHeader.type = 'date';
            newValueHeader.type = 'date';
        }
        if (fields.includes('basicSalary')) {
            oldValueHeader.type = 'currency';
            newValueHeader.type = 'currency';
        }
        
        finalHeaders = [
            { key: 'employeeName', label: 'اسم الموظف' },
            { key: 'effectiveDate', label: 'تاريخ التغيير', type: 'date' },
            oldValueHeader,
            newValueHeader,
            { key: 'changedBy', label: 'تم بواسطة' },
        ];
    }


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
                row = { 
                    ...row, 
                    oldJobTitle: log.oldValue?.jobTitle ?? null, 
                    newJobTitle: log.newValue?.jobTitle ?? null, 
                    oldDepartment: log.oldValue?.department ?? null, 
                    newDepartment: log.newValue?.department ?? null
                };
            } else {
                 row.oldValue = log.oldValue;
                 row.newValue = log.newValue;
            }
             rows.push(row);
        }
    }
    
    // Sort combined logs by date
    rows.sort((a,b) => toDate(b.effectiveDate)!.getTime() - toDate(a.effectiveDate)!.getTime());

    return {
        title,
        subtitle: `للفترة من ${format(dateFrom, 'dd/MM/yyyy')} إلى ${format(dateTo, 'dd/MM/yyyy')}`,
        headers: finalHeaders,
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
        default:
            throw new Error('نوع التقرير غير معروف.');
    }
}
