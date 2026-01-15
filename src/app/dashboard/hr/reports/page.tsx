
'use client';

import { useState, useEffect } from 'react';
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
import { Loader2, Search, ArrowRight, FileText, Printer } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import { ReportResults } from '@/components/hr/report-results';
import { generateReport, ReportData, ReportType, BulkReportData, StandardReportData } from '@/services/report-generator';
import type { Employee, AuditLog } from '@/lib/types';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { EmployeeDossier } from '@/components/hr/employee-dossier';
import html2pdf from 'html2pdf.js';
import { fromFirestoreDate } from '@/services/date-converter';
import { formatCurrency } from '@/lib/utils';

const REPORT_TYPES: { value: ReportType; label: string }[] = [
    { value: 'EmployeeDossier', label: 'ملف الموظف الشامل' },
    { value: 'EmployeeRoster', label: 'قائمة الموظفين (Roster)' },
];


// --- STATIC HTML GENERATOR HELPER FUNCTIONS ---
// This function is now located here to avoid server-action conflicts.
function generateReportHTML(employee: Employee, reportDate: Date): string {
    const renderInfoItem = (label: string, value: string | number | null | undefined): string => {
        if (value === null || value === undefined || value === '') return '';
        return `<div style="display: flex; justify-content: space-between; padding: 4px 0;">
                    <span style="color: #64748b;">${label}:</span>
                    <span style="font-weight: 600;">${value}</span>
                </div>`;
    };

    const renderSection = (title: string, content: string): string => {
        return `<div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                    <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 1rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">${title}</h3>
                    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 32px;">
                        ${content}
                    </div>
                </div>`;
    }

    const renderInfoV2 = (label: string, value: string | null | undefined): string => {
    if (value === null || value === undefined || value === '') return '';
    return `<div style="display: flex; justify-content: space-between; padding: 4px 0;">
                <span style="color: #64748b;">${label}:</span>
                <span style="font-weight: 600;">${value}</span>
            </div>`;
    };

  const {
    fullName, civilId, nameEn, dob, gender, mobile, emergencyContact, email,
    department, jobTitle, position, hireDate, contractType, contractExpiry, visaType, residencyExpiry,
    basicSalary = 0, housingAllowance = 0, transportAllowance = 0,
    salaryPaymentType, bankName, iban, status,
    auditLogs, eosb, leaveBalance, lastLeave, serviceDuration
  } = employee;

  const totalSalary = basicSalary + housingAllowance + transportAllowance;

  let personalInfo = renderInfoItem('الاسم بالعربية', fullName) +
                     renderInfoItem('الاسم بالإنجليزية', nameEn) +
                     renderInfoItem('الرقم المدني', civilId) +
                     renderInfoV2('تاريخ الميلاد', fromFirestoreDate(dob)) +
                     renderInfoItem('النوع', gender === 'male' ? 'ذكر' : 'أنثى') +
                     renderInfoItem('حالة الموظف', status);

  let contactInfo = renderInfoItem('رقم الجوال', mobile) +
                    renderInfoItem('رقم الطوارئ', emergencyContact) +
                    `<div style="grid-column: span 2 / span 2;">${renderInfoItem('البريد الإلكتروني', email)}</div>`;

  let jobInfo = renderInfoItem('القسم', department) +
                renderInfoItem('المسمى الوظيفي', jobTitle) +
                renderInfoItem('المنصب', position) +
                renderInfoV2('تاريخ التعيين', fromFirestoreDate(hireDate)) +
                renderInfoItem('نوع العقد', contractType) +
                renderInfoV2('تاريخ انتهاء العقد', fromFirestoreDate(contractExpiry)) +
                renderInfoItem('نوع الإقامة', visaType) +
                renderInfoV2('تاريخ انتهاء الإقامة', fromFirestoreDate(residencyExpiry));

  let financialInfo = renderInfoItem('الراتب الأساسي', formatCurrency(basicSalary)) +
                      renderInfoItem('بدل السكن', formatCurrency(housingAllowance)) +
                      renderInfoItem('بدل النقل', formatCurrency(transportAllowance)) +
                      `<hr style="grid-column: span 2 / span 2; margin: 8px 0; border-color: #e2e8f0;">` +
                      `<div style="grid-column: span 2 / span 2; font-weight: bold;">${renderInfoItem('إجمالي الراتب', formatCurrency(totalSalary))}</div>` +
                      `<hr style="grid-column: span 2 / span 2; margin: 8px 0; border-color: #e2e8f0;">` +
                      renderInfoItem('طريقة دفع الراتب', salaryPaymentType) +
                      renderInfoItem('اسم البنك', bankName) +
                      `<div style="grid-column: span 2 / span 2;">${renderInfoItem('IBAN', iban)}</div>`;

  let leaveInfo = `<div style="grid-column: span 2 / span 2; background-color: #f8fafc; padding: 12px; border-radius: 8px; text-align: center;">
                        <p style="color: #64748b;">رصيد الإجازات السنوية المتاح</p>
                        <p style="font-size: 1.5rem; font-weight: 700; color: #4FC3F7;">${leaveBalance?.toFixed(0) ?? 0} يوم</p>
                   </div>` +
                   (lastLeave ? 
                    `<div style="grid-column: span 2 / span 2; border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 12px;">
                        <p style="font-weight: 600; margin-bottom: 8px;">آخر عودة من إجازة:</p>
                        ${renderInfoItem('نوع الإجازة', (lastLeave as any).leaveType)}
                        ${renderInfoV2('تاريخ العودة الفعلي', fromFirestoreDate((lastLeave as any).actualReturnDate))}
                    </div>` : '');

    let eosbInfo = `<div style="grid-column: span 2 / span 2; background-color: #eff6ff; padding: 16px; border-radius: 8px; border: 1px solid #bfdbfe;">
                        ${serviceDuration ? renderInfoItem('مدة الخدمة', `${serviceDuration.years || 0} سنة, ${serviceDuration.months || 0} شهر, ${serviceDuration.days || 0} يوم`) : ''}
                        <hr style="margin: 8px 0; border-color: #bfdbfe;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                            <span style="color: #64748b;">قيمة نهاية الخدمة المستحقة:</span>
                            <span style="font-weight: bold; font-size: 1.125rem; color: #2563eb;">${formatCurrency(eosb || 0)}</span>
                        </div>
                   </div>
                   <p style="grid-column: span 2 / span 2; font-size: 0.75rem; color: #64748b;">* تم الحساب وفقًا للمادة 44 من قانون العمل الكويتي. هذا تقدير تقريبي.</p>`;

    const logsHTML = auditLogs && auditLogs.length > 0 ?
        renderSection('السجل الزمني للتغييرات',
            `<div style="grid-column: span 2 / span 2;">${auditLogs.map(log =>
                `<div style="font-size: 0.75rem; padding: 8px; border-radius: 4px; background-color: #f8fafc; margin-bottom: 4px;">
                    <span style="font-weight: 600; color: #4FC3F7;">${fromFirestoreDate(log.effectiveDate)}</span>: 
                    تغيير في <b>"${log.field}"</b> من <span style="font-family: monospace;">${log.oldValue ?? '-'}</span> إلى <span style="font-family: monospace;">${log.newValue ?? '-'}</span>
                </div>`
            ).join('')}</div>`
        ) : '';


  return `
    <div dir="rtl" style="font-family: 'Tajawal', sans-serif; padding: 24px; background-color: white;">
        <header style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0;">
            <div>
                <h1 style="font-size: 1.5rem; font-weight: 700;">ملف الموظف الشامل</h1>
                <p style="color: #64748b;">EmaratiScope Engineering</p>
            </div>
            <div style="text-align: left; font-size: 0.75rem; color: #64748b;">
                <p>تاريخ التقرير: ${format(reportDate, 'dd/MM/yyyy')}</p>
            </div>
        </header>
        <main style="margin-top: 24px; display: flex; flex-direction: column; gap: 16px;">
            ${renderSection("المعلومات الشخصية والأساسية", personalInfo)}
            ${renderSection("معلومات الاتصال", contactInfo)}
            ${renderSection("البيانات الوظيفية والعقد", jobInfo)}
            ${renderSection("البيانات المالية", financialInfo)}
            ${logsHTML}
            ${renderSection("حالة الإجازات", leaveInfo)}
            ${renderSection("استحقاق نهاية الخدمة", eosbInfo)}
        </main>
        <footer style="text-align: center; padding-top: 16px; margin-top: 16px; border-top: 1px solid #e2e8f0;">
            <p style="font-size: 0.75rem; color: #64748b;">هذا التقرير تم إنشاؤه بواسطة نظام EmaratiScope. © ${new Date().getFullYear()}</p>
        </footer>
    </div>
  `;
}


export default function ReportsPage() {
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();
    
    const [reportType, setReportType] = useState<ReportType>('EmployeeDossier');
    const [asOfDate, setAsOfDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [reportData, setReportData] = useState<ReportData | null>(null);

    const [employees, setEmployees] = useState<Employee[]>([]);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<'active' | 'all'>('active');

    useEffect(() => {
        if (!firestore) return;
        const fetchEmployees = async () => {
            try {
                // Fetch all employees regardless of status to allow selection in dossier
                const q = query(collection(firestore, 'employees'));
                const querySnapshot = await getDocs(q);
                const fetchedEmployees: Employee[] = [];
                querySnapshot.forEach(doc => {
                    fetchedEmployees.push({ id: doc.id, ...doc.data() } as Employee);
                });
                setEmployees(fetchedEmployees.sort((a,b) => a.fullName.localeCompare(b.fullName)));
            } catch (error) {
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب قائمة الموظفين.' });
            }
        };
        fetchEmployees();
    }, [firestore, toast]);

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
        
        const options = {
            asOfDate,
            employeeId: selectedEmployeeId,
            statusFilter: statusFilter
        };

        try {
            const data = await generateReport(firestore, reportType, options);
            
            if (('rows' in data && data.rows.length === 0) || ('dossiers' in data && data.dossiers.length === 0)) {
                 toast({ title: 'لا توجد بيانات', description: 'لم يتم العثور على نتائج تطابق معايير البحث المحددة.' });
            }
            setReportData(data);
        } catch (error) {
            console.error("Error generating report: ", error);
            const errorMessage = error instanceof Error ? error.message : 'حدث خطأ غير متوقع.';
            toast({ variant: 'destructive', title: 'فشل إنشاء التقرير', description: errorMessage });
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handlePrint = () => {
        if (!reportData) return;

        const date = parseISO(asOfDate);
        let htmlContent = '';
        let filename = `report_${format(date, 'yyyy-MM-dd')}.pdf`;
        
        if (reportData.type === 'EmployeeDossier' && reportData.employee) {
            htmlContent = generateReportHTML(reportData.employee, date);
            filename = `dossier_${reportData.employee.fullName?.replace(' ','_')}_${format(date, 'yyyy-MM-dd')}.pdf`
        } else if (reportData.type === 'BulkEmployeeDossiers') {
            htmlContent = reportData.dossiers.map(emp => generateReportHTML(emp, date)).join('<div class="html2pdf__page-break"></div>');
            filename = `bulk_dossiers_${format(date, 'yyyy-MM-dd')}.pdf`;
        } else {
            // Fallback for standard reports - print the visible table
            const reportElement = document.getElementById('report-content-to-print');
            if (reportElement) {
                 html2pdf().from(reportElement).set({ filename, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { orientation: 'portrait' } }).save();
            }
            return;
        }

        html2pdf().from(htmlContent).set({ filename, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }, margin: 0.5 }).save();
    };

    const isPrintable = reportData && (reportData.type === 'EmployeeDossier' || reportData.type === 'BulkEmployeeDossiers' || reportData.type === 'EmployeeRoster');


  return (
    <div className='space-y-6'>
         <Button variant="outline" onClick={() => router.push('/dashboard/hr')} className="print:hidden">
            <ArrowRight className="ml-2 h-4 w-4" />
            العودة إلى الموارد البشرية
        </Button>
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
                                <Select dir="rtl" value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                                    <SelectTrigger id="employeeFilter"><SelectValue placeholder="اختر..." /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">جميع الموظفين (تقرير جماعي)</SelectItem>
                                        {employees.map(emp => (
                                            <SelectItem key={emp.id} value={emp.id!}>{emp.fullName}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
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
                

                {!reportData && !isGenerating && (
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

    

    