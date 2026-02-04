# وحدة التقارير الشاملة للموارد البشرية: شرح تفصيلي للكود والمنطق

هذا المستند يقدم شرحًا معمقًا لوحدة "التقارير الشاملة" في قسم الموارد البشرية، موضحًا كيف تعمل التقارير التاريخية، مع عرض الأكواد البرمجية الأساسية التي تشغل هذه الميزة.

---

### 1. الفلسفة الأساسية: تقارير "في لحظة زمنية" (Point-in-Time)

يكمن سر هذه الميزة في "السجل الزمني للتغييرات" (Audit Log). كل تعديل يتم على ملف الموظف (مثل تغيير الراتب، المسمى الوظيفي، أو القسم) يتم تسجيله مع تاريخه. عند طلب تقرير بتاريخ معين، يقوم النظام بالخطوات التالية:

1.  **جلب البيانات الحالية:** يبدأ بأخذ الحالة الحالية للموظف.
2.  **السفر عبر الزمن:** يقرأ سجل التغييرات الخاص بالموظف ويعكس التعديلات زمنيًا للوصول إلى الحالة الدقيقة التي كان عليها الموظف في التاريخ الذي حددته في التقرير.
3.  **إعادة الحساب:** بناءً على هذه البيانات التاريخية، يقوم بإعادة حساب كل شيء: رصيد الإجازات، قيمة نهاية الخدمة، ومدة الخدمة، تمامًا كما لو كنت قد ولّدت التقرير في ذلك اليوم.

هذا يسمح لك بالإجابة على أسئلة مثل: "كم كان راتب الموظف في بداية السنة؟" أو "ما هو الرصيد الفعلي لإجازاته في تاريخ معين؟" بدقة تامة.

---

### 2. شرح التقارير المتاحة

#### أ. ملف الموظف الشامل (Employee Dossier)

*   **الوصف:** هو تقرير فردي مفصل يعرض "بطاقة موظف" كاملة كما كانت بياناته في تاريخ محدد.
*   **المحتويات:**
    *   البيانات الشخصية والوظيفية والمالية.
    *   **رصيد الإجازات المحسوب بدقة** حتى ذلك التاريخ.
    *   **مكافأة نهاية الخدمة المستحقة** حتى ذلك التاريخ.
    *   **مدة الخدمة** المحسوبة حتى ذلك التاريخ.
    *   **سجل التغييرات الكامل** الذي طرأ على ملفه.
*   **الاستخدام:** مثالي للطباعة الرسمية، المراجعات السنوية، أو عند إنهاء خدمة الموظف.

#### ب. قائمة الموظفين (Employee Roster)

*   **الوصف:** تقرير جماعي يعرض قائمة بالموظفين بناءً على فلاتر معينة (مثل "النشطون فقط").
*   **المحتويات:**
    *   يعرض بيانات الموظفين الأساسية (الاسم، القسم، المسمى الوظيفي).
    *   **الأهم:** يقوم بحساب "سنوات الخدمة" لكل موظف بناءً على تاريخ التقرير الذي تحدده، وليس بناءً على تاريخ اليوم.

---

### 3. الكود البرمجي الرئيسي

#### أ. منطق توليد التقرير (services/report-generator.ts)

هذا هو الملف الذي يحتوي على العقل المدبر للعملية بأكملها. الدالة `generateReport` هي المسؤولة عن جلب البيانات وإعادة بنائها.

```typescript
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
        .filter(log => log.field === field && toFirestoreDate(log.effectiveDate)! <= asOfDate)
        .sort((a, b) => toFirestoreDate(b.effectiveDate)!.getTime() - toFirestoreDate(a.effectiveDate)!.getTime())[0];
    
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
        .filter(lr => lr.isBackFromLeave && toFirestoreDate(lr.actualReturnDate)! <= asOfDate)
        .sort((a,b) => toFirestoreDate(b.actualReturnDate)!.getTime() - toFirestoreDate(a.actualReturnDate)!.getTime())[0] || null;

    // --- Calculate EOSB ---
    const serviceDuration = intervalToDuration({ start: hireDate, end: asOfDate });
    const serviceInYears = (asOfDate.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    let calculatedEosb = 0;
    const currentSalary = reconstructedState.basicSalary || 0;
    if (serviceInYears > 0 && currentSalary > 0) {
        if (serviceInYears <= 5) {
            calculatedEosb = (15 / 26) * currentSalary * serviceInYears;
        } else {
            calculatedEosb += (15 / 26) * currentSalary * 5; // First 5 years
            calculatedEosb += currentSalary * (serviceInYears - 5); // Years after 5
        }
    }
    
    return {
        ...reconstructedState,
        id: employeeId,
        fullName: baseEmployee.fullName,
        // ... (other base fields)
        auditLogs: auditLogs.sort((a,b) => toFirestoreDate(b.effectiveDate)!.getTime() - toFirestoreDate(a.effectiveDate)!.getTime()),
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
        // ... (code for roster report)
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
```

#### ب. واجهة المستخدم لصفحة التقارير (app/dashboard/hr/reports/page.tsx)

هذا الكود يمثل الواجهة التي تتفاعل معها لاختيار نوع التقرير والفلاتر، ثم عرض النتائج.

```tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
// ... (imports)
import { generateReport, ReportData } from '@/services/report-generator';
import { EmployeeDossier } from '@/components/hr/employee-dossier';

export default function ReportsPage() {
    // ... (state management for inputs and loading)
    
    const handleGenerateReport = async () => {
        // ... (validation)

        setIsGenerating(true);
        setReportData(null);
        
        const options = { asOfDate, employeeId: selectedEmployeeId, statusFilter };

        try {
            const data = await generateReport(firestore, reportType, options);
            setReportData(data);
        } catch (error) {
            // ... (error handling)
        } finally {
            setIsGenerating(false);
        }
    };
    
    // ... (UI rendering logic with inputs and buttons)

    return (
        <div className='space-y-6'>
            {/* ... (UI for report options) ... */}
            
            {reportData && !isGenerating && (
                <div className="space-y-4">
                    {/* ... (UI for displaying report title and print button) ... */}

                    {reportData.type === 'EmployeeDossier' && reportData.employee && (
                        <EmployeeDossier employee={reportData.employee} reportDate={parseISO(asOfDate)} />
                    )}
                    {/* ... (other report type renderings) ... */}
                </div>
            )}
        </div>
    );
}
```

#### ج. مكون عرض ملف الموظف (components/hr/employee-dossier.tsx)

هذا هو المكون المسؤول عن عرض "بطاقة الموظف الشاملة" بشكل أنيق وجاهز للطباعة.

```tsx
'use client';

import React from 'react';
// ... (imports)

// ... (helper functions for formatting)

export function EmployeeDossier({ employee, reportDate }: { employee: Partial<Employee>, reportDate: Date }) {
  // ... (calculations like service duration)
  const serviceDuration = employee.serviceDuration;
  const lastLeave = employee.lastLeave as LeaveRequest | null;


  return (
    <div className="p-4 md:p-6 bg-background font-body print:p-0">
        {/* ... (Header with company branding) ... */}
        
        <main className="space-y-4 pt-8">
            <Section title="المعلومات الشخصية والأساسية" icon={<User />}>
                <InfoItem label="الاسم بالعربية:" value={employee.fullName} />
                {/* ... (other personal info fields) ... */}
            </Section>

            <Section title="البيانات الوظيفية والعقد" icon={<Briefcase />}>
                 <InfoItem label="المسمى الوظيفي:" value={employee.jobTitle} />
                 {/* ... (other job info fields from the report data) ... */}
            </Section>
            
            <Section title="البيانات المالية" icon={<Wallet />}>
                <InfoItem label="الراتب الأساسي:" value={formatCurrency(employee.basicSalary || 0)} />
                {/* ... (other financial info) ... */}
            </Section>

            <Section title="حالة الإجازات" icon={<Calendar />}>
                <div className="md:col-span-2 bg-muted/50 p-3 rounded-md text-center">
                    <p>رصيد الإجازات السنوية المتاح حتى تاريخ التقرير</p>
                    <p className="text-2xl font-bold text-primary">{employee.leaveBalance?.toFixed(0) ?? 0} يوم</p>
                </div>
                {/* ... (Display last leave info) ... */}
            </Section>

            <Section title="استحقاق نهاية الخدمة" icon={<Gift />}>
                 <div className="md:col-span-2 bg-blue-50 p-4 rounded-md border border-blue-200">
                    <InfoItem label="مدة الخدمة حتى تاريخ التقرير" value={`${serviceDuration.years || 0} سنة, ...`} />
                    <div className="flex justify-between items-center mt-2 pt-2 border-t">
                        <span>قيمة نهاية الخدمة المستحقة:</span>
                        <span className="font-bold text-lg text-blue-600">{formatCurrency(employee.eosb || 0)}</span>
                    </div>
                </div>
            </Section>
        </main>
        {/* ... (Footer) ... */}
    </div>
  );
}
```
