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
import { Loader2, Search, ArrowRight, FileText, Printer } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import { ReportResults } from '@/components/hr/report-results';
import { generateReport, ReportData, ReportType, BulkReportData, StandardReportData } from '@/services/report-generator';
import type { Employee, AuditLog } from '@/lib/types';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { EmployeeDossier } from '@/components/hr/employee-dossier';
import { InlineSearchList } from '@/components/ui/inline-search-list';


const REPORT_TYPES: { value: ReportType; label: string }[] = [
    { value: 'EmployeeDossier', label: 'ملف الموظف الشامل' },
    { value: 'EmployeeRoster', label: 'قائمة الموظفين (Roster)' },
];

const formatValueForHTML = (value: any, type?: 'date' | 'currency' | 'number' | 'component'): string => {    
    if (value === null || value === undefined || value === '') return '-';

    if (type === 'date') {
        try {
            const d = value.toDate ? value.toDate() : new Date(value);
            if (isNaN(d.getTime())) return String(value) || '-';
            return new Intl.DateTimeFormat('ar-KW', { day: '2-digit', month: '2-digit', year: 'numeric', numberingSystem: 'latn' }).format(d);
        } catch (e) {
            return String(value) || '-';
        }
    }
    if (type === 'currency') {
        const amount = Number(value) || 0;
         return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'KWD', numberingSystem: 'latn' }).format(amount);
    }
    
    return String(value);
};


const generateReportHTML = (reportData: StandardReportData): string => {
  const headers = reportData.headers.map(h => `<th style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${h.label}</th>`).join('');
  const rows = reportData.rows.map(row => {
    const cells = reportData.headers.map(header => {
      const cellValue = formatValueForHTML(row[header.key], header.type);
      return `<td style="padding: 8px; border-bottom: 1px solid #eee;">${cellValue}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');
  
  const footer = reportData.footer ? `
    <tr>
        <td colspan="${reportData.footer.colSpan}" style="padding: 8px; font-weight: bold;">${reportData.footer.label}</td>
        <td colspan="${reportData.headers.length - reportData.footer.colSpan}" style="padding: 8px; font-weight: bold; text-align: left;">${formatValueForHTML(reportData.footer.value, reportData.footer.type)}</td>
    </tr>
  ` : '';

  return `
    <div dir="rtl" style="font-family: 'Tajawal', sans-serif; padding: 20px;">
        <h2 style="font-size: 24px; font-weight: bold;">${reportData.title}</h2>
        <p style="color: #666; font-size: 14px;">${reportData.subtitle}</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <thead>
                <tr>${headers}</tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
            <tfoot>
                ${footer}
            </tfoot>
        </table>
    </div>
  `;
};


export default function ReportsPage() {
    const firestore = useFirebase();
    const router = useRouter();
    const { toast } = useToast();
    
    const [reportType, setReportType] = useState<ReportType>('EmployeeDossier');
    const [asOfDate, setAsOfDate] = useState<string>('');
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [reportData, setReportData] = useState<ReportData | null>(null);

    const [employees, setEmployees] = useState<Employee[]>([]);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<'active' | 'all'>('active');
    
    useEffect(() => {
        // Set date on client-side to prevent hydration mismatch
        setAsOfDate(format(new Date(), 'yyyy-MM-dd'));
    }, []);

    useEffect(() => {
        if (!firestore) return;
        const fetchEmployees = async () => {
            try {
                const q = query(collection(firestore, 'employees'));
                const querySnapshot = await getDocs(q);
                const fetchedEmployees: Employee[] = [];
                querySnapshot.forEach(doc => {
                    if (doc.exists() && doc.data()) {
                        fetchedEmployees.push({ id: doc.id, ...doc.data() } as Employee);
                    }
                });
                
                const sortedEmployees = fetchedEmployees.sort((a,b) => (a.fullName || '').localeCompare(b.fullName || '', 'ar'));
                setEmployees(sortedEmployees);
                
                 if (sortedEmployees.length > 0) {
                   setSelectedEmployeeId(sortedEmployees[0].id!);
                }
            } catch (error) {
                console.error("Error fetching employees for HR reports:", error);
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب قائمة الموظفين.' });
            }
        };
        fetchEmployees();
    }, [firestore, toast]);
    
    const employeeOptions = useMemo(() => [
        { value: 'all', label: 'جميع الموظفين (تقرير جماعي)' },
        ...employees
            .filter(emp => emp?.id && emp?.fullName)
            .map(emp => ({
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
        
        if (reportData.type === 'EmployeeDossier' && reportData.employee.id) {
             const printUrl = `/dashboard/hr/employees/${reportData.employee.id}/report`;
             window.open(printUrl, '_blank', 'noopener,noreferrer');
             return;
        }

        if (reportData.type === 'EmployeeRoster') {
            import('html2pdf.js').then(module => {
                const html2pdf = module.default;
                const htmlContent = generateReportHTML(reportData as StandardReportData);
                const element = document.createElement('div');
                element.innerHTML = htmlContent;
                html2pdf().from(element).set({
                    margin:       1,
                    filename:     `${(reportData as StandardReportData).title}.pdf`,
                    image:        { type: 'jpeg', quality: 0.98 },
                    html2canvas:  { scale: 2, useCORS: true },
                    jsPDF:        { unit: 'in', format: 'a4', orientation: 'landscape' }
                }).save();
            });
        }
        
        if(reportData.type === 'BulkEmployeeDossiers') {
            toast({ title: "غير متاح", description: "طباعة التقارير الجماعية غير متاحة حالياً بهذه الطريقة." });
        }
    };

    const isPrintable = reportData && (reportData.type === 'EmployeeDossier' || reportData.type === 'EmployeeRoster');


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
