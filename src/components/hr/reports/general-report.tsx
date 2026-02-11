'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Employee } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Printer } from 'lucide-react';
import { format } from 'date-fns';
import { toFirestoreDate } from '@/services/date-converter';
import { formatCurrency } from '@/lib/utils';
import { searchEmployees } from '@/lib/cache/fuse-search';
import { differenceInYears } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

const statusTranslations: Record<string, string> = {
  active: 'نشط',
  'on-leave': 'في إجازة',
  terminated: 'منتهية خدماته',
};
const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800 border-green-200',
  'on-leave': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  terminated: 'bg-red-100 text-red-800 border-red-200',
};
const contractTypeTranslations: Record<string, string> = {
    permanent: 'دائم',
    temporary: 'مؤقت',
    subcontractor: 'مقاول باطن',
    percentage: 'نسبة',
    'part-time': 'دوام جزئي',
    'piece-rate': 'بالقطعة',
    special: 'دوام خاص',
};

export function GeneralEmployeeReport() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const { data: employees, loading } = useSubscription<Employee>(firestore, 'employees');

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [departmentFilter, setDepartmentFilter] = useState('all');
    const [contractTypeFilter, setContractTypeFilter] = useState('all');
    const [serviceDurationFilter, setServiceDurationFilter] = useState('all');

    const { departmentOptions, contractTypeOptions } = useMemo(() => {
        if (!employees) return { departmentOptions: [], contractTypeOptions: [] };
        const depts = new Set(employees.map(e => e.department).filter(Boolean));
        const contracts = new Set(employees.map(e => e.contractType).filter(Boolean));
        return {
            departmentOptions: Array.from(depts),
            contractTypeOptions: Array.from(contracts),
        };
    }, [employees]);

    const filteredEmployees = useMemo(() => {
        const today = new Date();
        let filtered = employees || [];

        if (statusFilter !== 'all') filtered = filtered.filter(e => e.status === statusFilter);
        if (departmentFilter !== 'all') filtered = filtered.filter(e => e.department === departmentFilter);
        if (contractTypeFilter !== 'all') filtered = filtered.filter(e => e.contractType === contractTypeFilter);
        
        if (serviceDurationFilter !== 'all') {
            filtered = filtered.filter(emp => {
                const hireDate = toFirestoreDate(emp.hireDate);
                if (!hireDate) return false;
                const yearsOfService = differenceInYears(today, hireDate);
                switch (serviceDurationFilter) {
                    case '1-3': return yearsOfService >= 1 && yearsOfService < 3;
                    case '3-6': return yearsOfService >= 3 && yearsOfService < 6;
                    case '6-10': return yearsOfService >= 6 && yearsOfService < 10;
                    case '10+': return yearsOfService >= 10;
                    default: return true;
                }
            });
        }
        
        return searchEmployees(filtered, searchQuery);
    }, [employees, searchQuery, statusFilter, departmentFilter, contractTypeFilter, serviceDurationFilter]);

    const formatDate = (date: any) => toFirestoreDate(date) ? format(toFirestoreDate(date)!, 'dd/MM/yyyy') : '-';

    const handlePrint = () => {
      toast({ title: 'قيد التطوير', description: 'سيتم إضافة خاصية الطباعة قريبًا.' });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>تقرير الموظفين العام</CardTitle>
                <CardDescription>عرض بيانات الموظفين مع فلاتر متقدمة.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-wrap gap-4 mb-4 p-4 bg-muted/50 rounded-lg">
                    <div className="flex-1 min-w-[180px]">
                        <Label htmlFor="search-input">بحث</Label>
                        <Input id="search-input" placeholder="ابحث بالاسم، الرقم الوظيفي..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                     <div className="flex-1 min-w-[150px]">
                        <Label htmlFor="status-filter">الحالة</Label>
                        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger id="status-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">الكل</SelectItem>{Object.entries(statusTranslations).filter(([k])=>['active', 'on-leave', 'terminated'].includes(k)).map(([key, value]) => (<SelectItem key={key} value={key}>{value}</SelectItem>))}</SelectContent></Select>
                    </div>
                    <div className="flex-1 min-w-[150px]">
                        <Label htmlFor="department-filter">القسم</Label>
                        <Select value={departmentFilter} onValueChange={setDepartmentFilter}><SelectTrigger id="department-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">الكل</SelectItem>{departmentOptions.map(dept => <SelectItem key={dept} value={dept}>{dept}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <div className="flex-1 min-w-[150px]">
                        <Label htmlFor="contract-type-filter">نوع العقد</Label>
                        <Select value={contractTypeFilter} onValueChange={setContractTypeFilter}><SelectTrigger id="contract-type-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">الكل</SelectItem>{contractTypeOptions.map(type => <SelectItem key={type} value={type}>{contractTypeTranslations[type] || type}</SelectItem>)}</SelectContent></Select>
                    </div>
                     <div className="flex-1 min-w-[150px]">
                        <Label htmlFor="service-duration-filter">مدة الخدمة</Label>
                        <Select value={serviceDurationFilter} onValueChange={setServiceDurationFilter}><SelectTrigger id="service-duration-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">الكل</SelectItem><SelectItem value="1-3">1-3 سنوات</SelectItem><SelectItem value="3-6">3-6 سنوات</SelectItem><SelectItem value="6-10">6-10 سنوات</SelectItem><SelectItem value="10+">{'>'} 10 سنوات</SelectItem></SelectContent></Select>
                    </div>
                </div>
                 <div className="border rounded-lg">
                    <Table>
                        <TableHeader><TableRow><TableHead>الاسم الكامل</TableHead><TableHead>الرقم الوظيفي</TableHead><TableHead>القسم</TableHead><TableHead>تاريخ التعيين</TableHead><TableHead>الحالة</TableHead><TableHead>الراتب الأساسي</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {loading && Array.from({length: 5}).map((_, i) => (<TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell></TableRow>))}
                            {!loading && filteredEmployees.length === 0 && <TableRow><TableCell colSpan={6} className="h-24 text-center">لا توجد بيانات.</TableCell></TableRow>}
                            {!loading && filteredEmployees.map(emp => (<TableRow key={emp.id}><TableCell className="font-medium"><Link href={`/dashboard/hr/employees/${emp.id}`} className="hover:underline">{emp.fullName}</Link></TableCell><TableCell className="font-mono">{emp.employeeNumber}</TableCell><TableCell>{emp.department}</TableCell><TableCell>{formatDate(emp.hireDate)}</TableCell><TableCell><Badge variant="outline" className={statusColors[emp.status]}>{statusTranslations[emp.status]}</Badge></TableCell><TableCell className="font-mono">{formatCurrency(emp.basicSalary)}</TableCell></TableRow>))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
