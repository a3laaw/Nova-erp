'use client';
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import type { Client, ClientTransaction } from '@/lib/types';
import { Badge } from '../ui/badge';

interface UpsellOpportunitiesReportProps {
    transactions: (ClientTransaction & { clientId: string })[];
    clients: Client[];
    loading: boolean;
}

const GATEWAY_KEYWORDS = ['بلدية', 'رخصة بناء'];
const EXPECTED_SERVICES_KEYWORDS = ['كهرباء', 'ميكانيك', 'واجهات', 'انشائي', 'صحي', 'اشراف'];

export function UpsellOpportunitiesReport({ transactions, clients, loading }: UpsellOpportunitiesReportProps) {
    const upsellOpportunities = useMemo(() => {
        if (loading || !transactions || !clients) return [];
        
        const clientMap = new Map(clients.map(c => [c.id, c.nameAr]));
        const clientTransactions = new Map<string, ClientTransaction[]>();

        transactions.forEach(tx => {
            if (!clientTransactions.has(tx.clientId)) {
                clientTransactions.set(tx.clientId, []);
            }
            clientTransactions.get(tx.clientId)!.push(tx);
        });

        const opportunities: any[] = [];

        clientTransactions.forEach((txs, clientId) => {
            const hasCompletedGateway = txs.some(tx => 
                (tx.status === 'completed' || tx.status === 'submitted') &&
                GATEWAY_KEYWORDS.some(kw => tx.transactionType.includes(kw))
            );

            if (hasCompletedGateway) {
                const existingServices = new Set(txs.flatMap(tx => 
                    EXPECTED_SERVICES_KEYWORDS.filter(kw => tx.transactionType.includes(kw))
                ));
                
                const missingServices = EXPECTED_SERVICES_KEYWORDS.filter(kw => !existingServices.has(kw));

                if (missingServices.length > 0) {
                    opportunities.push({
                        clientId,
                        clientName: clientMap.get(clientId),
                        missingServices,
                    });
                }
            }
        });

        return opportunities;
    }, [transactions, clients, loading]);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-600"><ShoppingBag /> فرص بيع إضافية</CardTitle>
                <CardDescription>عملاء أتموا الترخيص ولم يتعاقدوا على خدمات أخرى.</CardDescription>
            </CardHeader>
            <CardContent>
                {loading && <Skeleton className="h-24" />}
                {!loading && upsellOpportunities.length === 0 && <p className="text-sm text-muted-foreground text-center p-4">لا توجد فرص بيع إضافية حاليًا.</p>}
                {!loading && (
                    <div className="space-y-3">
                        {upsellOpportunities.slice(0, 5).map((opp: any) => (
                           <div key={opp.clientId} className="flex justify-between items-center text-sm p-2 rounded-md hover:bg-muted/50">
                                <div>
                                    <Link href={`/dashboard/clients/${opp.clientId}`} className="font-semibold hover:underline">{opp.clientName}</Link>
                                </div>
                                <div className="flex flex-wrap gap-1 justify-end">
                                    {opp.missingServices.map((service: string) => (
                                        <Badge key={service} variant="secondary">{service}</Badge>
                                    ))}
                                </div>
                           </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}