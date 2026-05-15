'use client';

import { useMemo } from 'react';
import { useFirebase } from '@/firebase';
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

const EMPTY_CONSTRAINTS: any[] = [];

/**
 * محرك البيانات التحليلية اللحظي المطور (V66.0):
 * تم تحصينه بـ "حواجز الحماية" لمنع طلب البيانات قبل استقرار هوية المنشأة.
 */
export function useAnalyticalData() {
  const { firestore } = useFirebase();
  const { user, loading: authLoading } = useAuth();

  // 🛡️ صمام أمان سيادي: لا تبدأ جلب البيانات إلا بعد استقرار هوية المنشأة (Tenant ID)
  const tenantId = user?.currentCompanyId;
  const canFetch = !!firestore && !!tenantId;

  const { data: journalEntries = [], loading: jesLoading } = useSubscription<JournalEntry>(firestore, canFetch ? 'journalEntries' : null);
  const { data: clients = [], loading: clientsLoading } = useSubscription<Client>(firestore, canFetch ? 'clients' : null);
  
  // 🛡️ معالجة معاملات العملاء (Collection Group) بفلترة الشركة إجبارياً
  const { data: rawTransactions = [], loading: txsLoading } = useSubscription<ClientTransaction>(
      firestore, 
      canFetch ? 'transactions' : null, 
      EMPTY_CONSTRAINTS, 
      true
  );

  const { data: employees = [], loading: employeesLoading } = useSubscription<Employee>(firestore, canFetch ? 'employees' : null);
  const { data: departments = [], loading: deptsLoading } = useSubscription<Department>(firestore, canFetch ? 'departments' : null);
  const { data: accounts = [], loading: accountsLoading } = useSubscription<Account>(firestore, canFetch ? 'chartOfAccounts' : null);
  const { data: appointments = [], loading: apptsLoading } = useSubscription<Appointment>(firestore, canFetch ? 'appointments' : null);
  const { data: projects = [], loading: projectsLoading } = useSubscription<ConstructionProject>(firestore, canFetch ? 'projects' : null);
  const { data: rfqs = [], loading: rfqsLoading } = useSubscription<RequestForQuotation>(firestore, canFetch ? 'rfqs' : null);
  const { data: purchaseOrders = [], loading: posLoading } = useSubscription<PurchaseOrder>(firestore, canFetch ? 'purchaseOrders' : null);

  const processedTransactions = useMemo(() => {
    if (!rawTransactions) return [];
    return rawTransactions.map(tx => ({ 
        ...tx,
        clientId: tx.clientId || (tx as any).parentId || '' 
    })) as (ClientTransaction & { clientId: string })[];
  }, [rawTransactions]);

  const loading = 
    authLoading || 
    (canFetch && (jesLoading || clientsLoading || txsLoading || employeesLoading || deptsLoading || accountsLoading || apptsLoading || projectsLoading || rfqsLoading || posLoading));

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
