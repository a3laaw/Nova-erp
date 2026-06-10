'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { getTenantPath } from '@/lib/utils';
import { TransactionContract } from '@/components/clients/transaction-contract';
import { Skeleton } from '@/components/ui/skeleton';
import type { Client, ClientTransaction } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Printer, ArrowRight } from 'lucide-react';
import { useBranding } from '@/context/branding-context';

export default function TransactionContractPage() {
  const params = useParams();
  const router = useRouter();
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { branding, loading: brandingLoading } = useBranding();
  
  const clientId = params.id as string;
  const transactionId = params.transactionId as string;
  const tenantId = currentUser?.currentCompanyId;

  // ✅ PATTERN: Use getTenantPath for tenant-aware data fetching
  const clientPath = useMemo(() => 
    (tenantId && clientId) ? getTenantPath(`clients/${clientId}`, tenantId) : null,
    [tenantId, clientId]
  );

  // ✅ PATTERN: Find transaction in both nested and flat collections
  const flatTxPath = useMemo(() => 
    (tenantId && transactionId) ? getTenantPath(`transactions/${transactionId}`, tenantId) : null,
    [tenantId, transactionId]
  );
  const nestedTxPath = useMemo(() => 
    (tenantId && clientId && transactionId) ? getTenantPath(`clients/${clientId}/transactions/${transactionId}`, tenantId) : null,
    [tenantId, clientId, transactionId]
  );

  const { data: client, loading: clientLoading } = useDocument<Client>(firestore, clientPath);
  const { data: flatTransaction, loading: flatTxLoading } = useDocument<ClientTransaction>(firestore, flatTxPath);
  const { data: nestedTransaction, loading: nestedTxLoading } = useDocument<ClientTransaction>(firestore, nestedTxPath);

  // Use the transaction data that is found
  const transaction = flatTransaction || nestedTransaction;

  const isLoading = clientLoading || flatTxLoading || nestedTxLoading || brandingLoading;

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
      return (
          <div className="bg-white p-8 rounded-lg shadow-lg max-w-4xl mx-auto space-y-8">
              <header className="flex justify-between items-center pb-4 border-b">
                  <div className="flex items-center gap-4"><Skeleton className="h-20 w-20 rounded-lg" /><div><Skeleton className="h-6 w-72 mb-2" /><Skeleton className="h-4 w-64" /></div></div>
                  <div className="text-left"><Skeleton className="h-8 w-48 mb-2" /><Skeleton className="h-4 w-24" /></div>
              </header>
              <Skeleton className="h-24 w-full" /><Skeleton className="h-40 w-full" />
          </div>
      );
  }

  if (!client || !transaction) {
      return (
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-4xl mx-auto text-center">
          <h2 className="text-xl font-bold text-destructive">خطأ في تحميل البيانات</h2>
          <p className="text-muted-foreground mt-2">لم يتم العثور على بيانات العميل أو المعاملة. قد لا يكون لديك الصلاحية الكافية لعرض هذه البيانات.</p>
      </div>
      );
  }

  return (
    <div className="printable-wrapper">
        <div className="mb-6 flex justify-end items-center gap-4 no-print">
            <Button variant="outline" onClick={() => router.back()}>
                <ArrowRight className="ml-2 h-4 w-4" />
                العودة
            </Button>
            <Button onClick={handlePrint}><Printer className="ml-2 h-4 w-4" /> تصدير PDF</Button>
        </div>
        <TransactionContract client={client} transaction={transaction} />
    </div>
  );
}
