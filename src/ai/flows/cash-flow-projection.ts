'use server';

/**
 * @fileOverview A data-driven cash flow projection engine.
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import { firestore } from '@/firebase/server-init';
import { addMonths, format } from 'date-fns';
import type { Client, ClientTransaction, Employee } from '@/lib/types';

export async function runCashFlowProjection(input: { months: number }) {
  if (!firestore) {
    throw new Error('Firebase is not initialized.');
  }

  const today = new Date();
  const projectionMonths: { year: number, month: number, key: string, name: string }[] = [];
  for (let i = 0; i < input.months; i++) {
    const targetDate = addMonths(today, i);
    projectionMonths.push({
        year: targetDate.getFullYear(),
        month: targetDate.getMonth() + 1,
        key: format(targetDate, 'yyyy-MM'),
        name: format(targetDate, 'MMMM yyyy'),
    });
  }

  const clientsWithContracts: { client: Client, transactions: ClientTransaction[] }[] = [];
  const clientsSnap = await getDocs(query(collection(firestore, 'clients'), where('status', 'in', ['contracted', 'reContracted'])));
  
  for (const clientDoc of clientsSnap.docs) {
      const clientData = { id: clientDoc.id, ...clientDoc.data() } as Client;
      const transactionsSnap = await getDocs(query(collection(firestore, `clients/${clientDoc.id}/transactions`), where('contract', '!=', null)));
      if (!transactionsSnap.empty) {
          clientsWithContracts.push({
              client: clientData,
              transactions: transactionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClientTransaction)),
          });
      }
  }

  const monthlyProjections: Record<string, { expectedRevenue: number, fixedExpenses: number, netCashFlow: number }> = {};
  projectionMonths.forEach(m => {
    monthlyProjections[m.key] = { expectedRevenue: 0, fixedExpenses: 0, netCashFlow: 0 };
  });

  clientsWithContracts.forEach(({ transactions }) => {
      transactions.forEach(tx => {
          tx.contract?.clauses?.forEach(clause => {
              if (clause.status === 'مستحقة' || clause.status === 'غير مستحقة') {
                   const stage = tx.stages?.find(s => s.name === clause.condition);
                   let dueDate: Date | null = null;
                   
                   if (stage?.expectedEndDate) {
                       dueDate = (stage.expectedEndDate as any).toDate();
                   } else if (stage?.startDate) {
                       dueDate = new Date((stage.startDate as any).toDate());
                       dueDate.setDate(dueDate.getDate() + 30);
                   }

                   if(dueDate) {
                       const monthKey = format(dueDate, 'yyyy-MM');
                       if (monthlyProjections[monthKey]) {
                           monthlyProjections[monthKey].expectedRevenue += clause.amount;
                       }
                   }
              }
          });
      });
  });
  
  const employeesSnap = await getDocs(query(collection(firestore, 'employees'), where('status', '==', 'active')));
  const totalSalaries = employeesSnap.docs.reduce((sum, doc) => {
      const emp = doc.data() as Employee;
      return sum + (emp.basicSalary || 0) + (emp.housingAllowance || 0) + (emp.transportAllowance || 0);
  }, 0);
  const fixedRent = 1500; 
  const totalFixedExpenses = totalSalaries + fixedRent;

  const finalProjections = projectionMonths.map(m => {
    const projection = monthlyProjections[m.key];
    projection.fixedExpenses = totalFixedExpenses;
    projection.netCashFlow = projection.expectedRevenue - projection.fixedExpenses;
    return {
      month: m.key,
      monthName: m.name,
      ...projection
    };
  });
  
  return {
      projections: finalProjections,
      assumptions: {
          fixedRent,
          totalSalaries,
          employeeCount: employeesSnap.size,
      },
  };
}
