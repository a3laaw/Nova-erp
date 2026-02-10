'use server';
/**
 * @fileOverview A system expert AI that answers questions based on provided documentation and can perform actions.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { findNavigationTool } from '@/ai/tools/find-navigation';
import { firestore } from '@/firebase/server-init';
import { collection, query, where, getDocs } from 'firebase/firestore';

const SystemExpertInputSchema = z.object({
  question: z.string().describe("The user's question about the system."),
  history: z.array(z.object({
    role: z.enum(['user', 'model']),
    content: z.string(),
  })).optional().describe('The previous conversation history.'),
});
export type SystemExpertInput = z.infer<typeof SystemExpertInputSchema>;

const SystemExpertOutputSchema = z.object({
  answer: z.string().describe("The AI's answer to the user's question."),
});
export type SystemExpertOutput = z.infer<typeof SystemExpertOutputSchema>;

// Define the new tool
const getClientDebt = ai.defineTool(
  {
    name: 'getClientDebt',
    description: 'Gets the total outstanding debt for a specific client by their name or file number.',
    inputSchema: z.object({
      clientNameOrNumber: z.string().describe('The name or file number of the client to look up.'),
    }),
    outputSchema: z.object({
      debt: z.number().optional(),
      clientName: z.string().optional(),
      error: z.string().optional(),
    }),
  },
  async ({ clientNameOrNumber }) => {
    if (!firestore) {
      return { error: 'Firestore not initialized.' };
    }

    try {
      const nameQuery = query(collection(firestore, 'clients'), where('nameAr', '==', clientNameOrNumber));
      const fileIdQuery = query(collection(firestore, 'clients'), where('fileId', '==', clientNameOrNumber));

      const [nameSnap, fileIdSnap] = await Promise.all([
        getDocs(nameQuery),
        getDocs(fileIdQuery),
      ]);

      const clientDoc = nameSnap.docs[0] || fileIdSnap.docs[0];

      if (clientDoc) {
        const clientData = clientDoc.data();
        
        // Per the prompt's assumption, we are looking for a 'totalDue' or 'outstandingBalance' field.
        // Since the schema doesn't have it, we'll calculate it based on contract clauses.
        const transactionsQuery = query(collection(firestore, `clients/${clientDoc.id}/transactions`));
        const transactionsSnap = await getDocs(transactionsQuery);

        let totalDue = 0;
        transactionsSnap.forEach(txDoc => {
            const txData = txDoc.data();
            if (txData.contract && Array.isArray(txData.contract.clauses)) {
                txData.contract.clauses.forEach((clause: any) => {
                    if (clause.status === 'مستحقة') {
                        totalDue += clause.amount || 0;
                    }
                });
            }
        });

        return { debt: totalDue, clientName: clientData.nameAr };
      }

      return { error: `لم يتم العثور على عميل بالاسم أو رقم الملف: ${clientNameOrNumber}` };
    } catch (e) {
      console.error(e);
      return { error: 'حدث خطأ أثناء البحث في قاعدة البيانات.' };
    }
  }
);


const systemDocumentation = `
# System Documentation Overview

## Main Features:
- **Accounting**: Chart of Accounts, Journal Entries (with AI assistant), Vouchers (Receipts, Payments), Quotations & Contracts, Financial Statements (IFRS Compliant), Financial Forecast.
- **Appointments**: Dual calendar (Architectural vs. General), smart conflict detection, dynamic color-coding for visits, auto-reconciliation on cancellation, customizable work hours.
- **Appointment Procedures**: Link visits to transactions, update workflow stages, trigger payments, record modifications, write meeting minutes.
- **Human Resources (HR)**: Employee profiles, termination management, audit logs, leave and permission requests, payroll processing, gratuity calculator.
- **Reports**: Delayed tasks, stalled stages, prospective clients (no-shows, follow-ups), upsell opportunities.
- **General System**: User & role management, reference data configuration, notifications.

## Key System Concepts:
- **Clients & Transactions**: Clients have files, and each service for a client is a 'Transaction' (e.g., 'Municipality Design'). Each transaction has its own workflow stages and contract.
- **Smart Calendar**: The system prevents booking conflicts for engineers, clients, and meeting rooms. Architectural appointments have special color-coding and visit counting.
- **Data Integrity**: The system automatically updates related data. E.g., cancelling an appointment re-numbers and re-colors other visits for that client. Completing a work stage can make a contract payment 'due'.
- **AI Assistants**:
    - **Accounting Assistant**: Converts Arabic accounting commands into journal entries.
    - **System Expert (this chatbot)**: Answers questions about system functionality and provides navigation links.
`;

const systemPrompt = \`You are a helpful and friendly system expert for an ERP system. Your capabilities are:
1.  **Answering Questions**: Answer user questions about how to use the system. Use the provided "System Documentation" as your primary source of truth. You can understand and respond in both formal and colloquial Arabic (like Egyptian, Gulf dialects), as well as English. Always respond in the same language as the user's question.
2.  **Performing Actions**: If the user expresses an intent to navigate to a page or perform an action (e.g., "create a new invoice", "I want to see the appointments", "أريد إضافة عميل جديد", "أحجز موعد", "أضيف موظف", "أصدر سند قبض"), you MUST use the 'findNavigation' tool to get the correct link.
3.  **Fetching Live Data**: If the user asks for specific data from the system, like a client's debt (e.g., "كم مديونية العميل محمد؟", "check client balance"), you MUST use the appropriate tool like 'getClientDebt'.

**Behavioral Guidelines:**
- When using tools, present the result clearly and naturally.
- For \`findNavigation\`: present the result as a helpful, clickable link in Markdown format. For example: "بالتأكيد, يمكنك [إضافة عميل جديد من هنا](/dashboard/clients/new)."
- For \`getClientDebt\`: state the debt clearly, e.g., "مديونية العميل محمد علي هي 1,250 د.ك."
- If a tool returns an error (e.g., client not found), inform the user gracefully. For example: "لم أتمكن من العثور على العميل بهذا الاسم. هل يمكنك التحقق من الاسم أو رقم الملف؟"
- If the user's intent is ambiguous, ask for clarification before using a tool or answering.
- Do not invent features, links, or data.
- Always respond in the same language as the user's question.

System Documentation:
---
${systemDocumentation}
---
\`;

export async function askSystemExpert(input: SystemExpertInput): Promise<SystemExpertOutput> {
    const { question, history } = input;
    const llmHistory = history?.map(msg => ({
      role: msg.role,
      content: [{ text: msg.content }],
    })) || [];
    
    const response = await ai.generate({
      history: llmHistory,
      prompt: \`Question: "${question}"\n\nAnswer:\`,
      tools: [findNavigationTool, getClientDebt]
    });
    
    return { answer: response.text };
}

export const systemExpertFlow = ai.defineFlow(
  {
    name: 'systemExpertFlow',
    inputSchema: SystemExpertInputSchema,
    outputSchema: SystemExpertOutputSchema,
    system: systemPrompt,
  },
  askSystemExpert
);
