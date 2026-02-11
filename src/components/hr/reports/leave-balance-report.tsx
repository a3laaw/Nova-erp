'use client';
import { useState, useMemo } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Employee } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Printer } from 'lucide-react';
import { calculateAnnualLeaveBalance } from '@/services/leave-calculator';
import { useToast } from '@/hooks/use-toast';

export function LeaveBalanceReport() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const { data: employees, loading } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);
    const [balanceFilter, setBalanceFilter] = useState('all');

    const employeeLeaveBalances = useMemo(() => {
        if (!employees) return [];
        return employees.map(emp => ({
            ...emp,
            leaveBalance: calculateAnnualLeaveBalance(emp, new Date()),
        })).sort((a,b) => a.leaveBalance - b.leaveBalance);
    }, [employees]);

    const filteredEmployees = useMemo(() => {
        if (balanceFilter === 'all') return employeeLeaveBalances;
        const limit = parseInt(balanceFilter, 10);
        return employeeLeaveBalances.filter(emp => emp.leaveBalance < limit);
    }, [employeeLeaveBalances, balanceFilter]);

    const handlePrint = () => {
        toast({ title: 'قيد التطوير', description: 'سيتم إضافة خاصية الطباعة قريبًا.' });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>أرصدة إجازات الموظفين</CardTitle>
                <CardDescription>عرض تفصيلي لأرصدة الإجازات السنوية لجميع الموظفين النشطين.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                        <Label htmlFor="balance-filter">عرض الموظفين برصيد أقل من</Label>
                        <Select value={balanceFilter} onValueChange={setBalanceFilter}><SelectTrigger id="balance-filter" className="w-[180px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">الكل</SelectItem><SelectItem value="10">10 أيام</SelectItem><SelectItem value="5">5 أيام</SelectItem></SelectContent></Select>
                    </div>
                     <Button variant="outline" onClick={handlePrint}><Printer className="ml-2 h-4"/> طباعة</Button>
                </div>
                <Table>
                    <TableHeader><TableRow><TableHead>اسم الموظف</TableHead><TableHead>القسم</TableHead><TableHead className="text-center">رصيد مرحل</TableHead><TableHead className="text-center">مكتسب</TableHead><TableHead className="text-center">مستخدم</TableHead><TableHead className="text-center font-bold">الرصيد المتبقي</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {loading && Array.from({length: 4}).map((_, i) => ( <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell></TableRow> ))}
                        {!loading && filteredEmployees.length === 0 && <TableRow><TableCell colSpan={6} className="h-24 text-center">لا توجد بيانات.</TableCell></TableRow>}
                        {!loading && filteredEmployees.map(emp => (<TableRow key={emp.id} className={emp.leaveBalance < 5 ? 'bg-red-50 dark:bg-red-900/20' : ''}><TableCell className="font-medium">{emp.fullName}</TableCell><TableCell>{emp.department}</TableCell><TableCell className="text-center">{emp.carriedLeaveDays || 0}</TableCell><TableCell className="text-center">{emp.annualLeaveAccrued || 0}</TableCell><TableCell className="text-center">{emp.annualLeaveUsed || 0}</TableCell><TableCell className="text-center font-bold"><div className='flex justify-center items-center gap-2'>{emp.leaveBalance}{emp.leaveBalance < 5 && <Badge variant="destructive">منخفض</Badge>}</div></TableCell></TableRow>))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
