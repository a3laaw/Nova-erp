
'use client';

import { useState, useMemo, useEffect } from 'react';
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
import { Loader2, Search, ArrowRight, FileText } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import { ReportResults } from '@/components/hr/report-results';
import { generateReport, ReportData, ReportType, BulkReportData } from '@/services/report-generator';
import type { Employee } from '@/lib/types';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { EmployeeDossier } from '@/components/hr/employee-dossier';

const REPORT_TYPES: { value: ReportType, label: string }[] = [
    { value: 'EmployeeDossier', label: 'الملف الشامل للموظف' },
    { value: 'EmployeeRoster', label: 'ملخص جميع الموظفين' },
];

export default function ReportsPage() {
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();
    
    const [reportType, setReportType] = useState<ReportType>('EmployeeDossier');
    
    // State for point-in-time reports
    const [asOfDate, setAsOfDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [reportData, setReportData] = useState<ReportData | BulkReportData | null>(null);

    const [employees, setEmployees] = useState<Employee[]>([]);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<'active' | 'all'>('active');

    useEffect(() => {
        if (!firestore) return;
        const fetchEmployees = async () => {
            try {
                const q = query(collection(firestore, 'employees'), where('status', '==', 'active'));
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
                                    <SelectTrigger id="employeeFilter"><SelectValue /></SelectTrigger>
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

                {reportData && !isGenerating && (
                    <>
                        {reportData.type === 'EmployeeDossier' && reportData.employee && (
                           <EmployeeDossier employee={reportData.employee} reportDate={parseISO(asOfDate)} />
                        )}
                        {reportData.type === 'BulkEmployeeDossiers' && (
                            <div className='space-y-8'>
                                <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm print:hidden">
                                   تم إنشاء تقرير جماعي لـ <span className='font-bold'>{reportData.dossiers.length}</span> موظفين. كل تقرير سيظهر في صفحة منفصلة عند الطباعة.
                                </div>
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
                    </>
                )}

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

    