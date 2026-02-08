'use client';
import { useAnalyticalData } from '@/hooks/use-analytical-data';
import { StalledStagesReport } from '@/components/reports/stalled-stages-report';

export default function StalledStagesReportPage() {
    const { transactions, clients, employees, loading } = useAnalyticalData();

    return (
        <StalledStagesReport 
            transactions={transactions} 
            clients={clients} 
            employees={employees} 
            loading={loading} 
        />
    );
}
