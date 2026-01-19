'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Calculator, Loader2, FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Employee, Payslip } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, doc, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { Checkbox } from '@/components/ui/checkbox';


const generateYears = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = currentYear; i >= currentYear - 5; i--) {
    years.push(i);
  }
  return years;
};

const months = Array.from({ length: 12 }, (_, i) => i + 1);

const paymentTypeTranslations: Record<string, string> = {
    cash: 'كاش',
    cheque: 'شيك',
    transfer: 'تحويل بنكي'
};

export function PayrollGenerator() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [year, setYear] = useState<number | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [applyDeductions, setApplyDeductions] = useState(true);
  const years = generateYears();

  useEffect(() => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
  }, []);
  
  const handleGenerate = async () => {
    if (!year || !month) {
        toast({
            variant: 'destructive',
            title: 'الرجاء الانتظار',
            description: 'جاري تحميل بيانات التاريخ. حاول مرة أخرى بعد لحظات.'
        });
        return;
    }
    if (!firestore) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'لا يمكن الاتصال بقاعدة البيانات.' });
      return;
    }
    setIsGenerating(true);
    setPayslips([]);
    try {
        const employeesRef = collection(firestore, 'employees');
        const q = query(employeesRef, where('status', 'in', ['active', 'on-leave']));
        const employeesSnapshot = await getDocs(q);

        if (employeesSnapshot.empty) {
            throw new Error('لم يتم العثور على موظفين نشطين أو في إجازة لإنشاء كشوف رواتب لهم.');
        }

        const generatedPayslips: Payslip[] = [];
        const batch = writeBatch(firestore);

        for (const empDoc of employeesSnapshot.docs) {
            const employee = { id: empDoc.id, ...empDoc.data() } as Employee;
            
            let absenceDeduction = 0;
            const attendanceId = `${year}-${String(month).padStart(2, '0')}-${employee.id}`;
            
            if (applyDeductions) {
                const attendanceRef = doc(firestore, 'attendance', attendanceId);
                const attendanceSnap = await getDoc(attendanceRef);

                if (attendanceSnap.exists()) {
                    const attendanceData = attendanceSnap.data();
                    const absentDays = attendanceData?.summary?.absentDays || 0;
                    
                    if (absentDays > 0 && employee.basicSalary > 0) {
                        const dailyRate = employee.basicSalary / 30;
                        absenceDeduction = dailyRate * absentDays;
                    }
                }
            }
            
            const earnings = {
                basicSalary: employee.basicSalary || 0,
                housingAllowance: employee.housingAllowance || 0,
                transportAllowance: employee.transportAllowance || 0,
            };
            
            const totalEarnings = earnings.basicSalary + (earnings.housingAllowance || 0) + (earnings.transportAllowance || 0);
            const totalDeductions = absenceDeduction;
            const netSalary = totalEarnings - totalDeductions;
            
            const payslipId = `${year}-${String(month).padStart(2, '0')}-${employee.id}`;
            
            const newPayslipForDb: Omit<Payslip, 'id' | 'createdAt'> & { createdAt: any } = {
                employeeId: employee.id!,
                employeeName: employee.fullName,
                year: year,
                month: month,
                attendanceId: attendanceId,
                salaryPaymentType: employee.salaryPaymentType,
                earnings: earnings,
                deductions: {
                    absenceDeduction: absenceDeduction,
                    otherDeductions: 0,
                },
                netSalary: netSalary,
                status: 'draft',
                createdAt: serverTimestamp(),
            };
            
            const payslipRef = doc(firestore, 'payroll', payslipId);
            batch.set(payslipRef, newPayslipForDb);
            
            const payslipForClient: Payslip = {
                id: payslipId,
                ...newPayslipForDb,
                createdAt: new Date(),
            };
            generatedPayslips.push(payslipForClient);
        }
        
        await batch.commit();
        setPayslips(generatedPayslips);
         toast({
            title: 'تم إنشاء كشوف الرواتب',
            description: `تم إنشاء ${generatedPayslips.length} كشف راتب بنجاح.`
        });
    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : 'حدث خطأ غير متوقع.';
        toast({ variant: 'destructive', title: 'فشل إنشاء الرواتب', description: errorMessage });
    } finally {
        setIsGenerating(false);
    }
  }

  const totalNetSalary = payslips.reduce((acc, p) => acc + p.netSalary, 0);

  const handleExportPDF = () => {
    if (!payslips.length || !year || !month) return;

    const tableRows = payslips.map(p => {
      const totalEarnings = (p.earnings.basicSalary || 0) + (p.earnings.housingAllowance || 0) + (p.earnings.transportAllowance || 0);
      return `
      <tr>
        <td>${p.employeeName}</td>
        <td class="currency">${formatCurrency(p.earnings.basicSalary)}</td>
        <td class="currency">${formatCurrency(p.earnings.housingAllowance || 0)}</td>
        <td class="currency">${formatCurrency(p.earnings.transportAllowance || 0)}</td>
        <td class="currency" style="font-weight: bold;">${formatCurrency(totalEarnings)}</td>
        <td class="currency" style="color: #c00;">${formatCurrency(p.deductions.absenceDeduction)}</td>
        <td class="currency" style="font-weight: bold;">${formatCurrency(p.netSalary)}</td>
        <td>${p.salaryPaymentType ? paymentTypeTranslations[p.salaryPaymentType] : '-'}</td>
      </tr>
    `}).join('');

    const totalRow = `
      <tr class="total-row">
        <td colspan="6">الإجمالي</td>
        <td class="currency" style="font-weight: bold;">${formatCurrency(totalNetSalary)}</td>
        <td></td>
      </tr>
    `;

    const htmlContent = `
      <html>
        <head>
          <meta charset="UTF-8">
          <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap" rel="stylesheet">
          <style>
            body { 
              font-family: 'Tajawal', sans-serif; 
              direction: rtl; 
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              font-size: 10pt; 
              margin-top: 20px; 
            }
            th, td { 
              border: 1px solid #ddd; 
              padding: 8px; 
              text-align: right; 
            }
            th { 
              background-color: #f4f4f4; 
              font-weight: bold; 
            }
            .header { 
              text-align: center; 
              margin-bottom: 20px; 
            }
            .title { 
              font-size: 18pt; 
              font-weight: bold; 
            }
            .subtitle { 
              font-size: 14pt; 
              color: #555; 
            }
            .total-row td { 
              font-weight: bold; 
              font-size: 11pt; 
              background-color: #f4f4f4; 
            }
            .currency { 
              font-family: 'Courier New', Courier, monospace; 
              text-align: left; 
              direction: ltr; 
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">Dar Belaih Al-Mesfir Engineering Consultants</div>
            <div class="subtitle">كشف رواتب شهر ${month}/${year}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>اسم الموظف</th>
                <th>الراتب الأساسي</th>
                <th>بدل السكن</th>
                <th>بدل النقل</th>
                <th>إجمالي الراتب</th>
                <th>خصم الغياب</th>
                <th>صافي الراتب</th>
                <th>طريقة الدفع</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
            <tfoot>
              ${totalRow}
            </tfoot>
          </table>
        </body>
      </html>
    `;

    import('html2pdf.js').then(module => {
        const html2pdf = module.default;
        const opt = {
            margin:       0.5,
            filename:     `payslips_${year}-${month}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, logging: false },
            jsPDF:        { unit: 'in', format: 'a4', orientation: 'landscape' }
        };
        html2pdf().from(htmlContent).set(opt).save();
    });
  };

  const handleExportExcel = async () => {
    const XLSX = await import('xlsx');
    const data = payslips.map(p => ({
        'اسم الموظف': p.employeeName,
        'الراتب الأساسي': p.earnings.basicSalary,
        'بدل السكن': p.earnings.housingAllowance || 0,
        'بدل النقل': p.earnings.transportAllowance || 0,
        'خصم الغياب': p.deductions.absenceDeduction,
        'خصومات أخرى': p.deductions.otherDeductions,
        'صافي الراتب': p.netSalary,
        'طريقة الدفع': p.salaryPaymentType ? paymentTypeTranslations[p.salaryPaymentType] : 'غير محدد',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Payslips ${year}-${month}`);
    XLSX.writeFile(wb, `payslips_${year}-${month}.xlsx`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>إنشاء كشوف الرواتب</CardTitle>
        <CardDescription>
          اختر الشهر والسنة لإنشاء كشوف الرواتب لجميع الموظفين تلقائيًا.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-muted/50 p-4 rounded-lg">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <div className="grid gap-2">
                    <Label htmlFor="year">السنة</Label>
                    <Select value={year ? String(year) : ''} onValueChange={(v) => setYear(Number(v))} disabled={!year}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="month">الشهر</Label>
                    <Select value={month ? String(month) : ''} onValueChange={(v) => setMonth(Number(v))} disabled={!month}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {months.map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                 <Button onClick={handleGenerate} disabled={isGenerating || !year || !month} className="w-full sm:w-auto">
                    {isGenerating ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Calculator className="ml-2 h-4 w-4" />}
                    {isGenerating ? 'جاري الإنشاء...' : 'إنشاء كشوف الرواتب'}
                </Button>
            </div>
            <div className="flex items-center space-x-2 mt-4" dir="rtl">
                <Checkbox id="applyDeductions" checked={applyDeductions} onCheckedChange={(checked) => setApplyDeductions(checked as boolean)} />
                <Label htmlFor="applyDeductions" className="cursor-pointer">
                    تطبيق خصم الغياب حسب سجل الحضور
                </Label>
            </div>
        </div>

        {payslips.length > 0 && (
          <div id="payslips-table">
            <div className='flex justify-between items-center mb-4'>
                <h3 className="font-semibold">كشوف رواتب شهر {month}/{year}</h3>
                <div className='flex gap-2'>
                    <Button variant="outline" size="sm" onClick={handleExportPDF}><FileDown className="ml-2 h-4 w-4" /> PDF</Button>
                    <Button variant="outline" size="sm" onClick={handleExportExcel}><FileDown className="ml-2 h-4 w-4" /> Excel</Button>
                </div>
            </div>
            <div className="border rounded-lg">
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>اسم الموظف</TableHead>
                            <TableHead>تفاصيل الراتب</TableHead>
                            <TableHead>الخصومات</TableHead>
                            <TableHead className="font-bold">صافي الراتب</TableHead>
                            <TableHead>طريقة الدفع</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {payslips.map(p => (
                            <TableRow key={p.id}>
                                <TableCell className="font-medium">{p.employeeName}</TableCell>
                                <TableCell>
                                    <div className="grid gap-0.5">
                                        <div className="font-mono text-sm">{formatCurrency(p.earnings.basicSalary)} <span className="text-xs text-muted-foreground">(أساسي)</span></div>
                                        <div className="font-mono text-xs text-muted-foreground">{formatCurrency((p.earnings.housingAllowance || 0) + (p.earnings.transportAllowance || 0))} <span className="text-xs">(بدلات)</span></div>
                                    </div>
                                </TableCell>
                                <TableCell className='text-destructive font-mono'>{formatCurrency(p.deductions.absenceDeduction)}</TableCell>
                                <TableCell className="font-bold font-mono">{formatCurrency(p.netSalary)}</TableCell>
                                <TableCell>{p.salaryPaymentType ? paymentTypeTranslations[p.salaryPaymentType] : '-'}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    <TableFooter>
                        <TableRow>
                            <TableCell colSpan={3} className="font-bold text-lg">إجمالي صافي الرواتب</TableCell>
                            <TableCell className="font-bold text-lg font-mono">{formatCurrency(totalNetSalary)}</TableCell>
                            <TableCell />
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
