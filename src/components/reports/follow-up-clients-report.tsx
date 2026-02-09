
'use client';
import { useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Users } from 'lucide-react';
import Link from 'next/link';
import type { Client, ClientTransaction } from '@/lib/types';
import { Button } from '../ui/button';

interface FollowUpClientsReportProps {
    clients: Client[];
    transactions: (ClientTransaction & { clientId: string })[];
    loading: boolean;
}

export function FollowUpClientsReport({ clients, transactions, loading }: FollowUpClientsReportProps) {
    const followUpClients = useMemo(() => {
        if (loading) return [];
        
        const newClients = clients.filter(c => c.status === 'new');
        const clientTransactionsMap = new Map<string, ClientTransaction[]>();

        transactions.forEach(tx => {
            if (!clientTransactionsMap.has(tx.clientId)) {
                clientTransactionsMap.set(tx.clientId, []);
            }
            clientTransactionsMap.get(tx.clientId)!.push(tx);
        });

        return newClients.filter(client => {
            const clientTxs = clientTransactionsMap.get(client.id);
            if (!clientTxs) return false;

            const hasCompletedInquiry = clientTxs.some(tx => 
                tx.stages?.some(stage => stage.name === 'استفسارات عامة' && stage.status === 'completed')
            );
            
            const hasSignedContract = clientTxs.some(tx =>
                tx.stages?.some(stage => stage.name === 'توقيع العقد' && stage.status === 'completed')
            );

            return hasCompletedInquiry && !hasSignedContract;
        }).sort((a,b) => b.createdAt.toMillis() - a.createdAt.toMillis());

    }, [clients, transactions, loading]);

    return (
        <div className="space-y-3">
            {loading && Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex justify-between items-center p-2 rounded-md">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-5 w-1/4" />
                </div>
            ))}
            {!loading && followUpClients.length === 0 && (
                <p className="text-sm text-muted-foreground text-center p-4">لا يوجد عملاء بحاجة لمتابعة حاليًا.</p>
            )}
            {!loading && followUpClients.map(client => (
                <div key={client.id} className="flex justify-between items-center text-sm p-2 rounded-md hover:bg-muted/50">
                    <Link href={`/dashboard/clients/${client.id}`} className="font-semibold hover:underline">{client.nameAr}</Link>
                    <p className="text-xs text-muted-foreground">ملف جديد</p>
                </div>
            ))}
        </div>
    );
}

  