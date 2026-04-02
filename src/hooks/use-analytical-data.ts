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

const EMPTY_CONSTRAINTS: any[] = [];

/**
 * محرك البيانات التحليلية اللحظي المطور:
 * تم تحصينه بـ "حواجز الحماية" لضمان عدم توقف النظام عند نقص البيانات أو فشل جلب إحدى المجموعات.
 */
export function useAnalyticalData() {
  const { firestore } = useFirebase();

  // جلب كافة المجموعات الأساسية مع دعم القيم الافتراضية الفارغة لتجنب الانهيار
  const { data: journalEntries = [], loading: jesLoading } = useSubscription<JournalEntry>(firestore, 'journalEntries');
  const { data: clients = [], loading: clientsLoading } = useSubscription<Client>(firestore, 'clients');
  const { data: rawTransactions = [], loading: txsLoading } = useSubscription<ClientTransaction>(firestore, 'transactions', EMPTY_CONSTRAINTS, true);
  const { data: employees = [], loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees');
  const { data: departments = [], loading: deptsLoading } = useSubscription<Department>(firestore, 'departments');
  const { data: accounts = [], loading: accountsLoading } = useSubscription<Account>(firestore, 'chartOfAccounts');
  const { data: appointments = [], loading: apptsLoading } = useSubscription<Appointment>(firestore, 'appointments');
  const { data: projects = [], loading: projectsLoading } = useSubscription<ConstructionProject>(firestore, 'projects');
  const { data: rfqs = [], loading: rfqsLoading } = useSubscription<RequestForQuotation>(firestore, 'rfqs');
  const { data: purchaseOrders = [], loading: posLoading } = useSubscription<PurchaseOrder>(firestore, 'purchaseOrders');

  // معالجة البيانات لضمان عدم وجود قيم undefined تكسر الشاشات أثناء الرندرة
  const processedTransactions = useMemo(() => {
    if (!rawTransactions) return [];
    return rawTransactions.map(tx => ({ 
        ...tx,
        clientId: tx.clientId || (tx as any).parentId || '' 
    })) as (ClientTransaction & { clientId: string })[];
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
