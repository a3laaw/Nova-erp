'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Employee } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Calculator, Landmark, ShieldCheck } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useFirestore } from '@/firebase';
import { collection, query, orderBy, where, getDocs } from 'firebase/firestore';
import { intervalToDuration } from 'date-fns';
import { toFirestoreDate, fromFirestoreDate } from '@/services/date-converter';
import { calculateAnnualLeaveBalance } from '@/services/leave-calculator';
import { InlineSearchList } from '../ui/inline-search-list';


type TerminationReason = 'resignation' | 'termination' | 'probation' | null;


export function GratuityCalculator() {
  const firestore = useFirestore();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  
  const [terminationDate, setTerminationDate] = useState<string>('');
  const [terminationReason, setTerminationReason] = useState<TerminationReason>(null);

  useEffect(() => {
    if (!firestore) return;
    const fetchEmployees = async () => {
        setEmployeesLoading(true);
        try {
            const q = query(collection(firestore, 'employees'), orderBy('fullName'));
            const querySnapshot = await getDocs(q);
            const fetchedEmployees: Employee[] = [];
            querySnapshot.forEach((doc) => {
                fetchedEmployees.push({ id: doc.id, ...doc.data() } as Employee);
            });
            // Filter on the client side to include active and terminated employees for calculation
            const filteredEmployees = fetchedEmployees.filter(emp => emp.status === 'active' || emp.status === 'terminated');
            setEmployees(filteredEmployees);
        } catch(e) {
            console.error(e);
        } finally {
            setEmployeesLoading(false);
        }
    }
    fetchEmployees();
  }, [firestore]);


  const selectedEmployee = useMemo(() => {
    return employees.find((emp) => emp.id === selectedEmployeeId) || null;
  }, [selectedEmployeeId, employees]);

  // Effect to update form when a an employee is selected or deselected
   useEffect(() => {
    if (selectedEmployee && selectedEmployee.status === 'terminated') {
        const termDateStr = fromFirestoreDate(selectedEmployee.terminationDate);
        if (termDateStr) {
             setTerminationDate(termDateStr);
        }
        setTerminationReason(selectedEmployee.terminationReason);
    } else {
        // For active employees OR no employee selected yet, default to today's date.
        // This runs on the client-side, so new Date() is safe here.
        setTerminationDate(new Date().toISOString().split('T')[0]);
        if (selectedEmployee && selectedEmployee.status === 'active') {
             setTerminationReason(null);
        }
    }
  }, [selectedEmployee]);


  const calculationResult = useMemo(() => {
    if (!selectedEmployee || !terminationDate || !terminationReason) {
      return null;
    }

    const hireDate = toFirestoreDate(selectedEmployee.hireDate);
    const termDate = toFirestoreDate(terminationDate);

    if (!hireDate) {
        return { error: 'تاريخ التعيين للموظف المحدد غير صالح.' };
    }
    if (!termDate) {
        return { error: 'تاريخ انتهاء الخدمة المحدد غير صالح.' };
    }
    
    if (termDate < hireDate) {
        return { error: 'تاريخ انتهاء الخدمة لا يمكن أن يكون قبل تاريخ التعيين.' };
    }
    
    const duration = intervalToDuration({ start: hireDate, end: termDate });
    const formattedDuration = `${duration.years || 0} سنوات, ${duration.months || 0} أشهر, ${duration.days || 0} أيام`;

    const serviceDays = (termDate.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24);
    const yearsOfService = serviceDays / 365.25;

    // From Article 51 of Kuwait Labor Law
    const basicSalary = selectedEmployee.basicSalary || 0;
    
    let gratuity = 0;
    
    // First 5 years: 15 days pay for each year
    const first5Years = Math.min(yearsOfService, 5);
    gratuity += (15 / 26) * basicSalary * first5Years;

    // After 5 years: 1 month pay for each year
    if (yearsOfService > 5) {
        const remainingYears = yearsOfService - 5;
        gratuity += basicSalary * remainingYears;
    }
    
    // From Article 52 - rules for resignation
    if (terminationReason === 'resignation') {
        if (yearsOfService < 3) {
            gratuity = 0;
        } else if (yearsOfService >= 3 && yearsOfService < 5) {
            gratuity *= 0.5; // Half indemnity
        } else if (yearsOfService >= 5 && yearsOfService < 10) {
            gratuity *= (2/3); // Two-thirds indemnity
        } 
        // else: full indemnity for 10+ years
    }
    
    // From Article 70 - payment for unused annual leave
    const leaveBalance = calculateAnnualLeaveBalance(selectedEmployee, termDate);
    const leavePayout = (basicSalary / 26) * leaveBalance; // Law states paid on basic salary
    
    const totalPayout = gratuity + leavePayout;

    return { 
        yearsOfService: parseFloat(yearsOfService.toFixed(2)),
        formattedDuration,
        basicSalary, 
        gratuity, 
        leaveBalance, 
        leavePayout, 
        totalPayout, 
        error: null 
    };
  }, [selectedEmployee, terminationDate, terminationReason]);
  
    const employeeOptions = useMemo(() => employees.map(emp => ({
        value: emp.id!,
        label: emp.fullName,
        searchKey: emp.employeeNumber || emp.civilId
    })), [employees]);
  
  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle>حاسبة مكافأة نهاية الخدمة</CardTitle>
        <CardDescription>
          حساب تقديري لمكافأة نهاية الخدمة وبدل الإجازات وفقاً لقانون العمل الكويتي.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="employee">اختر الموظف</Label>
            <InlineSearchList 
                value={selectedEmployeeId || ''}
                onSelect={setSelectedEmployeeId}
                options={employeeOptions}
                placeholder={employeesLoading ? 'جاري التحميل...' : 'ابحث عن موظف...'}
                disabled={employeesLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="termination-date">تاريخ انتهاء الخدمة</Label>
            <Input
              id="termination-date"
              type="date"
              value={terminationDate}
              onChange={(e) => setTerminationDate(e.target.value)}
               disabled={selectedEmployee?.status === 'terminated'}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="termination-reason">سبب انتهاء الخدمة</Label>
            <Select value={terminationReason || ''} onValueChange={(v) => setTerminationReason(v as TerminationReason)} dir='rtl' disabled={selectedEmployee?.status === 'terminated'}>
              <SelectTrigger id="termination-reason">
                <SelectValue placeholder="اختر السبب..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="resignation">استقالة (من الموظف)</SelectItem>
                <SelectItem value="termination">إنهاء خدمة (من الشركة)</SelectItem>
                 <SelectItem value="probation">إنهاء فترة التجربة</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {calculationResult && !calculationResult.error && selectedEmployee && (
          <Alert>
             <Landmark className="h-4 w-4" />
            <AlertTitle>ملخص الحساب (وفقاً لقانون العمل الكويتي)</AlertTitle>
            <AlertDescription>
              <div className="mt-4 space-y-3">
                <div className='flex justify-between'>
                    <span>سنوات الخدمة:</span>
                    <span className='font-bold'>{calculationResult.formattedDuration}</span>
                </div>
                <div className='flex justify-between'>
                    <span>الراتب الأساسي المستخدم في الحساب:</span>
                    <span className='font-mono'>{formatCurrency(calculationResult.basicSalary)}</span>
                </div>
                 <hr className='my-2' />
                <div className='flex justify-between'>
                    <span>مكافأة نهاية الخدمة المستحقة:</span>
                    <span className='font-mono'>{formatCurrency(calculationResult.gratuity)}</span>
                </div>
                <div className='flex justify-between'>
                    <span>بدل رصيد الإجازات ({calculationResult.leaveBalance} يوم):</span>
                    <span className='font-mono'>{formatCurrency(calculationResult.leavePayout)}</span>
                </div>
                <hr className='my-2 border-dashed' />
                <div className='flex justify-between items-center text-lg'>
                    <span className='font-semibold'>إجمالي المستحقات التقريبية:</span>
                    <span className='font-bold text-primary'>{formatCurrency(calculationResult.totalPayout)}</span>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {calculationResult?.error && (
            <Alert variant="destructive">
                <Calculator className="h-4 w-4" />
                <AlertTitle>خطأ في الحساب</AlertTitle>
                <AlertDescription>{calculationResult.error}</AlertDescription>
            </Alert>
        )}

        {!selectedEmployeeId && (
             <div className="p-8 text-center border-2 border-dashed rounded-lg">
                <Calculator className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">ابدأ الحساب</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                    الرجاء اختيار موظف وتحديد تفاصيل إنهاء الخدمة لبدء العملية.
                </p>
            </div>
        )}

        <Alert variant="default" className="bg-muted/50 mt-8">
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>ملاحظة قانونية</AlertTitle>
            <AlertDescription>
            هذا الحساب هو تقدير تقريبي ومبني على البيانات المدخلة وأساس الراتب الأساسي فقط دون البدلات. تم الحساب وفقًا لقانون العمل الكويتي رقم 6 لسنة 2010 في القطاع الأهلي. يجب مراجعة الحسابات النهائية من قبل قسم المحاسبة.
            </AlertDescription>
        </Alert>

      </CardContent>
    </Card>
  );
}
