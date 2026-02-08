'use client';
import { useAnalyticalData } from '@/hooks/use-analytical-data';
import { UpsellOpportunitiesReport } from '@/components/reports/upsell-opportunities-report';

export default function UpsellOpportunitiesReportPage() {
    const { transactions, clients, loading } = useAnalyticalData();

    return (
        <UpsellOpportunitiesReport 
            transactions={transactions}
            clients={clients} 
            loading={loading} 
        />
    );
}
