'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Calculator, Loader2, FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generatePayslipsForMonth } from '@/services/payroll-processor';
import type { Payslip } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import * as XLSX from 'xlsx';

const generateYears = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = currentYear; i >= currentYear - 5; i--) {
    years.push(i);
  }
  return years;
};

const months = Array.from({ length: 12 }, (_, i) => i + 1);

export function PayrollGenerator() {
  const { toast } = useToast();
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const years = generateYears();
  
  const handleGenerate = async () => {
    setIsGenerating(true);
    setPayslips([]);
    try {
        const result = await generatePayslipsForMonth(year, month);
        setPayslips(result);
         toast({
            title: 'تم إنشاء كشوف الرواتب',
            description: `تم إنشاء ${result.length} كشف راتب بنجاح.`
        });
    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : 'حدث خطأ غير متوقع.';
        toast({ variant: 'destructive', title: 'فشل إنشاء الرواتب', description: errorMessage });
    } finally {
        setIsGenerating(false);
    }
  }

  const handleExportPDF = () => {
     const element = document.getElementById('payslips-table');
     import('html2pdf.js').then(module => {
        const html2pdf = module.default;
        const opt = {
            margin:       0.5,
            filename:     `payslips_${year}-${month}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2 },
            jsPDF:        { unit: 'in', format: 'a4', orientation: 'landscape' }
        };
        html2pdf().from(element).set(opt).save();
     });
  };

  const handleExportExcel = () => {
    const data = payslips.map(p => ({
        'اسم الموظف': p.employeeName,
        'الراتب الأساسي': p.earnings.basicSalary,
        'بدل السكن': p.earnings.housingAllowance || 0,
        'بدل النقل': p.earnings.transportAllowance || 0,
        'خصم الغياب': p.deductions.absenceDeduction,
        'خصومات أخرى': p.deductions.otherDeductions,
        'صافي الراتب': p.netSalary,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Payslips ${year}-${month}`);
    XLSX.writeFile(wb, `payslips_${year}-${month}.xlsx`);
  };

  const totalNetSalary = payslips.reduce((acc, p) => acc + p.netSalary, 0);

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
                    <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="month">الشهر</Label>
                    <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {months.map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                 <Button onClick={handleGenerate} disabled={isGenerating} className="w-full sm:w-auto">
                    {isGenerating ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Calculator className="ml-2 h-4 w-4" />}
                    {isGenerating ? 'جاري الإنشاء...' : 'إنشاء كشوف الرواتب'}
                </Button>
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
                            <TableHead>الراتب الأساسي</TableHead>
                            <TableHead>البدلات</TableHead>
                            <TableHead>خصم الغياب</TableHead>
                            <TableHead>صافي الراتب</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {payslips.map(p => (
                            <TableRow key={p.id}>
                                <TableCell className="font-medium">{p.employeeName}</TableCell>
                                <TableCell>{formatCurrency(p.earnings.basicSalary)}</TableCell>
                                <TableCell>{formatCurrency((p.earnings.housingAllowance || 0) + (p.earnings.transportAllowance || 0))}</TableCell>
                                <TableCell className='text-destructive'>{formatCurrency(p.deductions.absenceDeduction)}</TableCell>
                                <TableCell className="font-bold">{formatCurrency(p.netSalary)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    <TableFooter>
                        <TableRow>
                            <TableCell colSpan={4} className="font-bold text-lg">إجمالي صافي الرواتب</TableCell>
                            <TableCell className="font-bold text-lg">{formatCurrency(totalNetSalary)}</TableCell>
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
