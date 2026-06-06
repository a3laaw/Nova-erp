
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
 *
 * *** ⚠️ DISABLED FOR PERFORMANCE AUDIT ⚠️ ***
 * This hook has been temporarily disabled because it was causing major performance issues
 * by fetching too many collections at once. It will be re-enabled after optimization.
 */
export function useAnalyticalData() {
  
  // Return empty data to prevent dashboard from crashing.
  return {
    journalEntries: [],
    clients: [],
    transactions: [],
    employees: [],
    departments: [],
    accounts: [],
    appointments: [],
    projects: [],
    rfqs: [],
    purchaseOrders: [],
    loading: false // Set loading to false immediately
  };
}
