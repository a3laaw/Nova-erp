'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useFirebase, useDoc } from '@/firebase';
import { doc, getDocs, collection, query, limit } from 'firebase/firestore';
import { ContractForm } from '@/components/contract/ContractForm';
import { Skeleton } from '@/components/ui/skeleton';
import type { Company } from '@/lib/types';

export default function ContractPage() {
  const params = useParams();
  const { firestore } = useFirebase();
  
  const clientRef = useMemo(() => {
    if (!firestore || !params.clientId) return null;
    return doc(firestore, 'clients', params.clientId as string);
  }, [firestore, params.clientId]);

  const [clientSnap, loading, error] = useDoc(clientRef);
  const [company, setCompany] = useState<Company | null>(null);
  const [companyLoading, setCompanyLoading] = useState(true);

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
        return clientSnap.data();
    }
    return null;
  }, [clientSnap]);


  if (loading || companyLoading) {
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

  if (error || !client) {
    return (
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-4xl mx-auto text-center">
        <h2 className="text-xl font-bold text-destructive">خطأ في تحميل البيانات</h2>
        <p className="text-muted-foreground mt-2">
          {error ? error.message : 'لم يتم العثور على بيانات العميل. يرجى التأكد من صحة الرابط.'}
        </p>
      </div>
    );
  }

  return <ContractForm client={client} company={company} />;
}
