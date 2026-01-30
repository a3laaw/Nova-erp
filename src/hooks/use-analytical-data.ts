'use client';

import { useState, useEffect } from 'react';
import { useFirebase } from '@/firebase';
import { collection, getDocs, query, collectionGroup } from 'firebase/firestore';
import type { JournalEntry, Client, ClientTransaction, Employee, Department, Account } from '@/lib/types';
import { useToast } from './use-toast';

export function useAnalyticalData() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    journalEntries: JournalEntry[];
    clients: Client[];
    transactions: (ClientTransaction & { clientId: string })[];
    employees: Employee[];
    departments: Department[];
    accounts: Account[];
  }>({
    journalEntries: [],
    clients: [],
    transactions: [],
    employees: [],
    departments: [],
    accounts: [],
  });

  useEffect(() => {
    if (!firestore) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [
          entriesSnap,
          clientsSnap,
          transactionsSnap,
          employeesSnap,
          departmentsSnap,
          accountsSnap
        ] = await Promise.all([
          getDocs(query(collection(firestore, 'journalEntries'))),
          getDocs(query(collection(firestore, 'clients'))),
          getDocs(query(collectionGroup(firestore, 'transactions'))),
          getDocs(query(collection(firestore, 'employees'))),
          getDocs(query(collection(firestore, 'departments'))),
          getDocs(query(collection(firestore, 'chartOfAccounts'))),
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
        });
      } catch (error) {
        console.error("Error fetching analytical data:", error);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب البيانات التحليلية.' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [firestore, toast]);

  return { ...data, loading };
}
