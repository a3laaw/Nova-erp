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
    collectionGroup,
    limit,
    doc,
    getDoc
} from 'firebase/firestore';
import type { Employee, LeaveRequest, AuditLog, Holiday } from '@/lib/types';
import { format, differenceInYears, eachDayOfInterval, isFriday, intervalToDuration, parseISO, differenceInDays } from 'date-fns';
import { toFirestoreDate } from './date-converter';
import { formatCurrency } from '@/lib/utils';
import { calculateAnnualLeaveBalance } from './leave-calculator';


// Define a serializable Employee type for reports
type SerializableEmployee = Omit<Employee, 'hireDate' | 'dob' | 'residencyExpiry' | 'contractExpiry' | 'terminationDate' | 'lastVacationAccrualDate' | 'lastLeaveResetDate' | 'createdAt' | 'lastLeave' | 'auditLogs'> & {
  hireDate: string | null;
  dob: string | null;
  residencyExpiry: string | null;
  contractExpiry: string | null;
  terminationDate: string | null;
  lastLeave: (Omit<LeaveRequest, 'startDate' | 'endDate' | 'actualReturnDate'> & { startDate: string, endDate: string, actualReturnDate: string | null }) | null;
  auditLogs: (Omit<AuditLog, 'effectiveDate'> & { effectiveDate: string })[];
  serviceDuration: Duration;
};


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


// --- Helper Functions ---

function findValueAsOf(logs: AuditLog[], field: keyof Employee, asOfDate: Date, initialValue: any) {
  const relevantLog = logs.find(log => {
    const effectiveDate = toFirestoreDate(log.effectiveDate);
    return log.field === field && effectiveDate && effectiveDate <= asOfDate;
  });
  return relevantLog ? relevantLog.newValue : initialValue;
}

async function reconstructEmployeeState(db: Firestore, employeeId: string, asOfDate: Date): Promise<SerializableEmployee> {
  try {
    const [empSnap, auditLogsSnap, leaveRequestsSnap] = await Promise.all([
      getDoc(doc(db, 'employees', employeeId)),
      getDocs(query(collection(db, `employees/${employeeId}/auditLogs`), orderBy('effectiveDate', 'desc'), limit(500))),
      getDocs(query(collection(db, 'leaveRequests'), where('employeeId', '==', employeeId))),
    ]);

    if (!empSnap.exists()) {
      throw new Error(`Employee with ID ${employeeId} not found.`);
    }

    const baseData = empSnap.data();
    const hireDate = toFirestoreDate(baseData.hireDate);
    if (!hireDate) {
      throw new Error(`Invalid or missing hire date for employee ID: ${employeeId}`);
    }

    const auditLogs = auditLogsSnap.docs.map(d => d.data() as AuditLog);
    const allLeaveRequests = leaveRequestsSnap.docs.map(d => ({ id: d.id, ...d.data() } as LeaveRequest));
    
    // --- Manual Mapping & Reconstruction ---
    const reconstructedState: Partial<Employee> = {
      jobTitle: findValueAsOf(auditLogs, 'jobTitle', asOfDate, baseData.jobTitle),
      department: findValueAsOf(auditLogs, 'department', asOfDate, baseData.department),
      basicSalary: findValueAsOf(auditLogs, 'basicSalary', asOfDate, baseData.basicSalary),
      housingAllowance: findValueAsOf(auditLogs, 'housingAllowance', asOfDate, baseData.housingAllowance),
      transportAllowance: findValueAsOf(auditLogs, 'transportAllowance', asOfDate, baseData.transportAllowance),
    };

    // --- Safe Calculations ---
    let leaveBalance = 0;
    try {
        leaveBalance = calculateAnnualLeaveBalance({ ...baseData, ...reconstructedState } as Employee, asOfDate);
    } catch (e) {
        console.error(`Could not calculate leave balance for ${employeeId}:`, e);
    }
    
    const lastReturn = allLeaveRequests
      .filter(lr => {
        const returnDate = toFirestoreDate(lr.actualReturnDate);
        return lr.isBackFromLeave && returnDate && returnDate <= asOfDate;
      })
      .sort((a, b) => (toFirestoreDate(b.actualReturnDate)?.getTime() || 0) - (toFirestoreDate(a.actualReturnDate)?.getTime() || 0))[0] || null;

    const serviceDuration = intervalToDuration({ start: hireDate, end: asOfDate });
    const serviceInYears = (asOfDate.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    let calculatedEosb = 0;
    const currentSalary = reconstructedState.basicSalary || 0;

    if (serviceInYears > 0 && currentSalary > 0) {
      if (serviceInYears <= 5) {
        calculatedEosb = (15 / 26) * currentSalary * serviceInYears;
      } else {
        const first5YearsGratuity = (15 / 26) * currentSalary * 5;
        const remainingYearsGratuity = currentSalary * (serviceInYears - 5);
        calculatedEosb = first5YearsGratuity + remainingYearsGratuity;
      }
    }

    // --- Final Manual Mapping to Plain Serializable Object ---
    const finalData = {
        id: empSnap.id,
        employeeNumber: baseData.employeeNumber,
        fullName: baseData.fullName,
        nameEn: baseData.nameEn,
        dob: toFirestoreDate(baseData.dob)?.toISOString() || null,
        gender: baseData.gender,
        civilId: baseData.civilId,
        nationality: baseData.nationality,
        residencyExpiry: toFirestoreDate(reconstructedState.residencyExpiry ?? baseData.residencyExpiry)?.toISOString() || null,
        contractExpiry: toFirestoreDate(reconstructedState.contractExpiry ?? baseData.contractExpiry)?.toISOString() || null,
        mobile: baseData.mobile,
        emergencyContact: baseData.emergencyContact,
        email: baseData.email,
        jobTitle: reconstructedState.jobTitle,
        position: reconstructedState.position,
        department: reconstructedState.department,
        contractType: baseData.contractType,
        hireDate: hireDate.toISOString(),
        terminationDate: toFirestoreDate(baseData.terminationDate)?.toISOString() || null,
        terminationReason: baseData.terminationReason,
        status: baseData.status,
        basicSalary: reconstructedState.basicSalary,
        housingAllowance: reconstructedState.housingAllowance,
        transportAllowance: reconstructedState.transportAllowance,
        salaryPaymentType: baseData.salaryPaymentType,
        bankName: baseData.bankName,
        iban: baseData.iban,
        eosb: calculatedEosb,
        leaveBalance,
        serviceDuration,
        auditLogs: auditLogs.map(log => ({
            ...log,
            effectiveDate: toFirestoreDate(log.effectiveDate)?.toISOString() || ''
        })),
        lastLeave: lastReturn ? {
            ...lastReturn,
            startDate: toFirestoreDate(lastReturn.startDate)?.toISOString() || '',
            endDate: toFirestoreDate(lastReturn.endDate)?.toISOString() || '',
            actualReturnDate: toFirestoreDate(lastReturn.actualReturnDate)?.toISOString() || null,
        } : null,
    };
    
    // Explicitly remove fields that might not be serializable
    delete (finalData as any).lastVacationAccrualDate;
    delete (finalData as any).lastLeaveResetDate;
    delete (finalData as any).createdAt;

    return finalData as SerializableEmployee;

  } catch (error) {
    console.error(`Failed to reconstruct state for employee ${employeeId}:`, error);
    throw new Error(`Could not generate report for employee ${employeeId}. Please check their data. Original error: ${error instanceof Error ? error.message : String(error)}`);
  }
}


export async function generateReport(db: Firestore, reportType: ReportType, options: ReportOptions): Promise<ReportData> {
  let result: ReportData;

  try {
    const asOfDate = parseISO(options.asOfDate);

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

      result = {
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
      if (!options.employeeId) throw new Error("Employee ID is required for Dossier report.");

      if (options.employeeId !== 'all') {
        const employeeData = await reconstructEmployeeState(db, options.employeeId, asOfDate);
        result = {
          type: 'EmployeeDossier',
          employee: employeeData,
        };
      } else {
        const q = options.statusFilter === 'all'
          ? query(collection(db, 'employees'), limit(50))
          : query(collection(db, 'employees'), where('status', '==', 'active'), limit(50));
        const empSnap = await getDocs(q);
        const dossiers = await Promise.all(empSnap.docs.map(doc => reconstructEmployeeState(db, doc.id, asOfDate)));
        result = {
          type: 'BulkEmployeeDossiers',
          dossiers,
        };
      }
    } else {
      throw new Error(`Report type '${reportType}' is not implemented.`);
    }

    // CRITICAL: Final sanitization step to strip any remaining non-serializable prototypes.
    return JSON.parse(JSON.stringify(result));

  } catch (error) {
    console.error("Error in generateReport:", error);
    throw new Error(error instanceof Error ? error.message : 'An unknown error occurred on the server.');
  }
}
```

#### ب. واجهة المستخدم لصفحة التقارير (app/dashboard/hr/reports/page.tsx)

هذا الكود يمثل الواجهة التي تتفاعل معها لاختيار نوع التقرير والفلاتر، ثم عرض النتائج.

```tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search, FileText, Printer, AlertTriangle } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import { ReportResults } from '@/components/hr/report-results';
import { generateReport, ReportData, ReportType, BulkReportData, StandardReportData } from '@/services/report-generator';
import type { Employee } from '@/lib/types';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { EmployeeDossier } from '@/components/hr/employee-dossier';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: 'EmployeeDossier', label: 'ملف الموظف الشامل' },
  { value: 'EmployeeRoster', label: 'قائمة الموظفين (Roster)' },
];

export default function ReportsPage() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  
  const [reportType, setReportType] = useState<ReportType>('EmployeeDossier');
  const [asOfDate, setAsOfDate] = useState<string>('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'all'>('active');
  
  useEffect(() => {
    setAsOfDate(format(new Date(), 'yyyy-MM-dd'));
  }, []);

  useEffect(() => {
    if (!firestore) return;
    const fetchEmployees = async () => {
      try {
        const q = query(collection(firestore, 'employees'));
        const querySnapshot = await getDocs(q);
        
        // Manually map to plain objects to avoid serialization issues
        const fetchedEmployees: Employee[] = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                fullName: data.fullName,
                employeeNumber: data.employeeNumber,
            } as Employee;
        }).filter(emp => emp.fullName); // Ensure fullName exists
        
        const sortedEmployees = fetchedEmployees.sort((a,b) => (a.fullName || '').localeCompare(b.fullName || '', 'ar'));
        setEmployees(sortedEmployees);
        
      } catch (error) {
        console.error("Error fetching employees:", error);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب قائمة الموظفين.' });
      }
    };
    fetchEmployees();
  }, [firestore, toast]);
    
  const employeeOptions = useMemo(() => [
    { value: 'all', label: 'جميع الموظفين (تقرير جماعي)' },
    ...employees.map(emp => ({
        value: emp.id!,
        label: emp.fullName,
        searchKey: emp.employeeNumber
    }))
  ], [employees]);

  const handleGenerateReport = async () => {
    if (!firestore) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'لا يمكن الاتصال بقاعدة البيانات.' });
      return;
    }
    if (reportType === 'EmployeeDossier' && !selectedEmployeeId) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء اختيار موظف لإنشاء التقرير الشامل.' });
      return;
    }

    setIsGenerating(true);
    setReportData(null);
    setError(null);
    
    const options = { asOfDate, employeeId: selectedEmployeeId, statusFilter };

    try {
      const data = await generateReport(firestore, reportType, options);
      
      if (('rows' in data && data.rows.length === 0) || ('dossiers' in data && data.dossiers.length === 0)) {
        toast({ title: 'لا توجد بيانات', description: 'لم يتم العثور على نتائج تطابق معايير البحث المحددة.' });
      }
      setReportData(data);
    } catch (err: any) {
      console.error("Error generating report: ", err);
      const errorMessage = err instanceof Error ? err.message : 'حدث خطأ غير متوقع.';
      setError(errorMessage);
      toast({ variant: 'destructive', title: 'فشل إنشاء التقرير', description: errorMessage });
    } finally {
      setIsGenerating(false);
    }
  };
    
  const handlePrint = () => {
    if (!reportData) return;
    
    if (reportData.type === 'EmployeeDossier' && reportData.employee.id) {
      const printUrl = `/dashboard/hr/employees/${reportData.employee.id}/report`;
      window.open(printUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    // Printing for other report types can be added here
    toast({ title: "غير متاح", description: "الطباعة متاحة فقط لتقرير الموظف الفردي حالياً." });
  };

  const isPrintable = reportData && reportData.type === 'EmployeeDossier';

  return (
    <div className='space-y-6'>
        <Card dir="rtl" className="print:shadow-none print:border-none">
            <CardHeader className="print:hidden">
                <CardTitle>التقارير الشاملة للموظفين</CardTitle>
                <CardDescription>
                    توليد تقارير متقدمة بناءً على سجلات الموظفين وتاريخهم الوظيفي.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="bg-muted/50 p-4 rounded-lg mb-6 print:hidden">
                    <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end'>
                        <div className="grid gap-2">
                            <Label htmlFor="reportType">نوع التقرير</Label>
                             <Select dir="rtl" value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
                                <SelectTrigger id="reportType"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {REPORT_TYPES.map(rt => (
                                        <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                         <div className="grid gap-2">
                            <Label htmlFor="asOfDate">تاريخ التقرير</Label>
                            <Input id="asOfDate" type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
                        </div>
                        
                        {reportType === 'EmployeeDossier' && (
                             <div className="grid gap-2">
                                <Label htmlFor="employeeFilter">تحديد موظف</Label>
                                <InlineSearchList
                                    value={selectedEmployeeId}
                                    onSelect={setSelectedEmployeeId}
                                    options={employeeOptions}
                                    placeholder='ابحث عن موظف...'
                                />
                            </div>
                        )}

                        {selectedEmployeeId === 'all' && (
                             <div className="grid gap-2">
                                <Label htmlFor="statusFilter">حالة الموظفين</Label>
                                <Select dir="rtl" value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                                    <SelectTrigger id="statusFilter"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">النشطون فقط</SelectItem>
                                        <SelectItem value="all">الكل</SelectItem>
                                    </SelectContent>
                                </Select>
                             </div>
                        )}
                       
                        <Button onClick={handleGenerateReport} disabled={isGenerating}>
                            {isGenerating ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Search className="ml-2 h-4 w-4" />}
                            {isGenerating ? 'جاري الإنشاء...' : 'إنشاء التقرير'}
                        </Button>
                    </div>
                </div>

                {isGenerating && (
                     <div className="p-8 text-center border-2 border-dashed rounded-lg">
                        <Loader2 className="mx-auto h-12 w-12 text-muted-foreground animate-spin" />
                        <h3 className="mt-4 text-lg font-medium">جاري إنشاء التقرير...</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                            قد تستغرق هذه العملية بعض الوقت، خصوصًا مع التقارير الجماعية.
                        </p>
                    </div>
                )}
                 
                 {error && !isGenerating && (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>فشل إنشاء التقرير</AlertTitle>
                        <AlertDescription>
                            {error}
                            <p className='mt-2 text-xs'>قد تكون المشكلة بسبب بيانات غير مكتملة لأحد الموظفين. الرجاء مراجعة البيانات والمحاولة مرة أخرى.</p>
                        </AlertDescription>
                    </Alert>
                )}
                 
                 <div id="report-content-to-print">
                    {reportData && !isGenerating && (
                        <div className="space-y-4">
                             <div className='p-4 flex justify-between items-center print:p-0 print:mb-4'>
                                <div>
                                    <h3 className='font-bold text-lg'>{reportData.type === 'EmployeeDossier' ? 'ملف الموظف الشامل' : reportData.type === 'BulkEmployeeDossiers' ? `تقرير جماعي لـ ${reportData.dossiers.length} موظفين` : (reportData as StandardReportData).title}</h3>
                                    <p className='text-sm text-muted-foreground' dir='ltr'>As of: {format(parseISO(asOfDate), "dd/MM/yyyy")}</p>
                                </div>
                                <Button variant="outline" onClick={handlePrint} className="print:hidden" disabled={!isPrintable}>
                                    <Printer className="ml-2 h-4 w-4" />
                                    طباعة
                                </Button>
                            </div>

                            {reportData.type === 'EmployeeDossier' && reportData.employee && (
                                <EmployeeDossier employee={reportData.employee} reportDate={parseISO(asOfDate)} />
                            )}
                            {reportData.type === 'BulkEmployeeDossiers' && (
                                <div className='space-y-8'>
                                    {reportData.dossiers.map(emp => (
                                        <div key={emp.id} className="page-break print:break-before-page">
                                            <EmployeeDossier employee={emp} reportDate={parseISO(asOfDate)} />
                                        </div>
                                    ))}
                                </div>
                            )}
                            {reportData.type === 'EmployeeRoster' && 'rows' in reportData && (
                                <ReportResults reportData={reportData} />
                            )}
                        </div>
                    )}
                 </div>
                
                {!reportData && !isGenerating && !error && (
                    <div className="p-8 text-center border-2 border-dashed rounded-lg">
                        <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                        <h3 className="mt-4 text-lg font-medium">جاهز لإنشاء التقارير</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                            اختر نوع التقرير والفترة الزمنية ثم اضغط على "إنشاء التقرير" لعرض النتائج.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    </div>
  );
}
```

#### ج. مكون عرض ملف الموظف (components/hr/employee-dossier.tsx)

هذا هو المكون المسؤول عن عرض "بطاقة الموظف الشاملة" بشكل أنيق وجاهز للطباعة.

```tsx
'use client';

import React, { useEffect, useState } from 'react';
import type { Employee, AuditLog, LeaveRequest } from '@/lib/types';
import { parseISO } from 'date-fns';
import { Logo } from '../layout/logo';
import { formatCurrency } from '@/lib/utils';
import { Banknote, Briefcase, Calendar, Gift, History, Phone, User, Wallet, AlertCircle } from 'lucide-react';
import { Badge } from '../ui/badge';
import { useBranding } from '@/context/branding-context';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

// Props accept a serializable version of the employee
interface DossierProps {
  employee: Partial<Employee & { hireDate: string | null; lastLeave: any; serviceDuration: any; auditLogs: any[] }>;
  reportDate: Date;
}

const formatDate = (dateValue: string | null | undefined, fallback = '-') => {
  if (!dateValue) return fallback;
  try {
    const date = parseISO(dateValue);
    return new Intl.DateTimeFormat('ar-KW', { day: '2-digit', month: '2-digit', year: 'numeric', numberingSystem: 'latn' }).format(date);
  } catch (e) {
    return dateValue; // return the string if parsing fails
  }
};

const typeTranslations: { [key: string]: string } = {
  'Annual': 'سنوية', 'Sick': 'مرضية', 'Emergency': 'طارئة', 'Unpaid': 'بدون راتب',
};

const statusTranslations: Record<string, string> = {
  active: 'نشط', 'on-leave': 'في إجازة', terminated: 'منتهية خدمته',
};

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800', 'on-leave': 'bg-yellow-100 text-yellow-800', terminated: 'bg-red-100 text-red-800',
};

function InfoItem({ label, value }: { label: string, value: string | number | null | undefined | React.ReactNode }) {
  return (
      <div className="flex justify-between items-center py-1 print:py-0.5">
          <span className="text-muted-foreground">{label}:</span>
          <span className="font-semibold text-right">{value ?? '-'}</span>
      </div>
  );
}

function Section({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) {
    return (
        <div className="border rounded-lg p-4 print:border-none print:p-2">
            <h3 className="flex items-center gap-2 font-bold text-lg mb-4 text-primary border-b pb-2 print:text-base print:mb-2">{icon}{title}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                {children}
            </div>
        </div>
    );
}

export function EmployeeDossier({ employee, reportDate }: DossierProps) {
  const [currentDate, setCurrentDate] = useState<string | null>(null);
  const { branding } = useBranding();

  useEffect(() => {
    setCurrentDate(new Date().toISOString());
  }, []);

  if (!employee) {
    return (
      <Alert variant="destructive" dir="rtl">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>خطأ في البيانات</AlertTitle>
        <AlertDescription>لا يمكن عرض ملف الموظف لأن البيانات غير متوفرة.</AlertDescription>
      </Alert>
    );
  }
  
  const serviceDuration = employee.serviceDuration;
  const currentStatus = employee.status ?? 'active';
  const lastLeave = employee.lastLeave;

  return (
    <div className="p-4 md:p-6 bg-background font-body print:p-0 printable-content" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-4 bg-card p-0 rounded-lg shadow-lg print:shadow-none print:rounded-none print:border-none print:bg-transparent">
        {branding?.letterhead_image_url && (
          <img src={branding.letterhead_image_url} alt="Letterhead" className="w-full h-auto" />
        )}
        <div className="p-6 md:p-8">
            <header className="flex justify-between items-start pb-4 border-b">
                <div className="w-full">
                    <div className='flex items-center gap-4'>
                        <Logo className="h-16 w-16 !p-3 print:hidden" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                        <div>
                            <h1 className="text-2xl font-bold font-headline print:text-xl">{branding?.company_name ?? 'ملف الموظف الشامل'}</h1>
                            <p className="text-muted-foreground print:text-sm">{branding?.letterhead_text ?? 'Nova ERP'}</p>
                        </div>
                    </div>
                    <div className="text-left text-xs text-muted-foreground mt-4">
                        <p>تاريخ التقرير: {formatDate(reportDate.toISOString())}</p>
                        {currentDate && <p className="print:hidden">تاريخ الطباعة: {formatDate(currentDate)}</p>}
                    </div>
                </div>
            </header>

            <main className="space-y-4 pt-8">
                <Section title="المعلومات الشخصية والأساسية" icon={<User />}>
                    <InfoItem label="الاسم بالعربية" value={employee.fullName} />
                    <InfoItem label="الاسم بالإنجليزية" value={employee.nameEn} />
                    <InfoItem label="الرقم المدني" value={employee.civilId} />
                    <InfoItem label="تاريخ الميلاد" value={formatDate(employee.dob)} />
                    <InfoItem label="النوع" value={employee.gender === 'male' ? 'ذكر' : employee.gender === 'female' ? 'أنثى' : '-'} />
                    <InfoItem label="حالة الموظف" value={<Badge className={statusColors[currentStatus]}>{statusTranslations[currentStatus] ?? 'غير معروف'}</Badge>} />
                </Section>
                
                <Section title="معلومات الاتصال" icon={<Phone />}>
                    <InfoItem label="رقم الجوال" value={employee.mobile} />
                    <InfoItem label="رقم الطوارئ" value={employee.emergencyContact} />
                    <InfoItem label="البريد الإلكتروني" value={employee.email} />
                </Section>
                
                <Section title="البيانات الوظيفية والعقد" icon={<Briefcase />}>
                    <InfoItem label="القسم" value={employee.department} />
                    <InfoItem label="المسمى الوظيفي" value={employee.jobTitle} />
                    <InfoItem label="تاريخ التعيين" value={formatDate(employee.hireDate)} />
                    <InfoItem label="نوع العقد" value={employee.contractType} />
                    {employee.contractType !== 'permanent' && <InfoItem label="انتهاء العقد" value={formatDate(employee.contractExpiry)} />}
                    {employee.nationality !== 'كويتي' && <InfoItem label="انتهاء الإقامة" value={formatDate(employee.residencyExpiry)} />}
                </Section>

                <Section title="البيانات المالية" icon={<Wallet />}>
                    <InfoItem label="الراتب الأساسي" value={formatCurrency(employee.basicSalary || 0)} />
                    <InfoItem label="بدل السكن" value={formatCurrency(employee.housingAllowance || 0)} />
                    <InfoItem label="بدل النقل" value={formatCurrency(employee.transportAllowance || 0)} />
                    <InfoItem label="الإجمالي" value={formatCurrency((employee.basicSalary || 0) + (employee.housingAllowance || 0) + (employee.transportAllowance || 0))} className="font-bold border-t pt-2" />
                </Section>

                {employee.auditLogs && employee.auditLogs.length > 0 && (
                    <div className="border rounded-lg p-4 print:border-none print:p-2 page-break-before">
                        <h3 className="flex items-center gap-2 font-bold text-lg mb-4 text-primary border-b pb-2 print:text-base print:mb-2"><History />السجل الزمني للتغييرات</h3>
                        <div className='space-y-2 max-h-48 overflow-y-auto'>
                            {employee.auditLogs.map((log: any, index: number) => (
                                <div key={log.id || index} className="text-xs p-2 rounded-md bg-muted/50">
                                    <span className="font-semibold text-primary">{formatDate(log.effectiveDate)}</span>: 
                                    تغيير في <span className='font-semibold'>"{log.field}"</span> من <span className='font-mono text-muted-foreground'>{String(log.oldValue ?? '-')}</span> إلى <span className='font-mono'>{String(log.newValue ?? '-')}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                <Section title="حالة الإجازات" icon={<Calendar />}>
                    <div className="md:col-span-2 bg-muted/50 p-3 rounded-md text-center">
                        <p className="text-muted-foreground">رصيد الإجازات السنوية المتاح حتى تاريخ التقرير</p>
                        <p className="text-2xl font-bold text-primary">{(employee.leaveBalance ?? 0).toFixed(0)} يوم</p>
                    </div>
                    {lastLeave && (
                        <div className='md:col-span-2 border-t pt-4'>
                            <p className='font-semibold mb-2'>آخر عودة من إجازة:</p>
                            <InfoItem label="نوع الإجازة" value={typeTranslations[lastLeave.leaveType] || lastLeave.leaveType} />
                            <InfoItem label="تاريخ العودة الفعلي" value={formatDate(lastLeave.actualReturnDate)} />
                            <InfoItem label="عدد الأيام" value={`${lastLeave.workingDays ?? lastLeave.days ?? 0} أيام`} />
                        </div>
                    )}
                </Section>

                <Section title="استحقاق نهاية الخدمة" icon={<Gift />}>
                    <div className="md:col-span-2 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md border border-blue-200 dark:border-blue-800">
                        {serviceDuration && (
                             <InfoItem label="مدة الخدمة حتى تاريخ التقرير" value={`${serviceDuration.years || 0} سنة, ${serviceDuration.months || 0} شهر, ${serviceDuration.days || 0} يوم`} />
                        )}
                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-blue-200 dark:border-blue-700">
                            <span className="text-muted-foreground">قيمة نهاية الخدمة المستحقة:</span>
                            <span className="font-bold text-lg text-blue-600 dark:text-blue-400">{formatCurrency(employee.eosb || 0)}</span>
                        </div>
                    </div>
                </Section>
            </main>
        </div>
      </div>
    </div>
  );
}
```