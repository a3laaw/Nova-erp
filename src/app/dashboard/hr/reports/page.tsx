
'use client';

import { useState, useMemo } from 'react';
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
import { generateReport, ReportData, ReportType } from '@/services/report-generator';

export default function ReportsPage() {
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();
    
    const [reportType, setReportType] = useState<ReportType>('Comprehensive');
    const [dateFrom, setDateFrom] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [dateTo, setDateTo] = useState<string>(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
    const [asOfDate, setAsOfDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

    const [isGenerating, setIsGenerating] = useState(false);
    const [reportData, setReportData] = useState<ReportData | null>(null);

    const handleGenerateReport = async () => {
        if (!firestore) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'لا يمكن الاتصال بقاعدة البيانات.' });
            return;
        }

        setIsGenerating(true);
        setReportData(null);

        try {
            const options = reportType === 'Comprehensive' ? { asOfDate } : { dateFrom, dateTo };
            const data = await generateReport(firestore, reportType, options);
            
            if (data.rows.length === 0) {
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
    
    const isDateRangeReport = useMemo(() => {
        return ['SalaryChange', 'ResidencyRenewal', 'JobChange'].includes(reportType);
    }, [reportType]);

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
                        <div className="grid gap-2 sm:col-span-2 md:col-span-1">
                            <Label htmlFor="reportType">نوع التقرير</Label>
                             <Select dir="rtl" value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
                                <SelectTrigger id="reportType">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Comprehensive">تقرير الموظفين الشامل</SelectItem>
                                    <SelectItem value="SalaryChange">تغيرات الرواتب</SelectItem>
                                    <SelectItem value="JobChange">التغييرات الوظيفية</SelectItem>
                                    <SelectItem value="ResidencyRenewal">تجديد الإقامات</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        
                        {isDateRangeReport ? (
                            <>
                                <div className="grid gap-2">
                                    <Label htmlFor="dateFrom">من تاريخ</Label>
                                    <Input id="dateFrom" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="dateTo">إلى تاريخ</Label>
                                    <Input id="dateTo" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                                </div>
                            </>
                        ) : (
                            <div className="grid gap-2">
                                <Label htmlFor="asOfDate">تاريخ التقرير</Label>
                                <Input id="asOfDate" type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
                            </div>
                        )}
                       
                        <Button onClick={handleGenerateReport} disabled={isGenerating} className="sm:col-span-2 md:col-span-1">
                            {isGenerating ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Search className="ml-2 h-4 w-4" />}
                            {isGenerating ? 'جاري إنشاء التقرير...' : 'إنشاء التقرير'}
                        </Button>
                    </div>
                </div>

                {reportData ? (
                    <ReportResults reportData={reportData} />
                ) : (
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
