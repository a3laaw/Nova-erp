'use client';

import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFirebase } from '@/firebase';
import type { Employee } from '@/lib/types';
import { InlineSearchList } from '../ui/inline-search-list';
import { Skeleton } from '../ui/skeleton';
import { useSubscription } from '@/hooks/use-subscription';
import { calculateGratuity } from '@/services/leave-calculator';
import { formatCurrency, cn } from '@/lib/utils';
import { Calculator, Info, AlertTriangle, FileText, Scale, Landmark } from 'lucide-react';
import { Separator } from '../ui/separator';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { DateInput } from '../ui/date-input';

interface GratuityResult {
    gratuity: number;
    leaveBalancePay: number;
    total: number;
    notice: string;
    yearsOfService: number;
    lastSalary: number;
    leaveBalance: number;
    dailyWage: number;
}

export function GratuityCalculatorView() {
  const { firestore } = useFirebase();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [terminationReason, setTerminationReason] = useState<'resignation' | 'termination'>('termination');
  const [asOfDate, setAsOfDate] = useState<Date | undefined>(new Date());
  const [result, setResult] = useState<GratuityResult | null>(null);

  const { data: employees, loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees');

  const employeeOptions = useMemo(() => {
    return (employees || []).map(e => ({ value: e.id!, label: e.fullName, searchKey: e.employeeNumber }));
  }, [employees]);

  const selectedEmployee = useMemo(() => {
    return employees.find(e => e.id === setSelectedEmployeeId ? selectedEmployeeId : null);
  }, [employees, selectedEmployeeId]);

  const handleCalculate = () => {
    const emp = employees.find(e => e.id === selectedEmployeeId);
    if (emp && asOfDate) {
      const calculationResult = calculateGratuity({ ...emp, terminationReason }, asOfDate);
      setResult(calculationResult);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6" dir="rtl">
      <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white">
        <CardHeader className="bg-primary/5 pb-8 border-b">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner">
              <Calculator className="h-8 w-8" />
            </div>
            <div>
              <CardTitle className="text-2xl font-black">حاسبة مكافأة نهاية الخدمة (قانون العمل الكويتي)</CardTitle>
              <CardDescription className="text-base font-medium">تقدير المستحقات المالية القانونية للموظف بناءً على المادتين 51 و 53.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="grid gap-3">
              <Label className="font-black text-gray-700">اختر الموظف للمحاكاة *</Label>
              <InlineSearchList
                value={selectedEmployeeId}
                onSelect={setSelectedEmployeeId}
                options={employeeOptions}
                placeholder={employeesLoading ? "جاري التحميل..." : "ابحث بالاسم أو الرقم الوظيفي..."}
                disabled={employeesLoading}
                className="h-12 rounded-2xl border-2"
              />
            </div>
            <div className="grid gap-3">
              <Label className="font-black text-gray-700">تاريخ انتهاء الخدمة المتوقع</Label>
              <DateInput value={asOfDate} onChange={setAsOfDate} className="h-12" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="grid gap-3">
              <Label className="font-black text-gray-700">سبب ترك العمل (يؤثر على نسبة الاستحقاق)</Label>
              <Select value={terminationReason} onValueChange={(v) => setTerminationReason(v as any)}>
                <SelectTrigger className="h-12 rounded-2xl border-2"><SelectValue /></SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="termination">إنهاء خدمات من طرف الشركة (مكافأة كاملة)</SelectItem>
                  <SelectItem value="resignation">استقالة الموظف (تطبق نسب المادة 53)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
                <Button onClick={handleCalculate} disabled={!selectedEmployeeId} className="w-full h-12 rounded-2xl font-black text-lg gap-2 shadow-lg shadow-primary/20">
                    <Scale className="h-5 w-5" />
                    توليد تقرير المستحقات
                </Button>
            </div>
          </div>

          {result && selectedEmployee && (
            <div className="pt-8 border-t space-y-8 animate-in fade-in zoom-in-95 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-6 bg-muted/30 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center text-center">
                      <Label className="text-[10px] font-black text-muted-foreground uppercase mb-2">مدة الخدمة الفعلية</Label>
                      <p className="text-3xl font-black text-primary font-mono">{result.yearsOfService.toFixed(2)} <span className="text-sm">سنة</span></p>
                  </div>
                  <div className="p-6 bg-muted/30 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center text-center">
                      <Label className="text-[10px] font-black text-muted-foreground uppercase mb-2">الراتب الشامل المعتمد</Label>
                      <p className="text-2xl font-black text-foreground font-mono">{formatCurrency(result.lastSalary)}</p>
                  </div>
                  <div className="p-6 bg-muted/30 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center text-center">
                      <Label className="text-[10px] font-black text-muted-foreground uppercase mb-2">أجر اليوم (على 26 يوم)</Label>
                      <p className="text-2xl font-black text-foreground font-mono">{formatCurrency(result.dailyWage)}</p>
                  </div>
              </div>

              <div className="bg-primary/5 p-8 rounded-[2.5rem] border-2 border-primary/10">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-black text-primary flex items-center gap-2">
                          <Landmark className="h-6 w-6"/> الخلاصة المالية النهائية
                      </h3>
                      <Badge variant="outline" className="bg-white text-primary border-primary/20 font-black h-7 px-4">
                          {terminationReason === 'resignation' ? 'استقالة' : 'إنهاء خدمات'}
                      </Badge>
                  </div>

                  <div className="space-y-4">
                      <div className="flex justify-between items-center p-4 bg-white rounded-2xl border shadow-sm">
                          <span className="font-bold text-gray-600">مكافأة نهاية الخدمة (المادة 51/53):</span>
                          <span className="text-2xl font-black text-primary font-mono">{formatCurrency(result.gratuity)}</span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-white rounded-2xl border shadow-sm">
                          <span className="font-bold text-gray-600">بدل رصيد الإجازات ({result.leaveBalance.toFixed(1)} يوم):</span>
                          <span className="text-2xl font-black text-primary font-mono">{formatCurrency(result.leaveBalancePay)}</span>
                      </div>
                      <Separator className="bg-primary/10 my-4" />
                      <div className="flex justify-between items-center p-6 bg-primary rounded-2xl text-white shadow-xl shadow-primary/20">
                          <span className="text-xl font-black">إجمالي صافي المستحقات:</span>
                          <span className="text-4xl font-black font-mono">{formatCurrency(result.total)}</span>
                      </div>
                  </div>

                  <Alert className="mt-6 bg-white border-2 border-primary/20 rounded-2xl">
                      <Info className="h-5 w-5 text-primary" />
                      <AlertTitle className="font-black text-primary">المستند القانوني</AlertTitle>
                      <AlertDescription className="text-sm font-bold text-slate-700 mt-1">
                          {result.notice}
                      </AlertDescription>
                  </Alert>
              </div>

              <div className="p-6 bg-orange-50 border-2 border-orange-100 rounded-3xl">
                  <div className="flex items-center gap-2 mb-3 text-orange-800 font-black">
                      <AlertTriangle className="h-5 w-5" />
                      <h4>تنبيهات التدقيق:</h4>
                  </div>
                  <ul className="list-disc pr-5 text-xs font-bold text-orange-700 space-y-2 leading-loose">
                      <li>هذه الحسبة تقديرية وتعتمد على دقة تاريخ التعيين والرواتب المسجلة في ملف الموظف.</li>
                      <li>لا تشمل هذه الحسبة أي خصومات إضافية (مثل عهد لم تُسلم أو سلف نقدية قائمة)؛ يجب خصمها يدوياً عند صرف الشيك.</li>
                      <li>يُفترض أن الموظف قد استلم كافة رواتبه الشهرية حتى تاريخ ترك العمل، والمبلغ أعلاه هو "المكافأة" فقط.</li>
                  </ul>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="bg-muted/10 p-6 border-t flex justify-center no-print">
            <p className="text-xs text-muted-foreground font-medium">نظام Nova ERP - محرك الحسابات القانونية الإصدار 2.0</p>
        </CardFooter>
      </Card>
    </div>
  );
}
