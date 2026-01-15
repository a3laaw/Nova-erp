
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
import { toFirestoreDate, fromFirestoreDate } from './date-converter';
import { formatCurrency } from '@/lib/utils';

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


// --- MAIN EXPORT ---

export async function generateReport(db: Firestore, reportType: ReportType, options: ReportOptions): Promise<ReportData> {
    
    // Temporarily returning dummy data to prevent server crash during compilation.
    // The complex logic needs to be optimized.

    if (reportType === 'EmployeeRoster') {
        return {
            type: 'EmployeeRoster',
            title: 'ملخص جميع الموظفين (بيانات مؤقتة)',
            subtitle: `الحالة كما في تاريخ: ${options.asOfDate}`,
            headers: [
                { key: 'fullName', label: 'الاسم' },
                { key: 'department', label: 'القسم' },
                { key: 'status', label: 'الحالة' },
            ],
            rows: [
                { fullName: 'موظف تجريبي 1', department: 'الهندسة', status: 'active' },
                { fullName: 'موظف تجريبي 2', department: 'المحاسبة', status: 'on-leave' },
            ],
        };
    }

    if (reportType === 'EmployeeDossier') {
        const dummyEmployee: Employee = {
            id: options.employeeId || 'dummy-id',
            fullName: 'موظف تجريبي',
            nameEn: 'Dummy Employee',
            civilId: '123456789012',
            department: 'قسم تجريبي',
            jobTitle: 'وظيفة تجريبية',
            hireDate: new Date().toISOString(),
            contractType: 'permanent',
            basicSalary: 1200,
            status: 'active',
            mobile: '12345678',
            noticeStartDate: null,
            terminationDate: null,
            terminationReason: null,
            lastVacationAccrualDate: new Date().toISOString(),
            eosb: 5432.10,
            leaveBalance: 25,
        };

        if (options.employeeId && options.employeeId !== 'all') {
            return {
                type: 'EmployeeDossier',
                employee: dummyEmployee,
            };
        }

        return {
            type: 'BulkEmployeeDossiers',
            dossiers: [dummyEmployee, { ...dummyEmployee, id: 'dummy-2', fullName: 'موظف تجريبي آخر' }],
        };
    }

    throw new Error(`Report type ${reportType} is not implemented yet in this simplified version.`);
}
