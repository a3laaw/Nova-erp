'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, orderBy, getDocs, collectionGroup } from 'firebase/firestore';
import type { Client, ClientTransaction, BoqItem } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { InlineSearchList, type SearchOption } from '@/components/ui/inline-search-list';
import { ContractForm } from '@/components/contract/ContractForm';
import { Search } from 'lucide-react';

export default function NewContractPage() {
    const { firestore } = useFirebase();
    const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
    const [searchKey, setSearchKey] = useState('');

    const [clients, setClients] = useState<Client[]>([]);
    const [transactions, setTransactions] = useState<ClientTransaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!firestore) return;
        const fetchData = async () => {
            setLoading(true);
            try {
                const [clientsSnap, transactionsSnap] = await Promise.all([
                    getDocs(query(collection(firestore, 'clients'))),
                    getDocs(query(collectionGroup(firestore, 'transactions'))),
                ]);
                
                const clientList = clientsSnap.docs.map(d => ({id: d.id, ...d.data()}) as Client);
                setClients(clientList);

                const txList = transactionsSnap.docs.map(d => {
                     const pathParts = d.ref.path.split('/');
                     const clientId = pathParts[pathParts.length - 3];
                     return { id: d.id, clientId, ...d.data() } as ClientTransaction;
                });
                setTransactions(txList);

            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [firestore]);
    
    const transactionOptions: SearchOption[] = useMemo(() => {
        const clientMap = new Map(clients.map(c => [c.id, c.nameAr]));
        return transactions
            .filter(tx => !tx.contract) // Only show transactions without a contract
            .map(tx => ({
                value: tx.id!,
                label: `${clientMap.get(tx.clientId) || 'Unknown Client'} - ${tx.transactionType} (${tx.transactionNumber})`,
                searchKey: `${clientMap.get(tx.clientId)} ${tx.transactionType} ${tx.transactionNumber}`
            }));
    }, [clients, transactions]);

    const selectedTransaction = useMemo(() => {
        return transactions.find(t => t.id === selectedTransactionId);
    }, [transactions, selectedTransactionId]);
    
    const selectedClient = useMemo(() => {
        if (!selectedTransaction) return null;
        return clients.find(c => c.id === selectedTransaction.clientId);
    }, [clients, selectedTransaction]);

    const handleReset = () => {
        setSelectedTransactionId(null);
        setSearchKey(Date.now().toString()); // Force re-render of search component
    };

    return (
        <Card className="max-w-4xl mx-auto" dir="rtl">
            <CardHeader>
                <CardTitle>إنشاء عقد جديد</CardTitle>
                <CardDescription>ابحث عن معاملة لتبدأ بإنشاء عقد مرتبط بها.</CardDescription>
            </CardHeader>
            <CardContent>
                {!selectedTransaction ? (
                    <div className="space-y-4 max-w-lg mx-auto py-8">
                        <div className="flex items-center gap-2">
                             <Search className="h-5 w-5 text-muted-foreground" />
                             <Label className="font-semibold">ابحث عن معاملة</Label>
                        </div>
                        <InlineSearchList
                            key={searchKey}
                            value={selectedTransactionId || ''}
                            onSelect={setSelectedTransactionId}
                            options={transactionOptions}
                            placeholder="ابحث باسم العميل أو رقم المعاملة..."
                            disabled={loading}
                        />
                        {loading && <p className="text-sm text-muted-foreground text-center">جاري تحميل البيانات...</p>}
                    </div>
                ) : (
                    <ContractForm 
                        client={selectedClient!}
                        transaction={selectedTransaction}
                        onCancel={handleReset}
                    />
                )}
            </CardContent>
        </Card>
    );
}
