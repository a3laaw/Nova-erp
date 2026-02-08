'use client';

import { useAnalyticalData } from '@/hooks/use-analytical-data';
import { DelayedStagesReport } from './delayed-stages-report';
import { StalledStagesReport } from './stalled-stages-report';
import { ProspectiveClientsReport } from './prospective-clients-report';
import { UpsellOpportunitiesReport } from './upsell-opportunities-report';

export function WorkflowReportsDashboard() {
    const { 
        clients, 
        transactions, 
        employees, 
        appointments, 
        loading 
    } = useAnalyticalData();

    return (
        <div className="grid md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 gap-6">
            <DelayedStagesReport transactions={transactions} clients={clients} employees={employees} loading={loading} />
            <StalledStagesReport transactions={transactions} clients={clients} employees={employees} loading={loading} />
            <ProspectiveClientsReport appointments={appointments} employees={employees} loading={loading} />
            <UpsellOpportunitiesReport transactions={transactions} clients={clients} loading={loading} />
        </div>
    );
}
