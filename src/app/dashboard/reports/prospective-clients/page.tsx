'use client';
import { useAnalyticalData } from '@/hooks/use-analytical-data';
import { ProspectiveClientsReport } from '@/components/reports/prospective-clients-report';

export default function ProspectiveClientsReportPage() {
    const { appointments, employees, loading } = useAnalyticalData();

    return (
        <ProspectiveClientsReport 
            appointments={appointments}
            employees={employees} 
            loading={loading} 
        />
    );
}
