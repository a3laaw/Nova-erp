
'use client';

import { useState, useEffect } from 'react';
import { useFirebase } from '@/firebase';
import { collection, getDocs, query, collectionGroup } from 'firebase/firestore';
import type { JournalEntry, Client, ClientTransaction, Employee, Department, Account, Appointment, ConstructionProject, RequestForQuotation, PurchaseOrder } from '@/lib/types';
import { useToast } from './use-toast';

interface AnalyticalData {
    journalEntries: JournalEntry[];
    clients: Client[];
    transactions: (ClientTransaction & { clientId: string })[];
    employees: Employee[];
    departments: Department[];
    accounts: Account[];
    appointments: Appointment[];
    projects: ConstructionProject[];
    rfqs: RequestForQuotation[];
    purchaseOrders: PurchaseOrder[];
}

/**
 * خطاف (Hook) لجلب لقطة شاملة من البيانات للتقارير ولوحة التحكم.
 * تم تحديثه ليشمل المشاريع وأوامر الشراء لدعم الإحصائيات الحقيقية.
 */
export function useAnalyticalData() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [data, setData] = useState<AnalyticalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    const fetchData = async () => {
        if (!firestore) {
          setLoading(false);
          return;
        }
        setLoading(true);
        setError(null);
        try {
            const [
              entriesSnap,
              clientsSnap,
              transactionsSnap,
              employeesSnap,
              departmentsSnap,
              accountsSnap,
              appointmentsSnap,
              projectsSnap,
              rfqsSnap,
              posSnap
            ] = await Promise.all([
              getDocs(query(collection(firestore, 'journalEntries'))),
              getDocs(query(collection(firestore, 'clients'))),
              getDocs(query(collectionGroup(firestore, 'transactions'))),
              getDocs(query(collection(firestore, 'employees'))),
              getDocs(query(collection(firestore, 'departments'))),
              getDocs(query(collection(firestore, 'chartOfAccounts'))),
              getDocs(query(collection(firestore, 'appointments'))),
              getDocs(query(collection(firestore, 'projects'))),
              getDocs(query(collection(firestore, 'rfqs'))),
              getDocs(query(collection(firestore, 'purchaseOrders'))),
            ]);
            
            const transactions = transactionsSnap.docs.map(doc => {
                const pathSegments = doc.ref.path.split('/');
                const clientId = pathSegments[pathSegments.length - 3];
                return { id: doc.id, clientId, ...doc.data() } as ClientTransaction & { clientId: string };
            });

            setData({
              journalEntries: entriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as JournalEntry)),
              clients: clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)),
              transactions,
              employees: employeesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)),
              departments: departmentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)),
              accounts: accountsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)),
              appointments: appointmentsSnap.docs.map(doc => ({id: doc.id, ...doc.data()} as Appointment)),
              projects: projectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ConstructionProject)),
              rfqs: rfqsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RequestForQuotation)),
              purchaseOrders: posSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseOrder)),
            });
        } catch (err: any) {
            console.error("Error fetching analytical data:", err);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب البيانات التحليلية.' });
            setError(err);
        } finally {
          setLoading(false);
        }
    };

    fetchData();
  }, [firestore, toast]);
  
  return { 
    journalEntries: data?.journalEntries || [],
    clients: data?.clients || [],
    transactions: data?.transactions || [],
    employees: data?.employees || [],
    departments: data?.departments || [],
    accounts: data?.accounts || [],
    appointments: data?.appointments || [],
    projects: data?.projects || [],
    rfqs: data?.rfqs || [],
    purchaseOrders: data?.purchaseOrders || [],
    loading, 
    error 
  };
}
