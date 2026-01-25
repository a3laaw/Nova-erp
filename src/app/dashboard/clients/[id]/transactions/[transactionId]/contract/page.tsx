'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useFirebase, useDoc } from '@/firebase';
import { doc, collection, query, getDocs, limit } from 'firebase/firestore';
import { TransactionContract } from '@/components/clients/transaction-contract';
import { Skeleton } from '@/components/ui/skeleton';
import type { Client, ClientTransaction, Company } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Printer, ArrowRight } from 'lucide-react';


export default function TransactionContractPage() {
  const params = useParams();
  const router = useRouter();
  const { firestore } = useFirebase();
  
  const clientId = Array.isArray(params.id) ? params.id[0] : params.id;
  const transactionId = Array.isArray(params.transactionId) ? params.transactionId[0] : params.transactionId;

  const [company, setCompany] = useState<Company | null>(null);
  const [companyLoading, setCompanyLoading] = useState(true);

  const clientRef = useMemo(() => {
      if (!firestore || !clientId) return null;
      return doc(firestore, 'clients', clientId);
  }, [firestore, clientId]);
  
  const transactionRef = useMemo(() => {
      if (!firestore || !clientId || !transactionId) return null;
      return doc(firestore, 'clients', clientId, 'transactions', transactionId);
  }, [firestore, clientId, transactionId]);

  const [clientSnap, clientLoading] = useDoc(clientRef);
  const [transactionSnap, transactionLoading] = useDoc(transactionRef);
  
  useEffect(() => {
    if (!firestore) return;
    const fetchCompany = async () => {
        setCompanyLoading(true);
        try {
            const q = query(collection(firestore, 'companies'), limit(1));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                const companyData = snapshot.docs[0].data() as Company;
                setCompany({ id: snapshot.docs[0].id, ...companyData });
            }
        } catch (error) {
            console.error("Error fetching company data:", error);
        } finally {
            setCompanyLoading(false);
        }
    };
    fetchCompany();
  }, [firestore]);

  const client = useMemo(() => {
      if (clientSnap?.exists()) {
          return { id: clientSnap.id, ...clientSnap.data() } as Client;
      }
      return null;
  }, [clientSnap]);

  const transaction = useMemo(() => {
      if (transactionSnap?.exists()) {
          return { id: transactionSnap.id, ...transactionSnap.data() } as ClientTransaction;
      }
      return null;
  }, [transactionSnap]);

  const isLoading = clientLoading || transactionLoading || companyLoading;
  
  const handlePrint = () => {
    import('html2pdf.js').then(module => {
        const html2pdf = module.default;
        const element = document.getElementById('contract-content');
        if (!element) return;
        const opt = {
          margin:       0.5,
          filename:     `scoop_Contract_${client?.nameAr}_${transaction?.transactionType}.pdf`,
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  { scale: 2, useCORS: true },
          jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().from(element).set(opt).save();
    });
  };

  if (isLoading) {
      return (
          <div className="bg-white p-8 rounded-lg shadow-lg max-w-4xl mx-auto space-y-8">
              <header className="flex justify-between items-center pb-4 border-b">
                  <div className="flex items-center gap-4">
                      <Skeleton className="h-20 w-20 rounded-lg" />
                      <div>
                          <Skeleton className="h-6 w-72 mb-2" />
                          <Skeleton className="h-4 w-64" />
                      </div>
                  </div>
                  <div className="text-left">
                      <Skeleton className="h-8 w-48 mb-2" />
                      <Skeleton className="h-4 w-24" />
                  </div>
              </header>
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-40 w-full" />
          </div>
      );
  }

  if (!client || !transaction) {
      return (
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-4xl mx-auto text-center">
          <h2 className="text-xl font-bold text-destructive">خطأ في تحميل البيانات</h2>
          <p className="text-muted-foreground mt-2">
          لم يتم العثور على بيانات العميل أو المعاملة. يرجى التأكد من صحة الرابط.
          </p>
      </div>
      );
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg max-w-4xl mx-auto" dir="rtl">
        <div className="print:hidden mb-6 flex justify-end items-center no-print">
            <Button onClick={handlePrint}><Printer className="ml-2 h-4 w-4" /> تصدير PDF</Button>
        </div>
        <TransactionContract client={client} transaction={transaction} company={company} />
    </div>
  );
}
