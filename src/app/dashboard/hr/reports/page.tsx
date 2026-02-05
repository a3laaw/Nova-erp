
'use client';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Loader2, Search } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { generateReport, type ReportType } from '@/services/report-generator';
import { EmployeeDossier } from '@/components/hr/employee-dossier';
import type { Employee } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { InlineSearchList } from '@/components/ui/inline-search-list';

export default function HrReportsPage() {
    const { firestore } = useFirebase();
    const { toast } = useToast();

    const [reportType, setReportType] = useState<ReportType | ''>('EmployeeDossier');
    const [employeeId, setEmployeeId] = useState('all');
    const [asOfDate, setAsOfDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loadingEmployees, setLoadingEmployees] = useState(false);
    
    const [loadingReport, setLoadingReport] = useState(false);
    const [reportData, setReportData] = useState<any>(null);

    // Fetch employees for the dropdown
    useState(() => {
        if(!firestore) return;
        const fetchEmps = async () => {
            setLoadingEmployees(true);
            try {
                const { getDocs, collection, query } = await import('firebase/firestore');
                const q = query(collection(firestore, 'employees'));
                const snap = await getDocs(q);
                setEmployees(snap.docs.map(d => ({id: d.id, ...d.data()} as Employee)));
            } catch (e) {
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل جلب قائمة الموظفين.'});
            } finally {
                setLoadingEmployees(false);
            }
        };
        fetchEmps();
    });

    const employeeOptions = [
        { value: 'all', label: 'جميع الموظفين النشطين' },
        ...employees.map(e => ({ value: e.id!, label: e.fullName }))
    ];

    const handleGenerateReport = async () => {
        if (!firestore || !reportType) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء اختيار نوع التقرير.'});
            return;
        }
        setLoadingReport(true);
        setReportData(null);
        try {
            const data = await generateReport(firestore, reportType, { employeeId, asOfDate });
            setReportData(data);
        } catch (error: any) {
            console.error("UI error generating report:", error);
            toast({ variant: 'destructive', title: 'خطأ في إنشاء التقرير', description: error.message });
        } finally {
            setLoadingReport(false);
        }
    };
    
    const handlePrint = () => {
        const printable = document.getElementById('dossier-content');
        if (printable) {
             const newWindow = window.open('', '_blank');
             newWindow?.document.write('<html><head><title>طباعة ملف الموظف</title>');
             // You need to link your stylesheet here
             newWindow?.document.write('<link rel="stylesheet" href="/globals.css" type="text/css" />');
             newWindow?.document.write('<style>@media print { @page { size: A4 portrait; margin: 1.5cm; } body { -webkit-print-color-adjust: exact; } }</style>');
             newWindow?.document.write('</head><body dir="rtl">');
             newWindow?.document.write(printable.innerHTML);
             newWindow?.document.write('</body></html>');
             newWindow?.document.close();
             setTimeout(() => newWindow?.print(), 500); // Wait for styles to load
        }
    };

    return (
        <div className="space-y-6" dir="rtl">
            <Card>
                <CardHeader>
                    <CardTitle>مولد التقارير الشاملة</CardTitle>
                    <CardDescription>
                        إنشاء تقارير مفصلة عن الموظفين والبيانات الأخرى كما في تاريخ محدد.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="grid gap-2">
                        <Label htmlFor="reportType">نوع التقرير</Label>
                        <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
                            <SelectTrigger id="reportType"><SelectValue placeholder="اختر..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="EmployeeDossier">ملف الموظف (Dossier)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="employeeId">الموظف</Label>
                        <InlineSearchList
                            value={employeeId}
                            onSelect={setEmployeeId}
                            options={employeeOptions}
                            placeholder="اختر موظفًا..."
                            disabled={loadingEmployees}
                        />
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="asOfDate">البيانات كما في تاريخ</Label>
                        <Input id="asOfDate" type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} />
                    </div>
                     <Button onClick={handleGenerateReport} disabled={loadingReport || !reportType}>
                        {loadingReport && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                        إنشاء التقرير
                    </Button>
                </CardContent>
            </Card>

            {loadingReport && (
                <div className="text-center py-12">
                    <Loader2 className="mx-auto h-12 w-12 text-primary animate-spin" />
                    <p className="mt-4 text-muted-foreground">جاري إنشاء التقرير...</p>
                </div>
            )}

            {reportData && (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                         <div>
                            <CardTitle>نتائج التقرير</CardTitle>
                         </div>
                         <Button onClick={handlePrint} variant="outline">طباعة</Button>
                    </CardHeader>
                    <CardContent>
                        {reportData.type === 'EmployeeDossier' && (
                             <EmployeeDossier employee={reportData.employee} asOfDate={new Date(asOfDate)} />
                        )}
                         {reportData.type === 'BulkEmployeeDossiers' && (
                            <div className="space-y-4">
                                {reportData.dossiers.map((emp: any) => (
                                    <EmployeeDossier key={emp.id} employee={emp} asOfDate={new Date(asOfDate)} />
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

    