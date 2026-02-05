
'use server';

import { 
    collection, getDocs, getDoc, doc, query, where, orderBy, limit, type Firestore 
} from 'firebase/firestore';
import { parseISO, isValid } from 'date-fns';
import { toFirestoreDate } from './date-converter';
import { calculateAnnualLeaveBalance } from './leave-calculator';

export type ReportType = 'EmployeeDossier' | 'EmployeeRoster';

function safeValue(val: any): any {
    if (val === null || val === undefined) return null;
    if (typeof val === 'object') {
        const date = toFirestoreDate(val);
        if (date) return date.toISOString();
        try {
            // Attempt to stringify, but fall back if it fails (e.g., circular)
            return JSON.stringify(val);
        } catch {
            return '[Complex Data]';
        }
    }
    return val;
}

function mapSafeEmployee(id: string, data: any): any {
    return {
        id: id,
        fullName: data.fullName || '',
        nameEn: data.nameEn || '',
        employeeNumber: data.employeeNumber || '',
        department: data.department || '',
        jobTitle: data.jobTitle || '',
        status: data.status || 'active',
        basicSalary: Number(data.basicSalary) || 0,
        housingAllowance: Number(data.housingAllowance) || 0,
        transportAllowance: Number(data.transportAllowance) || 0,
        
        hireDate: toFirestoreDate(data.hireDate)?.toISOString() || null,
        contractExpiry: toFirestoreDate(data.contractExpiry)?.toISOString() || null,
        residencyExpiry: toFirestoreDate(data.residencyExpiry)?.toISOString() || null,
        dob: toFirestoreDate(data.dob)?.toISOString() || null,
        
        annualLeaveUsed: Number(data.annualLeaveUsed) || 0,
        carriedLeaveDays: Number(data.carriedLeaveDays) || 0,
    };
}

async function reconstructEmployeeState(db: Firestore, employeeId: string, asOfDate: Date) {
    const [empSnap, auditLogsSnap] = await Promise.all([
        getDoc(doc(db, 'employees', employeeId)),
        getDocs(query(collection(db, `employees/${employeeId}/auditLogs`), orderBy('effectiveDate', 'desc'), limit(100)))
    ]);

    if (!empSnap.exists()) return null;

    const currentData = empSnap.data();
    
    const auditLogs = auditLogsSnap.docs.map(d => {
        const logData = d.data();
        return {
            id: d.id,
            field: logData.field || '',
            oldValue: safeValue(logData.oldValue), 
            newValue: safeValue(logData.newValue),
            effectiveDate: toFirestoreDate(logData.effectiveDate)?.toISOString() || null,
        };
    });

    let state: any = mapSafeEmployee(empSnap.id, currentData);

    for (const log of auditLogs) {
        const logDate = log.effectiveDate ? new Date(log.effectiveDate) : null;
        
        if (logDate && logDate > asOfDate) {
            const fieldName = log.field;
            if (fieldName && Object.prototype.hasOwnProperty.call(state, fieldName)) {
                state[fieldName] = log.oldValue; 
            }
        }
    }

    return { ...state, auditLogs }; 
}

export async function generateReport(db: Firestore, reportType: ReportType, options: any) {
    try {
        const asOfDate = parseISO(options.asOfDate);
        if (!isValid(asOfDate)) throw new Error("التاريخ غير صالح");

        let result: any = {};

        if (reportType === 'EmployeeDossier') {
            if (!options.employeeId) throw new Error("مطلوب تحديد الموظف");

            if (options.employeeId !== 'all') {
                const emp = await reconstructEmployeeState(db, options.employeeId, asOfDate);
                if (!emp) throw new Error("الموظف غير موجود");

                let leaveBalance = 0;
                try {
                    const tempHireDate = emp.hireDate ? new Date(emp.hireDate) : null;
                    leaveBalance = calculateAnnualLeaveBalance({ ...emp, hireDate: tempHireDate }, asOfDate);
                } catch { leaveBalance = 0; }

                result = {
                    type: 'EmployeeDossier',
                    employee: { ...emp, leaveBalance }
                };
            } else {
                const q = query(collection(db, 'employees'), where('status', '==', 'active'), limit(20));
                const snap = await getDocs(q);
                const dossiers = [];
                
                for (const d of snap.docs) {
                    try {
                        const emp = await reconstructEmployeeState(db, d.id, asOfDate);
                        if (emp) {
                             const tempHireDate = emp.hireDate ? new Date(emp.hireDate) : null;
                             const lb = calculateAnnualLeaveBalance({ ...emp, hireDate: tempHireDate }, asOfDate);
                             dossiers.push({ ...emp, leaveBalance: lb });
                        }
                    } catch (innerErr) {
                        console.error(`Error processing doc ${d.id}`, innerErr);
                    }
                }
                result = { type: 'BulkEmployeeDossiers', dossiers };
            }
        } 
        
        return result; 

    } catch (error: any) {
        console.error("REPORT ERROR:", error);
        throw new Error(error.message || "حدث خطأ غير متوقع في السيرفر");
    }
}

    