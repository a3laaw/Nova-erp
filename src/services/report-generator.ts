
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
    collectionGroup,
    doc,
    getDoc
} from 'firebase/firestore';
import type { Employee, LeaveRequest, AuditLog, Holiday } from '@/lib/types';
import { format, differenceInYears, eachDayOfInterval, isFriday, intervalToDuration, parseISO, differenceInDays } from 'date-fns';
import { toFirestoreDate, fromFirestoreDate } from './date-converter';
import { formatCurrency } from '@/lib/utils';
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


// --- Data Reconstruction Logic ---
function findValueAsOf(logs: AuditLog[], field: keyof Employee, asOfDate: Date, initialValue: any) {
    const relevantLog = logs
        .filter(log => {
            const effectiveDate = toFirestoreDate(log.effectiveDate);
            return log.field === field && effectiveDate && effectiveDate <= asOfDate;
        })
        .sort((a, b) => {
            const dateA = toFirestoreDate(a.effectiveDate);
            const dateB = toFirestoreDate(b.effectiveDate);
            return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
        })[0];
    
    return relevantLog ? relevantLog.newValue : initialValue;
}

async function getFullDossier(db: Firestore, employeeId: string, asOfDate: Date): Promise<Employee> {
    const [empSnap, auditLogsSnap, leaveRequestsSnap] = await Promise.all([
      getDoc(doc(db, 'employees', employeeId)),
      getDocs(query(collection(db, `employees/${employeeId}/auditLogs`))),
      getDocs(query(collection(db, 'leaveRequests'), where('employeeId', '==', employeeId))),
    ]);

    if (!empSnap.exists()) {
        throw new Error(`لم يتم العثور على الموظف بالمعرف: ${employeeId}`);
    }

    const baseEmployee = { id: empSnap.id, ...empSnap.data() } as Employee;
    const auditLogs = auditLogsSnap.docs.map(d => d.data() as AuditLog);
    const allLeaveRequests = leaveRequestsSnap.docs.map(d => ({id: d.id, ...d.data()} as LeaveRequest));
    
    const hireDate = toFirestoreDate(baseEmployee.hireDate);
    if (!hireDate) {
        throw new Error('تاريخ التعيين للموظف المحدد غير صالح.');
    }
    
    // --- Reconstruct state ---
    const reconstructedState: Partial<Employee> = {
        ...baseEmployee, // Start with base, then override with historical
        jobTitle: findValueAsOf(auditLogs, 'jobTitle', asOfDate, baseEmployee.jobTitle),
        department: findValueAsOf(auditLogs, 'department', asOfDate, baseEmployee.department),
        basicSalary: findValueAsOf(auditLogs, 'basicSalary', asOfDate, baseEmployee.basicSalary),
        housingAllowance: findValueAsOf(auditLogs, 'housingAllowance', asOfDate, baseEmployee.housingAllowance),
        transportAllowance: findValueAsOf(auditLogs, 'transportAllowance', asOfDate, baseEmployee.transportAllowance),
    };
    
    // --- Calculate Leave Balance ---
    const leaveBalance = calculateAnnualLeaveBalance(baseEmployee, asOfDate);
    const lastReturn = allLeaveRequests
        .filter(lr => {
            const returnDate = toFirestoreDate(lr.actualReturnDate);
            return lr.isBackFromLeave && returnDate && returnDate <= asOfDate;
        })
        .sort((a,b) => {
            const dateA = toFirestoreDate(a.actualReturnDate);
            const dateB = toFirestoreDate(b.actualReturnDate);
            return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
        })[0] || null;

    // --- Calculate EOSB ---
    const serviceDuration = intervalToDuration({ start: hireDate, end: asOfDate });
    const serviceInYears = (asOfDate.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    let calculatedEosb = 0;
    const currentSalary = reconstructedState.basicSalary || 0;
    if (serviceInYears > 0 && currentSalary > 0) {
        if (serviceInYears <= 5) {
            calculatedEosb = (15 / 26) * currentSalary * serviceInYears;
        } else {
            calculatedEosb = (15 / 26) * currentSalary * 5; // First 5 years
            calculatedEosb += currentSalary * (serviceInYears - 5); // Years after 5
        }
    }
    
    return {
        ...reconstructedState,
        id: employeeId,
        fullName: baseEmployee.fullName,
        nameEn: baseEmployee.nameEn,
        civilId: baseEmployee.civilId,
        mobile: baseEmployee.mobile,
        email: baseEmployee.email,
        dob: baseEmployee.dob,
        gender: baseEmployee.gender,
        nationality: baseEmployee.nationality,
        visaType: (baseEmployee as any).visaType,
        hireDate: baseEmployee.hireDate,
        status: baseEmployee.status,
        terminationDate: baseEmployee.terminationDate,
        terminationReason: baseEmployee.terminationReason,
        contractType: baseEmployee.contractType,
        salaryPaymentType: baseEmployee.salaryPaymentType,
        bankName: baseEmployee.bankName,
        iban: baseEmployee.iban,

        // Calculated fields
        auditLogs: auditLogs.sort((a,b) => {
            const dateA = toFirestoreDate(a.effectiveDate);
            const dateB = toFirestoreDate(b.effectiveDate);
            return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
        }),
        eosb: calculatedEosb,
        leaveBalance: leaveBalance,
        lastLeave: lastReturn,
        serviceDuration: serviceDuration,
    };
}


// --- MAIN EXPORT ---

export async function generateReport(db: Firestore, reportType: ReportType, options: ReportOptions): Promise<ReportData> {
    const asOfDate = parseISO(options.asOfDate);
    
    if (reportType === 'EmployeeRoster') {
        const empQuery = options.statusFilter === 'all'
            ? query(collection(db, 'employees'))
            : query(collection(db, 'employees'), where('status', '==', 'active'));
            
        const empSnap = await getDocs(empQuery);
        const rows = empSnap.docs.map(doc => {
            const emp = doc.data() as Employee;
            const hireDate = toFirestoreDate(emp.hireDate);
            const serviceYears = hireDate ? differenceInYears(asOfDate, hireDate) : 0;
            return {
                ...emp,
                hireDate: fromFirestoreDate(emp.hireDate),
                serviceYears: serviceYears,
            };
        });
        
        rows.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', 'ar'));

        return {
            type: 'EmployeeRoster',
            title: 'قائمة الموظفين',
            subtitle: `الحالة كما في تاريخ: ${options.asOfDate}`,
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
    }

    if (reportType === 'EmployeeDossier') {
        if (!options.employeeId) throw new Error("Employee ID is required for Dossier report.");

        if (options.employeeId !== 'all') {
            const employeeData = await getFullDossier(db, options.employeeId, asOfDate);
            return {
                type: 'EmployeeDossier',
                employee: employeeData,
            };
        } else {
             const empQuery = options.statusFilter === 'all'
                ? query(collection(db, 'employees'))
                : query(collection(db, 'employees'), where('status', '==', 'active'));

            const empSnap = await getDocs(empQuery);
            const dossiers = await Promise.all(empSnap.docs.map(doc => getFullDossier(db, doc.id, asOfDate)));
            
            return {
                type: 'BulkEmployeeDossiers',
                dossiers: dossiers,
            };
        }
    }

    throw new Error(`Report type ${reportType} is not implemented.`);
}
