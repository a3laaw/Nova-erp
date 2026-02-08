'use client';

import { useFirebase } from '@/firebase';
import { collection, getDocs, query, collectionGroup } from 'firebase/firestore';
import type { JournalEntry, Client, ClientTransaction, Employee, Department, Account, Appointment } from '@/lib/types';
import { useToast } from './use-toast';
import { useSmartCache } from './use-smart-cache';

// The shape of the data that the hook will return
interface AnalyticalData {
    journalEntries: JournalEntry[];
    clients: Client[];
    transactions: (ClientTransaction & { clientId: string })[];
    employees: Employee[];
    departments: Department[];
    accounts: Account[];
    appointments: Appointment[];
}

export function useAnalyticalData() {
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const fetchAnalyticalData = async (): Promise<AnalyticalData> => {
    if (!firestore) {
      throw new Error("Firestore is not available.");
    }
    
    try {
        const [
          entriesSnap,
          clientsSnap,
          transactionsSnap,
          employeesSnap,
          departmentsSnap,
          accountsSnap,
          appointmentsSnap
        ] = await Promise.all([
          getDocs(query(collection(firestore, 'journalEntries'))),
          getDocs(query(collection(firestore, 'clients'))),
          getDocs(query(collectionGroup(firestore, 'transactions'))),
          getDocs(query(collection(firestore, 'employees'))),
          getDocs(query(collection(firestore, 'departments'))),
          getDocs(query(collection(firestore, 'chartOfAccounts'))),
          getDocs(query(collection(firestore, 'appointments'))),
        ]);
        
        const transactions = transactionsSnap.docs.map(doc => {
            const pathSegments = doc.ref.path.split('/');
            const clientId = pathSegments[pathSegments.length - 3];
            return { id: doc.id, clientId, ...doc.data() } as ClientTransaction & { clientId: string };
        });

        return {
          journalEntries: entriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as JournalEntry)),
          clients: clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)),
          transactions,
          employees: employeesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)),
          departments: departmentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)),
          accounts: accountsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)),
          appointments: appointmentsSnap.docs.map(doc => ({id: doc.id, ...doc.data()} as Appointment)),
        };
    } catch (error) {
        console.error("Error fetching analytical data:", error);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب البيانات التحليلية.' });
        // Re-throw to be caught by useSmartCache
        throw error;
    }
  };
  
  // Use the smart cache hook to manage fetching and caching
  const { data, loading, error } = useSmartCache<AnalyticalData>(
    'analytical_data_cache', // Unique key for this data
    fetchAnalyticalData,
    10 * 60 * 1000 // Cache for 10 minutes
  );

  return { 
    journalEntries: data?.journalEntries || [],
    clients: data?.clients || [],
    transactions: data?.transactions || [],
    employees: data?.employees || [],
    departments: data?.departments || [],
    accounts: data?.accounts || [],
    appointments: data?.appointments || [],
    loading, 
    error 
  };
}
