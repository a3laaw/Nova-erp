'use client';
import { useState, useMemo } from 'react';
import { useAnalyticalData } from '@/hooks/use-analytical-data';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { calculateGratuity } from '@/services/leave-calculator';
import { toFirestoreDate } from '@/services/date-converter';
import { useSubscription, useFirebase } from '@/firebase';
import { where } from 'firebase/firestore';
import type { Payslip } from '@/lib/types';
import { Wallet, Users, HandCoins, FileText, Banknote } from 'lucide-react';

const StatCard = ({ title, value, icon, loading }: { title: string, value: string, icon: React.ReactNode, loading: boolean }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <div className="text-muted-foreground">{icon}</div>
        </CardHeader>
        <CardContent>
            {loading ? <Skeleton className="h-8 w-32" /> : <div className="text-2xl font-bold">{value}</div>}
        </CardContent>
    </Card>
);

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border p-2 rounded-md shadow-lg">
        <p className="font-bold">{`${payload[0].name}: ${formatCurrency(payload[0].value)}`}</p>
      </div>
    );
  }
  return null;
};

export function MonthlyCostsReport() {
    const { employees, loading: employeesLoading } = useAnalyticalData();
    const { firestore } = useFirebase();
    const [year, setYear] = useState(new Date().getFullYear().toString());
    
    const payslipsQuery = useMemo(() => {
        if (!firestore || year === 'all') return null;
        return [where('year', '==', parseInt(year))];
    }, [firestore, year]);

    const { data: payslips, loading: payslipsLoading } = useSubscription<Payslip>(firestore, 'payroll', payslipsQuery || []);

    const loading = employeesLoading || payslipsLoading;

    const reportData = useMemo(() => {
        if (loading) return null;
        
        const activeEmployees = employees.filter(e => e.status === 'active');
        const payslipsThisYear = year === 'all' ? payslips : payslips.filter(p => p.year.toString() === year);

        const totalSalaryAndAllowances = payslipsThisYear.reduce((sum, p) => sum + (p.earnings.basicSalary || 0) + (p.earnings.housingAllowance || 0) + (p.earnings.transportAllowance || 0), 0);
        const totalCommissions = payslipsThisYear.reduce((sum, p) => sum + (p.earnings.commission || 0), 0);
        const totalDeductions = payslipsThisYear.reduce((sum, p) => sum + (p.deductions.absenceDeduction || 0) + (p.deductions.otherDeductions || 0), 0);

        const gratuityPaid = employees
            .filter(e => e.status === 'terminated' && toFirestoreDate(e.terminationDate)?.getFullYear().toString() === year)
            .reduce((sum, e) => sum + calculateGratuity(e, toFirestoreDate(e.terminationDate)!).total, 0);

        const totalCost = totalSalaryAndAllowances + totalCommissions + gratuityPaid;
        const avgCostPerEmployee = activeEmployees.length > 0 ? totalCost / activeEmployees.length : 0;

        const chartData = [
            { name: 'الرواتب والبدلات', value: totalSalaryAndAllowances },
            { name: 'العمولات', value: totalCommissions },
            { name: 'مكافآت نهاية الخدمة', value: gratuityPaid },
        ];

        return {
            totalSalaryAndAllowances,
            totalCommissions,
            totalDeductions,
            gratuityPaid,
            totalCost,
            avgCostPerEmployee,
            chartData
        };
    }, [loading, year, employees, payslips]);

    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

    return (
        <Card>
            <CardHeader>
                <CardTitle>تقرير التكاليف السنوية للموظفين</CardTitle>
                <CardDescription>تحليل شامل لجميع تكاليف الموارد البشرية خلال العام المحدد.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex justify-start mb-6 p-4 bg-muted/50 rounded-lg">
                    <div className="grid gap-2">
                        <Label htmlFor="year-filter">السنة</Label>
                        <Select value={year} onValueChange={setYear}>
                            <SelectTrigger id="year-filter" className="w-[180px]"><SelectValue /></SelectTrigger>
                            <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
                    <StatCard loading={loading} title="إجمالي الرواتب والبدلات" value={formatCurrency(reportData?.totalSalaryAndAllowances || 0)} icon={<Banknote />} colorClass="text-green-600" />
                    <StatCard loading={loading} title="إجمالي العمولات" value={formatCurrency(reportData?.totalCommissions || 0)} icon={<FileText />} colorClass="text-indigo-600" />
                    <StatCard loading={loading} title="إجمالي نهاية الخدمة" value={formatCurrency(reportData?.gratuityPaid || 0)} icon={<HandCoins />} colorClass="text-amber-600" />
                    <StatCard loading={loading} title="متوسط التكلفة لكل موظف" value={formatCurrency(reportData?.avgCostPerEmployee || 0)} icon={<Users />} colorClass="text-blue-600" />
                </div>
                
                <div className="grid gap-8 md:grid-cols-3">
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle>توزيع التكاليف</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading ? <Skeleton className="h-[300px] w-full" /> : (
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={reportData?.chartData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis type="number" tickFormatter={(value) => formatCurrency(value)} />
                                        <YAxis dataKey="name" type="category" width={150} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend />
                                        <Bar dataKey="value" name="التكلفة" fill="hsl(var(--primary))" barSize={30} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>ملخص التكلفة</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-baseline">
                                <span className="text-muted-foreground">إجمالي الاستحقاقات</span>
                                <span className="font-bold">{formatCurrency((reportData?.totalSalaryAndAllowances || 0) + (reportData?.totalCommissions || 0))}</span>
                            </div>
                            <div className="flex justify-between items-baseline">
                                <span className="text-muted-foreground">إجمالي مكافآت نهاية الخدمة</span>
                                <span className="font-bold">{formatCurrency(reportData?.gratuityPaid || 0)}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between items-baseline text-lg">
                                <span className="font-extrabold">إجمالي التكلفة على الشركة</span>
                                <span className="font-extrabold">{formatCurrency(reportData?.totalCost || 0)}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </CardContent>
        </Card>
    );
}
