'use client';
import { useState, useMemo } from 'react';
import { useAnalyticalData } from '@/hooks/use-analytical-data';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import { toFirestoreDate } from '@/services/date-converter';
import { calculateGratuity } from '@/services/leave-calculator';
import { differenceInYears, format } from 'date-fns';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSubscription, useFirebase } from '@/firebase';
import type { Payslip, Employee } from '@/lib/types';
import Link from 'next/link';

const terminationReasonTranslations: Record<string, string> = {
    resignation: 'استقالة',
    termination: 'إنهاء خدمات',
};

export function SeparationsReport() {
    const { employees, loading: employeesLoading } = useAnalyticalData();
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());

    const { data: allPayslips, loading: payslipsLoading } = useSubscription<Payslip>(firestore, 'payroll');
    
    const loading = employeesLoading || payslipsLoading;

    const reportData = useMemo(() => {
        if (loading || !employees) return [];
        
        return employees
            .filter(e => {
                if (e.status !== 'terminated' || !e.terminationDate) return false;
                const terminationYear = toFirestoreDate(e.terminationDate)?.getFullYear();
                return yearFilter === 'all' || (terminationYear && terminationYear.toString() === yearFilter);
            })
            .map(emp => {
                const hireDate = toFirestoreDate(emp.hireDate);
                const terminationDate = toFirestoreDate(emp.terminationDate);
                const yearsOfService = hireDate && terminationDate ? differenceInYears(terminationDate, hireDate) : 0;
                
                const gratuityResult = calculateGratuity(emp, terminationDate || new Date());
                
                // Check if a final settlement payslip exists
                const terminationMonth = terminationDate ? terminationDate.getMonth() + 1 : -1;
                const terminationYear = terminationDate ? terminationDate.getFullYear() : -1;
                const finalPayslip = allPayslips.find(p => p.employeeId === emp.id && p.year === terminationYear && p.month === terminationMonth);
                
                const isSettled = !!finalPayslip && finalPayslip.status === 'paid';

                return {
                    ...emp,
                    yearsOfService,
                    gratuityPaid: gratuityResult.total,
                    isSettled,
                };
            })
            .sort((a,b) => (toFirestoreDate(b.terminationDate)?.getTime() || 0) - (toFirestoreDate(a.terminationDate)?.getTime() || 0));
    }, [employees, loading, yearFilter, allPayslips]);

    const totals = useMemo(() => ({
        separations: reportData.length,
        gratuity: reportData.reduce((sum, item) => sum + item.gratuityPaid, 0),
    }), [reportData]);

    const handlePrint = () => { toast({ title: 'قيد التطوير', description: 'سيتم إضافة خاصية الطباعة قريبًا.' }); };

    const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

    return (
        <Card>
            <CardHeader><CardTitle>تقرير الاستقالات وإنهاء الخدمات</CardTitle><CardDescription>عرض وتحليل جميع حالات الانفصال الوظيفي خلال فترة محددة.</CardDescription></CardHeader>
            <CardContent>
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-4">
                        <Label htmlFor="year-filter">السنة</Label>
                        <Select value={yearFilter} onValueChange={setYearFilter}><SelectTrigger id="year-filter" className="w-[180px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">كل السنوات</SelectItem>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <Button variant="outline" onClick={handlePrint}><Printer className="ml-2 h-4"/> طباعة</Button>
                </div>
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader><TableRow><TableHead>الموظف (الرقم الوظيفي)</TableHead><TableHead>القسم</TableHead><TableHead>تاريخ التعيين</TableHead><TableHead>تاريخ الإنهاء</TableHead><TableHead>السبب</TableHead><TableHead>المستحقات المدفوعة</TableHead><TableHead>حالة التسوية</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {loading && Array.from({length: 3}).map((_, i) => <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-6 w-full"/></TableCell></TableRow>)}
                            {!loading && reportData.length === 0 && <TableRow><TableCell colSpan={7} className="h-24 text-center">لا توجد بيانات لهذه الفترة.</TableCell></TableRow>}
                            {!loading && reportData.map(item => (<TableRow key={item.id}><TableCell className="font-medium"><Link href={`/dashboard/hr/employees/${item.id}`} className="hover:underline">{item.fullName}</Link><div className="text-xs text-muted-foreground font-mono">{item.employeeNumber}</div></TableCell><TableCell>{item.department}</TableCell><TableCell>{toFirestoreDate(item.hireDate) ? format(toFirestoreDate(item.hireDate)!, 'dd/MM/yyyy') : '-'}</TableCell><TableCell>{toFirestoreDate(item.terminationDate) ? format(toFirestoreDate(item.terminationDate)!, 'dd/MM/yyyy') : '-'}</TableCell><TableCell>{terminationReasonTranslations[item.terminationReason!] || '-'}</TableCell><TableCell className="font-mono">{formatCurrency(item.gratuityPaid)}</TableCell><TableCell>
                                        {item.isSettled 
                                            ? <Badge variant="outline" className="bg-green-100 text-green-800">مدفوعة</Badge>
                                            : <Badge variant="destructive" className="bg-yellow-100 text-yellow-800">معلقة</Badge>
                                        }
                                    </TableCell></TableRow>))}
                        </TableBody>
                        <TableFooter><TableRow className="font-bold text-base bg-muted"><TableCell colSpan={5}>الإجمالي</TableCell><TableCell>{formatCurrency(totals.gratuity)}</TableCell><TableCell></TableCell></TableRow></TableFooter>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
