'use client';

import { useMemo } from 'react';
import { useFirebase } from '@/firebase';
import { useSubscription } from './use-subscription';
import type { 
    JournalEntry, 
    Client, 
    ClientTransaction, 
    Employee, 
    Department, 
    Account, 
    Appointment, 
    ConstructionProject, 
    RequestForQuotation, 
    PurchaseOrder 
} from '@/lib/types';

/**
 * محرك البيانات التحليلية اللحظي (The Real-time Analytical Engine):
 * يقوم بربط كافة جداول النظام ببعضها البعض وتوفير لقطة حية ومحدثة للوحة التحكم.
 * التغييرات في أي مكان في النظام تظهر هنا فوراً بدون إعادة تحميل.
 */
export function useAnalyticalData() {
  const { firestore } = useFirebase();

  // جلب كافة المجموعات المطلوبة بشكل متزامن ولحظي
  const { data: journalEntries, loading: jesLoading } = useSubscription<JournalEntry>(firestore, 'journalEntries');
  const { data: clients, loading: clientsLoading } = useSubscription<Client>(firestore, 'clients');
  const { data: rawTransactions, loading: txsLoading } = useSubscription<ClientTransaction>(firestore, 'transactions', [], true);
  const { data: employees, loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees');
  const { data: departments, loading: deptsLoading } = useSubscription<Department>(firestore, 'departments');
  const { data: accounts, loading: accountsLoading } = useSubscription<Account>(firestore, 'chartOfAccounts');
  const { data: appointments, loading: apptsLoading } = useSubscription<Appointment>(firestore, 'appointments');
  const { data: projects, loading: projectsLoading } = useSubscription<ConstructionProject>(firestore, 'projects');
  const { data: rfqs, loading: rfqsLoading } = useSubscription<RequestForQuotation>(firestore, 'rfqs');
  const { data: purchaseOrders, loading: posLoading } = useSubscription<PurchaseOrder>(firestore, 'purchaseOrders');

  // معالجة المعاملات لاستخراج معرف العميل من مسار المستند (لأنها Collection Group)
  const processedTransactions = useMemo(() => {
    if (!rawTransactions) return [];
    return rawTransactions.map(tx => {
        // في الـ Collection Group، نحصل على الـ clientId من الكائن نفسه (المخزن عند الإنشاء)
        return { ...tx } as ClientTransaction & { clientId: string };
    });
  }, [rawTransactions]);

  const loading = 
    jesLoading || clientsLoading || txsLoading || 
    employeesLoading || deptsLoading || accountsLoading || 
    apptsLoading || projectsLoading || rfqsLoading || posLoading;

  return { 
    journalEntries,
    clients,
    transactions: processedTransactions,
    employees,
    departments,
    accounts,
    appointments,
    projects,
    rfqs,
    purchaseOrders,
    loading 
  };
}
