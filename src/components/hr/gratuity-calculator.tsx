
'use client';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import type { Employee } from '@/lib/types';
import { useSubscription } from '@/hooks/use-subscription';
import { useFirebase } from '@/firebase';
import { differenceInDays } from 'date-fns';
import { toFirestoreDate } from '@/services/date-converter';
import { formatCurrency } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Info, Calculator } from 'lucide-react';

export function GratuityCalculator() {
    const { firestore } = useFirebase();
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
    const [lastSalary, setLastSalary] = useState('');
    const [resignation, setResignation] = useState(false);
    const [result, setResult] = useState<any>(null);

    const { data: employees, loading } = useSubscription<Employee>(firestore, 'employees');
    
    const employeeOptions = useMemo(() => 
        employees.map(e => ({ value: e.id!, label: e.fullName }))
    , [employees]);

    const selectedEmployee = useMemo(() => {
        const emp = employees.find(e => e.id === selectedEmployeeId);
        if (emp && !lastSalary) {
             const salary = (emp.basicSalary || 0) + (emp.housingAllowance || 0) + (emp.transportAllowance || 0);
             setLastSalary(String(salary));
        }
        return emp;
    }, [selectedEmployeeId, employees, lastSalary]);

    const calculate = () => {
        if (!selectedEmployee) return;
        
        const hireDate = toFirestoreDate(selectedEmployee.hireDate);
        if (!hireDate) return;

        const terminationDate = toFirestoreDate(selectedEmployee.terminationDate) || new Date();
        const yearsOfService = differenceInDays(terminationDate, hireDate) / 365.25;

        const salary = Number(lastSalary);
        if (!salary) return;
        
        let gratuity = 0;

        if (resignation) {
            if (yearsOfService < 3) {
                gratuity = 0;
            } else if (yearsOfService < 5) {
                gratuity = (0.5 * salary) * yearsOfService;
            } else if (yearsOfService < 10) {
                gratuity = (0.75 * salary) * yearsOfService;
            } else {
                gratuity = (1 * salary) * yearsOfService;
            }
        } else { // Termination
            if (yearsOfService < 5) {
                gratuity = (0.5 * salary) * yearsOfService;
            } else {
                gratuity = (1 * salary) * yearsOfService;
            }
        }
        
        // As per Kuwaiti law, max is 18 months salary
        const maxGratuity = 18 * salary;
        const finalGratuity = Math.min(gratuity, maxGratuity);

        const leaveBalance = selectedEmployee.annualLeaveBalance || 0;
        const leavePay = (salary / 22) * leaveBalance;

        setResult({
            yearsOfService: yearsOfService.toFixed(2),
            gratuity: finalGratuity,
            leaveBalance,
            leavePay,
            total: finalGratuity + leavePay
        });
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                 <div className="grid gap-2">
                    <Label>الموظف</Label>
                    <InlineSearchList 
                        value={selectedEmployeeId || ''} 
                        onSelect={setSelectedEmployeeId} 
                        options={employeeOptions}
                        placeholder={loading ? 'تحميل...' : 'اختر موظفًا...'}
                        disabled={loading}
                    />
                </div>
                 <div className="grid gap-2">
                    <Label>آخر راتب شامل</Label>
                    <Input type="number" value={lastSalary} onChange={e => setLastSalary(e.target.value)} disabled={!selectedEmployeeId} className="dir-ltr"/>
                </div>
                <div className="grid gap-2">
                    <Label>سبب إنهاء الخدمة</Label>
                    <div className="flex gap-2">
                        <Button variant={!resignation ? 'default' : 'outline'} onClick={() => setResignation(false)} className="flex-1">إنهاء خدمات</Button>
                        <Button variant={resignation ? 'default' : 'outline'} onClick={() => setResignation(true)} className="flex-1">استقالة</Button>
                    </div>
                </div>
                <Button onClick={calculate} disabled={!selectedEmployeeId || !lastSalary}>
                    <Calculator className="ml-2 h-4 w-4" />
                    احسب
                </Button>
            </div>
            
            {result && (
                <Card>
                    <CardHeader>
                        <CardTitle>نتائج حساب مكافأة نهاية الخدمة لـِ {selectedEmployee?.fullName}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <InfoItem label="سنوات الخدمة" value={result.yearsOfService} />
                            <InfoItem label="رصيد الإجازات" value={`${result.leaveBalance.toFixed(0)} يوم`} />
                            <InfoItem label="الراتب الأخير المعتمد" value={formatCurrency(Number(lastSalary))} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/50">
                             <InfoItem label="مكافأة نهاية الخدمة" value={formatCurrency(result.gratuity)} />
                             <InfoItem label="بدل رصيد الإجازات" value={formatCurrency(result.leavePay)} />
                            <div className="flex flex-col text-lg font-bold text-primary">
                                <span className="text-sm text-muted-foreground">الإجمالي المستحق</span>
                                <span>{formatCurrency(result.total)}</span>
                            </div>
                        </div>
                         <Alert>
                            <Info className="h-4 w-4" />
                            <AlertTitle>ملاحظة هامة</AlertTitle>
                            <AlertDescription>
                                هذه الحسبة هي تقديرية بناءً على المدخلات وقانون العمل الكويتي. يجب مراجعتها من قبل قسم المحاسبة والموارد البشرية.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

const InfoItem = ({ label, value }: { label: string, value: string | number }) => (
    <div className="flex flex-col space-y-1">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className="text-lg font-semibold">{value}</span>
    </div>
);

    