'use server';

/**
 * @fileOverview A data-driven cash flow projection engine.
 *
 * - runCashFlowProjection - A function to project cash flow for future months.
 * - CashFlowProjectionInput - The input type for the function.
 * - CashFlowProjectionOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { getFirebaseServices } from '@/firebase/init';
import { addMonths, format, startOfMonth } from 'date-fns';
import type { Client, ClientTransaction, Employee } from '@/lib/types';


const CashFlowProjectionInputSchema = z.object({
  months: z.number().int().positive().describe('The number of future months to project.'),
});
export type CashFlowProjectionInput = z.infer<typeof CashFlowProjectionInputSchema>;

const MonthlyProjectionSchema = z.object({
  month: z.string().describe('The month in YYYY-MM format.'),
  monthName: z.string().describe('The formatted month name (e.g., July 2024).'),
  expectedRevenue: z.number().describe('Total expected revenue from contract milestones.'),
  fixedExpenses: z.number().describe('Total fixed monthly expenses (salaries, rent, etc.).'),
  netCashFlow: z.number().describe('The net cash flow for the month (revenue - expenses).'),
});
export type MonthlyProjection = z.infer<typeof MonthlyProjectionSchema>;


const CashFlowProjectionOutputSchema = z.object({
  projections: z.array(MonthlyProjectionSchema),
  assumptions: z.object({
    fixedRent: z.number(),
    totalSalaries: z.number(),
    employeeCount: z.number(),
  }),
});
export type CashFlowProjectionOutput = z.infer<typeof CashFlowProjectionOutputSchema>;


export async function runCashFlowProjection(input: CashFlowProjectionInput): Promise<CashFlowProjectionOutput> {
  const firebaseServices = getFirebaseServices();
  if (!firebaseServices) {
    throw new Error('Firebase is not initialized.');
  }
  const { firestore } = firebaseServices;

  // 1. Prepare date ranges
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

  // 2. Fetch all active contracts
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

  // 3. Initialize projection data structure
  const monthlyProjections: Record<string, { expectedRevenue: number, fixedExpenses: number, netCashFlow: number }> = {};
  projectionMonths.forEach(m => {
    monthlyProjections[m.key] = { expectedRevenue: 0, fixedExpenses: 0, netCashFlow: 0 };
  });

  // 4. Aggregate future revenues from contract milestones
  clientsWithContracts.forEach(({ transactions }) => {
      transactions.forEach(tx => {
          tx.contract?.clauses?.forEach(clause => {
              // We only consider milestones that are due but not yet paid
              if (clause.status === 'مستحقة' || clause.status === 'غير مستحقة') {
                   // This logic assumes milestone 'name' can be parsed into a date or is linked to a stage with a date.
                   // For now, let's assume a simplified logic where we estimate the due date.
                   // A proper implementation would use a `dueDate` on the clause.
                   // For this MVP, we will distribute them evenly as a placeholder.
                   // Let's find the stage linked to the condition
                   const stage = tx.stages?.find(s => s.name === clause.condition);
                   let dueDate: Date | null = null;
                   if (stage?.expectedEndDate) {
                       dueDate = (stage.expectedEndDate as any).toDate();
                   } else if (stage?.startDate) {
                       // Estimate based on start date + 30 days if no end date
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
  
  // 5. Calculate fixed expenses
  const employeesSnap = await getDocs(query(collection(firestore, 'employees'), where('status', '==', 'active')));
  const totalSalaries = employeesSnap.docs.reduce((sum, doc) => {
      const emp = doc.data() as Employee;
      return sum + (emp.basicSalary || 0) + (emp.housingAllowance || 0) + (emp.transportAllowance || 0);
  }, 0);
  const fixedRent = 1500; // Hardcoded for now. Should be fetched from chart of accounts.
  const totalFixedExpenses = totalSalaries + fixedRent;

  // 6. Finalize projections
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
