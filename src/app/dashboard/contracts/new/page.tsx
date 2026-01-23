'use client';

import { useEffect, useState } from 'react';
import { useFirebase } from '@/firebase';
import { collection, getDocs, query, limit, orderBy, where } from 'firebase/firestore';
import { ContractForm } from '@/components/contract/ContractForm';
import { Skeleton } from '@/components/ui/skeleton';
import type { Company, Client } from '@/lib/types';

export default function NewContractPage() {
  const { firestore } = useFirebase();
  
  const [clients, setClients] = useState<Client[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firestore) return;
    const fetchData = async () => {
        setLoading(true);
        try {
            const companyQuery = query(collection(firestore, 'companies'), limit(1));
            const clientsQuery = query(collection(firestore, 'clients'), where('isActive', '==', true));

            const [companySnap, clientsSnap] = await Promise.all([
                getDocs(companyQuery),
                getDocs(clientsQuery)
            ]);
            
            if (!companySnap.empty) {
                const companyData = companySnap.docs[0].data() as Company;
                setCompany({ id: companySnap.docs[0].id, ...companyData });
            }

            const fetchedClients = clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
            fetchedClients.sort((a, b) => a.nameAr.localeCompare(b.nameAr));
            setClients(fetchedClients);

        } catch (error) {
            console.error("Error fetching initial data for contract:", error);
        } finally {
            setLoading(false);
        }
    };
    fetchData();
  }, [firestore]);

  if (loading) {
    return (
        <div className="bg-background p-8 rounded-lg max-w-5xl mx-auto space-y-8">
            <Skeleton className="h-10 w-1/3 mb-8" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
        </div>
    );
  }

  return <ContractForm clients={clients} company={company} />;
}
