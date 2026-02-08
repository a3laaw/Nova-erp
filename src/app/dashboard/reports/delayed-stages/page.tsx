'use client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useAnalyticalData } from '@/hooks/use-analytical-data';
import { DelayedStagesReport } from '@/components/reports/delayed-stages-report';

export default function DelayedStagesReportPage() {
    const { transactions, clients, employees, loading } = useAnalyticalData();

    return (
        <DelayedStagesReport 
            transactions={transactions} 
            clients={clients} 
            employees={employees} 
            loading={loading} 
        />
    );
}
