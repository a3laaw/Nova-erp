
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/context/auth-context';
import { getTenantPath } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { FileEdit, PlusCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from 'next/link';
import { ClientHistoryTimeline } from '@/components/clients/client-history-timeline';
import { ClientTransactionForm } from '@/components/clients/client-transaction-form';
import { ClientTransactionsList } from '@/components/clients/client-transactions-list'; // Import the new component

export function ClientProfileLayout({ clientId }: { clientId: string }) {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const router = useRouter();

    const [client, setClient] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);

    const tenantId = currentUser?.currentCompanyId;

    useEffect(() => {
        if (!firestore || !clientId || !tenantId) return;

        const fetchClientData = async () => {
            setIsLoading(true);
            const clientRef = doc(firestore, getTenantPath('clients', tenantId), clientId);
            const clientSnap = await getDoc(clientRef);

            if (clientSnap.exists()) {
                setClient({ id: clientSnap.id, ...clientSnap.data() });
            } else {
                router.push('/dashboard/clients');
            }
            setIsLoading(false);
        };

        fetchClientData();
    }, [firestore, clientId, tenantId, router]);

    if (isLoading || !client) {
        return (
            <div className="space-y-4 p-4 md:p-8 pt-6">
                <div className="flex justify-between items-center">
                    <Skeleton className="h-10 w-1/3" />
                    <Skeleton className="h-12 w-32" />
                </div>
                <Skeleton className="h-12 w-full mt-4" />
                <div className="pt-8">
                    <Skeleton className="h-64 w-full" />
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-6" dir="rtl">
                {/* Page Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className='flex-1'>
                        <h1 className="text-3xl font-bold tracking-tight text-gray-800">{client.nameAr}</h1>
                        <p className="text-gray-500 font-mono">#{client.fileNumber}</p>
                    </div>
                    <div className="flex gap-2">
                        <Button asChild variant='outline'>
                            <Link href={`/dashboard/clients/${client.id}/edit`}>
                                <FileEdit className="ml-2 h-4 w-4" />
                                تعديل البيانات
                            </Link>
                        </Button>
                        <Button onClick={() => setIsTransactionFormOpen(true)}>
                            <PlusCircle className="ml-2 h-4 w-4" />
                            إضافة معاملة
                        </Button>
                    </div>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="transactions" className="w-full">
                    <TabsList className="grid w-full grid-cols-5">
                        <TabsTrigger value="transactions">المعاملات</TabsTrigger>
                        <TabsTrigger value="contracts">العقود</TabsTrigger>
                        <TabsTrigger value="statement">كشف الحساب</TabsTrigger>
                        <TabsTrigger value="appointments">المواعيد</TabsTrigger>
                        <TabsTrigger value="history">سجل التغيرات</TabsTrigger>
                    </TabsList>

                    <div className='mt-6'>
                        <TabsContent value="transactions">
                            {/* Replace placeholder with the actual component */}
                            <ClientTransactionsList clientId={client.id} />
                        </TabsContent>
                        <TabsContent value="contracts">
                            <div className="p-8 text-center text-gray-400 border-2 border-dashed rounded-lg">
                                <p>مكون لـ العقود وعروض الأسعار</p>
                                <p className="text-sm">سيتم تنفيذه في المرحلة التالية</p>
                            </div>
                        </TabsContent>
                        <TabsContent value="statement">
                            <div className="p-8 text-center text-gray-400 border-2 border-dashed rounded-lg">
                                <p>مكون لـ كشف الحساب المالي</p>
                                <p className="text-sm">سيتم تنفيذه في المرحلة التالية</p>
                            </div>
                        </TabsContent>
                        <TabsContent value="appointments">
                            <div className="p-8 text-center text-gray-400 border-2 border-dashed rounded-lg">
                                <p>مكون لـ سجل المواعيد</p>
                                <p className="text-sm">سيتم تنفيذه في المرحلة التالية</p>
                            </div>
                        </TabsContent>
                        <TabsContent value="history">
                            <ClientHistoryTimeline collectionPath={`tenants/${tenantId}/clients/${clientId}/history`} />
                        </TabsContent>
                    </div>
                </Tabs>
            </div>

            <ClientTransactionForm 
                isOpen={isTransactionFormOpen}
                onClose={() => setIsTransactionFormOpen(false)}
                clientId={client.id}
                clientName={client.nameAr}
            />
        </>
    );
}
