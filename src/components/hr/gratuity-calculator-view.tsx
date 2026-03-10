'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { useSubscription } from '@/hooks/use-subscription';
import { calculateGratuity } from '@/services/leave-calculator';
import { formatCurrency, cn } from '@/lib/utils';
import { Calculator, Info, AlertTriangle, Scale, Landmark, Clock, FileCheck, ShieldAlert } from 'lucide-react';
import { Separator } from '../ui/separator';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { DateInput } from '../ui/date-input';
import { Badge } from '../ui/badge';

interface GratuityResult {
    gratuity: number;
    leaveBalancePay: number;
    noticeIndemnity: number;
    total: number;
    notice: string;
    yearsOfService: number;
    lastSalary: number;
    leaveBalance: number;
    dailyWage: number;
}

const terminationReasons = [
    { value: 'termination', label: 'إنهاء خدمات (من قبل الشركة) - مادة 51' },
    { value: 'resignation', label: 'استقالة (من قبل الموظف) - مادة 53' },
    { value: 'misconduct', label: 'إنهاء خدمات تأديبي (مادة 41 - بدون مكافأة)' },
    { value: 'probation_termination', label: 'إنهاء خدمات خلال فترة التجربة' },
    { value: 'probation_resignation', label: 'استقالة خلال فترة التجربة' },
    { value: 'article_48', label: 'ترك العمل للمادة 48 (خطأ صاحب العمل)' },
    { value: 'death_or_disability', label: 'الوفاة أو العجز الكلي (مادة 52)' },
    { value: 'contract_expiry', label: 'انتهاء مدة العقد المحدد' },
];

export function GratuityCalculatorView() {
  const { firestore } = useFirebase();
  const searchParams = useSearchParams();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [terminationReason, setTerminationReason] = useState<string>('termination');
  const [noticeType, setNoticeType] = useState<'worked' | 'indemnity' | 'waived'>('waived');
  const [noticeStartDate, setNoticeStartDate] = useState<Date | undefined>(new Date());
  const [result, setResult] = useState<GratuityResult | null>(null);

  // جلب كافة الموظفين (نشطين ومنتهيين) لتمكين المحاسب من حساب تسوية أي موظف
  const { data: employees, loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees');

  useEffect(() => {
    const empId = searchParams.get('employeeId');
    if (empId) {
        setSelectedEmployeeId(empId);
    }
  }, [searchParams]);

  const employeeOptions = useMemo(() => {
    return (employees || []).map(e => ({ 
      value: e.id!, 
      label: e.status === 'terminated' 
        ? `${e.fullName} (منتهية خدمته)` 
        : e.fullName, 
      searchKey: e.employeeNumber 
    }));
  }, [employees]);

  const selectedEmployee = useMemo(() => {
    return employees.find(e => e.id === selectedEmployeeId);
  }, [employees, selectedEmployeeId]);

  const handleCalculate = () => {
    const emp = employees.find(e => e.id === selectedEmployeeId);
    if (emp && noticeStartDate) {
      const calculationResult = calculateGratuity({ ...emp, terminationReason: terminationReason as any }, noticeStartDate, noticeType);
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
              <CardTitle className="text-2xl font-black">حاسبة مستحقات الموظف النهائية</CardTitle>
              <CardDescription className="text-base font-medium">حساب المكافأة وبدل الإجازات وتعويضات الإنذار وفقاً لقانون العمل الكويتي.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="grid gap-3">
              <Label className="font-black text-gray-700">الموظف المعني *</Label>
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
              <Label className="font-black text-gray-700">تاريخ بداية الإنذار (أو التوقف)</Label>
              <DateInput value={noticeStartDate} onChange={setNoticeStartDate} className="h-12" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="grid gap-3">
              <Label className="font-black text-gray-700">طريقة معالجة فترة الإنذار</Label>
              <Select value={noticeType} onValueChange={(v) => setNoticeType(v as any)}>
                <SelectTrigger className="h-12 rounded-2xl border-2"><SelectValue /></SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="worked">دوام فترة الإنذار (تُضاف للخدمة)</SelectItem>
                  <SelectItem value="indemnity">صرف بدل إنذار نقدي (تعويض 3 أشهر)</SelectItem>
                  <SelectItem value="waived">إعفاء من الإنذار / بدون إنذار</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3">
              <Label className="font-black text-gray-700">سبب نهاية الخدمة</Label>
              <Select value={terminationReason} onValueChange={setTerminationReason}>
                <SelectTrigger className="h-12 rounded-2xl border-2"><SelectValue /></SelectTrigger>
                <SelectContent dir="rtl">
                  {terminationReasons.map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-center pt-4">
              <Button onClick={handleCalculate} disabled={!selectedEmployeeId} className="w-full md:w-1/2 h-14 rounded-2xl font-black text-xl gap-3 shadow-xl shadow-primary/20">
                  <Scale className="h-6 w-6" />
                  حساب المستحقات النهائية
              </Button>
          </div>

          {result && selectedEmployee && (
            <div className="pt-8 border-t space-y-8 animate-in fade-in zoom-in-95 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-6 bg-muted/30 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center text-center">
                      <Label className="text-[10px] font-black text-muted-foreground uppercase mb-2 flex items-center gap-1"><Clock className="h-3 w-3"/> مدة الخدمة النهائية</Label>
                      <p className="text-3xl font-black text-primary font-mono">{result.yearsOfService.toFixed(2)} <span className="text-sm">سنة</span></p>
                  </div>
                  <div className="p-6 bg-muted/30 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center text-center">
                      <Label className="text-[10px] font-black text-muted-foreground uppercase mb-2">الراتب الشامل</Label>
                      <p className="text-2xl font-black text-foreground font-mono">{formatCurrency(result.lastSalary)}</p>
                  </div>
                  <div className="p-6 bg-muted/30 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center text-center">
                      <Label className="text-[10px] font-black text-muted-foreground uppercase mb-2">أجر اليوم (26 يوم)</Label>
                      <p className="text-2xl font-black text-foreground font-mono">{formatCurrency(result.dailyWage)}</p>
                  </div>
              </div>

              <div className="bg-primary/5 p-8 rounded-[2.5rem] border-2 border-primary/10">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-black text-primary flex items-center gap-2">
                          <Landmark className="h-6 w-6"/> تفاصيل الدفعات المستحقة
                      </h3>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="bg-white text-primary border-primary/20 font-black px-4">
                            {terminationReasons.find(r => r.value === terminationReason)?.label}
                        </Badge>
                        <Badge variant="secondary" className="font-bold">
                            {noticeType === 'worked' ? 'داوم الإنذار' : noticeType === 'indemnity' ? 'تعويض نقدي' : 'بدون إنذار'}
                        </Badge>
                      </div>
                  </div>

                  <div className="space-y-4">
                      <div className="flex justify-between items-center p-4 bg-white rounded-2xl border shadow-sm group hover:border-primary/30 transition-all">
                          <span className="font-bold text-gray-600">مكافأة نهاية الخدمة (الأساسية):</span>
                          <span className="text-2xl font-black text-primary font-mono">{formatCurrency(result.gratuity)}</span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-white rounded-2xl border shadow-sm group hover:border-primary/30 transition-all">
                          <span className="font-bold text-gray-600">بدل رصيد الإجازات المتبقي ({result.leaveBalance.toFixed(1)} يوم):</span>
                          <span className="text-2xl font-black text-primary font-mono">{formatCurrency(result.leaveBalancePay)}</span>
                      </div>
                      {result.noticeIndemnity > 0 && (
                        <div className="flex justify-between items-center p-4 bg-blue-50 rounded-2xl border border-blue-100 shadow-sm animate-pulse">
                            <span className="font-bold text-blue-800 flex items-center gap-2"><FileCheck className="h-4 w-4"/> بدل فـتـرة الإنذار (3 أشهر):</span>
                            <span className="text-2xl font-black text-blue-700 font-mono">{formatCurrency(result.noticeIndemnity)}</span>
                        </div>
                      )}
                      <Separator className="bg-primary/10 my-4" />
                      <div className="flex justify-between items-center p-6 bg-primary rounded-2xl text-white shadow-xl shadow-primary/30 border-4 border-white/20">
                          <span className="text-xl font-black">إجمالي صافي الشيك المستحق:</span>
                          <span className="text-4xl font-black font-mono">{formatCurrency(result.total)}</span>
                      </div>
                  </div>

                  <Alert className="mt-6 bg-white border-2 border-primary/20 rounded-2xl">
                      <Info className="h-5 w-5 text-primary" />
                      <AlertTitle className="font-black text-primary">الحالة القانونية</AlertTitle>
                      <AlertDescription className="text-sm font-bold text-slate-700 mt-1">
                          {result.notice} {noticeType === 'worked' && "تم احتساب فترة الإنذار ضمن مدة الخدمة الفعلية."}
                      </AlertDescription>
                  </Alert>
              </div>

              {(terminationReason === 'misconduct' || terminationReason.includes('probation')) && (
                  <div className="p-6 bg-red-50 border-2 border-red-100 rounded-3xl animate-bounce">
                      <div className="flex items-center gap-2 mb-3 text-red-800 font-black">
                          <ShieldAlert className="h-6 w-6" />
                          <h4>تنبيه حرمان قانوني:</h4>
                      </div>
                      <p className="text-sm font-bold text-red-700 leading-relaxed">
                          بناءً على السبب المختار، تم تصفير مكافأة نهاية الخدمة آلياً توافقاً مع قوانين العمل (المادة 41 لمخالفات السلوك، أو المادة 24 لفترة التجربة). المبالغ المتبقية قد تشمل فقط رصيد الإجازات المستحق.
                      </p>
                  </div>
              )}

              <div className="p-6 bg-orange-50 border-2 border-orange-100 rounded-3xl">
                  <div className="flex items-center gap-2 mb-3 text-orange-800 font-black">
                      <AlertTriangle className="h-5 w-5" />
                      <h4>تنبيهات التدقيق المالي:</h4>
                  </div>
                  <ul className="list-disc pr-5 text-xs font-bold text-orange-700 space-y-2 leading-loose">
                      <li>هذه الحسبة آلية وتعتمد على صحة تواريخ التعيين والرواتب المسجلة في ملف الموظف.</li>
                      <li>إذا تم اختيار "بدل إنذار نقدي"، يتوجب على الشركة دفع راتب 3 أشهر كاملة فوراً دون أن يداوم الموظف.</li>
                      <li>يجب التأكد من خصم أي "سلف نقدية" أو "قيمة عهد مفقودة" من المبلغ الإجمالي أعلاه يدوياً عند كتابة الشيك.</li>
                  </ul>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="bg-muted/10 p-6 border-t flex justify-center no-print">
            <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">Nova ERP - Legal Calculations Core v2.2</p>
        </CardFooter>
      </Card>
    </div>
  );
}
