
'use client';

import { useMemo } from 'react';
import { useFirebase } from '@/firebase/index.tsx';
import { useSubscription } from './use-subscription';
import { useAuth } from '@/context/auth-context';
import { where, type QueryConstraint } from 'firebase/firestore';
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
 * محرك البيانات التحليلية اللحظي المطور (V67.0):
 * تم إضافة "درع الرؤية السيادي"؛ المهندس يرى فقط المعاملات والمشاريع المسندة إليه.
 * الإدارة والمحاسبة والـ HR والسكرتارية تملك رؤية شاملة.
 */
export function useAnalyticalData() {
  const { firestore } = useFirebase();
  const { user, loading: authLoading } = useAuth();

  const tenantId = user?.currentCompanyId;
  const canFetch = !!firestore && !!tenantId;

  // فحص الصلاحيات السيادية (استثناء الأقسام العاملة)
  const isPrivileged = useMemo(() => 
    ['Admin', 'Accountant', 'HR', 'Secretary', 'Developer'].includes(user?.role || '')
  , [user?.role]);

  const { data: journalEntries = [], loading: jesLoading } = useSubscription<JournalEntry>(firestore, canFetch ? 'journalEntries' : null);
  const { data: clients = [], loading: clientsLoading } = useSubscription<Client>(firestore, canFetch ? 'clients' : null);
  
  // 🛡️ رادار تصفية المعاملات بناءً على الإسناد 🛡️
  const txConstraints = useMemo(() => {
    const base: QueryConstraint[] = [];
    if (!isPrivileged && user?.employeeId) {
        base.push(where('assignedEngineerId', '==', user.employeeId));
    }
    return base;
  }, [isPrivileged, user?.employeeId]);

  const { data: transactions = [], loading: txsLoading } = useSubscription<ClientTransaction>(
      firestore, 
      canFetch ? 'transactions' : null,
      txConstraints
  );

  const { data: employees = [], loading: employeesLoading } = useSubscription<Employee>(firestore, canFetch ? 'employees' : null);
  const { data: departments = [], loading: deptsLoading } = useSubscription<Department>(firestore, canFetch ? 'departments' : null);
  const { data: accounts = [], loading: accountsLoading } = useSubscription<Account>(firestore, canFetch ? 'chartOfAccounts' : null);
  const { data: appointments = [], loading: apptsLoading } = useSubscription<Appointment>(firestore, canFetch ? 'appointments' : null);
  
  // 🛡️ تصفية المشاريع التنفيذية أيضاً للمهندسين 🛡️
  const prjConstraints = useMemo(() => {
    const base: QueryConstraint[] = [];
    if (!isPrivileged && user?.employeeId) {
        base.push(where('mainEngineerId', '==', user.employeeId));
    }
    return base;
  }, [isPrivileged, user?.employeeId]);

  const { data: projects = [], loading: projectsLoading } = useSubscription<ConstructionProject>(firestore, canFetch ? 'projects' : null, prjConstraints);
  
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
