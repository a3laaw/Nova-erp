'use client';

import { useMemo } from 'react';
import { useFirebase } from '@/firebase/index.tsx';
import { useSubscription } from './use-subscription';
import { useAuth } from '@/context/auth-context';
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
 * محرك البيانات التحليلية اللحظي المطور (V66.1):
 * تم تحويل المعاملات لتكون مسطحة (Flat Collection) لتجنب أخطاء الفهارس المركبة.
 */
export function useAnalyticalData() {
  const { firestore } = useFirebase();
  const { user, loading: authLoading } = useAuth();

  const tenantId = user?.currentCompanyId;
  const canFetch = !!firestore && !!tenantId;

  const { data: journalEntries = [], loading: jesLoading } = useSubscription<JournalEntry>(firestore, canFetch ? 'journalEntries' : null);
  const { data: clients = [], loading: clientsLoading } = useSubscription<Client>(firestore, canFetch ? 'clients' : null);
  
  // 🛡️ استخدام المسار المسطح للمعاملات لضمان عدم الحاجة لفهارس Collection Group
  const { data: transactions = [], loading: txsLoading } = useSubscription<ClientTransaction>(
      firestore, 
      canFetch ? 'transactions' : null
  );

  const { data: employees = [], loading: employeesLoading } = useSubscription<Employee>(firestore, canFetch ? 'employees' : null);
  const { data: departments = [], loading: deptsLoading } = useSubscription<Department>(firestore, canFetch ? 'departments' : null);
  const { data: accounts = [], loading: accountsLoading } = useSubscription<Account>(firestore, canFetch ? 'chartOfAccounts' : null);
  const { data: appointments = [], loading: apptsLoading } = useSubscription<Appointment>(firestore, canFetch ? 'appointments' : null);
  const { data: projects = [], loading: projectsLoading } = useSubscription<ConstructionProject>(firestore, canFetch ? 'projects' : null);
  const { data: rfqs = [], loading: rfqsLoading } = useSubscription<RequestForQuotation>(firestore, canFetch ? 'rfqs' : null);
  const { data: purchaseOrders = [], loading: posLoading } = useSubscription<PurchaseOrder>(firestore, canFetch ? 'purchaseOrders' : null);

  const loading = 
    authLoading || 
    (canFetch && (jesLoading || clientsLoading || txsLoading || employeesLoading || deptsLoading || accountsLoading || apptsLoading || projectsLoading || rfqsLoading || posLoading));

  return { 
    journalEntries,
    clients,
    transactions,
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
