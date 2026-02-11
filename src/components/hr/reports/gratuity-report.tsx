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

export function GratuityReport() {
    const { employees, loading } = useAnalyticalData();
    const { toast } = useToast();
    const [serviceDurationFilter, setServiceDurationFilter] = useState('all');

    const reportData = useMemo(() => {
        if (loading || !employees) return [];
        return employees.filter(e => e.status === 'active').map(emp => {
            const hireDate = toFirestoreDate(emp.hireDate);
            if (!hireDate) return null;
            const yearsOfService = differenceInYears(new Date(), hireDate);
            const gratuityOnTermination = calculateGratuity({ ...emp, terminationReason: 'termination' }, new Date());
            const gratuityOnResignation = calculateGratuity({ ...emp, terminationReason: 'resignation' }, new Date());
            return { ...emp, yearsOfService, gratuityOnTermination: gratuityOnTermination.gratuity, leaveBalancePay: gratuityOnTermination.leaveBalancePay, totalOnTermination: gratuityOnTermination.total, gratuityOnResignation: gratuityOnResignation.gratuity };
        }).filter((item): item is NonNullable<typeof item> => item !== null);
    }, [employees, loading]);
    
    const filteredData = useMemo(() => {
        if (serviceDurationFilter === 'all') return reportData;
        const years = parseInt(serviceDurationFilter, 10);
        return reportData.filter(item => item.yearsOfService > years);
    }, [reportData, serviceDurationFilter]);

    const totals = useMemo(() => ({
        gratuity: filteredData.reduce((sum, item) => sum + item.gratuityOnTermination, 0),
        leavePay: filteredData.reduce((sum, item) => sum + item.leaveBalancePay, 0),
        total: filteredData.reduce((sum, item) => sum + item.totalOnTermination, 0),
    }), [filteredData]);
    
    const handlePrint = () => { toast({ title: 'قيد التطوير', description: 'سيتم إضافة خاصية الطباعة قريبًا.' }); };

    return (
        <Card>
            <CardHeader><CardTitle>تقدير مكافآت نهاية الخدمة</CardTitle><CardDescription>تقدير للاستحقاقات المتوقعة للموظفين النشطين في حال إنهاء خدماتهم اليوم.</CardDescription></CardHeader>
            <CardContent>
                <div className="flex justify-between items-center mb-4">
                    <div className='flex items-center gap-4'>
                        <div className="flex items-center gap-2"><Label htmlFor="service-duration-filter-gratuity">مدة الخدمة</Label><Select value={serviceDurationFilter} onValueChange={setServiceDurationFilter}><SelectTrigger id="service-duration-filter-gratuity" className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">الكل</SelectItem><SelectItem value="3">أكثر من 3 سنوات</SelectItem><SelectItem value="5">أكثر من 5 سنوات</SelectItem><SelectItem value="10">أكثر من 10 سنوات</SelectItem></SelectContent></Select></div>
                    </div>
                    <Button variant="outline" onClick={handlePrint}><Printer className="ml-2 h-4"/> طباعة</Button>
                </div>
                 <div className="border rounded-lg">
                    <Table>
                        <TableHeader><TableRow><TableHead>الموظف (الرقم الوظيفي)</TableHead><TableHead>القسم</TableHead><TableHead>تاريخ التعيين</TableHead><TableHead className="text-center">سنوات الخدمة</TableHead><TableHead className="text-left">مكافأة (إنهاء)</TableHead><TableHead className="text-left">مكافأة (استقالة)</TableHead><TableHead className="text-left">بدل إجازات</TableHead><TableHead className="text-left font-bold">الإجمالي المتوقع</TableHead></TableRow></TableHeader>
                        <TableBody>
                             {loading && Array.from({length: 4}).map((_, i) => <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-6 w-full"/></TableCell></TableRow>)}
                             {!loading && filteredData.length === 0 && <TableRow><TableCell colSpan={8} className="h-24 text-center">لا توجد بيانات.</TableCell></TableRow>}
                             {!loading && filteredData.map(item => (<TableRow key={item.id}><TableCell><div className="font-medium">{item.fullName}</div><div className="text-xs text-muted-foreground font-mono">{item.employeeNumber}</div></TableCell><TableCell>{item.department}</TableCell><TableCell>{toFirestoreDate(item.hireDate) ? format(toFirestoreDate(item.hireDate)!, 'dd/MM/yyyy') : '-'}</TableCell><TableCell className="text-center"><div className="flex items-center justify-center gap-2">{item.yearsOfService.toFixed(1)}{item.yearsOfService >= 2.5 && item.yearsOfService < 3 && <Badge variant="outline" className="bg-yellow-100 text-yellow-800">قريب من الاستحقاق</Badge>}</div></TableCell><TableCell className="text-left font-mono">{formatCurrency(item.gratuityOnTermination)}</TableCell><TableCell className="text-left font-mono">{formatCurrency(item.gratuityOnResignation)}</TableCell><TableCell className="text-left font-mono">{formatCurrency(item.leaveBalancePay)}</TableCell><TableCell className="text-left font-mono font-bold">{formatCurrency(item.totalOnTermination)}</TableCell></TableRow>))}
                        </TableBody>
                         <TableFooter><TableRow className="font-bold text-base bg-muted"><TableCell colSpan={4}>الإجمالي المتوقع للموظفين الظاهرين (في حال إنهاء الخدمة)</TableCell><TableCell className="text-left font-mono">{formatCurrency(totals.gratuity)}</TableCell><TableCell></TableCell><TableCell className="text-left font-mono">{formatCurrency(totals.leavePay)}</TableCell><TableCell className="text-left font-mono">{formatCurrency(totals.total)}</TableCell></TableRow></TableFooter>
                    </Table>
                </div>
            </CardContent>
        </Card>
    )
}
