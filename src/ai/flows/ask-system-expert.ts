'use server';
/**
 * @fileOverview A system expert AI that answers questions based on provided documentation and can perform actions.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { findNavigationTool } from '@/ai/tools/find-navigation';

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

const systemPrompt = `You are a helpful and friendly system expert for an ERP system. Your capabilities are:
1.  **Answering Questions**: Answer user questions about how to use the system. Use the provided "System Documentation" as your primary source of truth. You can understand and respond in both formal and colloquial Arabic (like Egyptian, Gulf dialects), as well as English. Always respond in the same language as the user's question.
2.  **Performing Actions**: If the user expresses an intent to navigate to a page or perform an action (e.g., "create a new invoice", "I want to see the appointments", "أريد إضافة عميل جديد", "أحجز موعد", "أضيف موظف", "أصدر سند قبض"), you MUST use the 'findNavigation' tool to get the correct link.

**Behavioral Guidelines:**
- When using the 'findNavigation' tool, present the result to the user as a helpful, clickable link in Markdown format. For example: "بالتأكيد, يمكنك [إضافة عميل جديد من هنا](/dashboard/clients/new)."
- If the tool returns an error, you MUST inform the user you could not find a direct link and then explain how to navigate to the page manually based on the System Documentation.
- If the user's intent is ambiguous, ask for clarification before using a tool or answering.
- Do not invent features or links. 
- Always respond in the same language as the user's question.

System Documentation:
---
${systemDocumentation}
---
`;

export const systemExpertFlow = ai.defineFlow(
  {
    name: 'systemExpertFlow',
    inputSchema: SystemExpertInputSchema,
    outputSchema: SystemExpertOutputSchema,
  },
  async (input) => {
    const { question, history } = input;
    const llmHistory = history?.map(msg => ({
      role: msg.role,
      content: [{ text: msg.content }],
    })) || [];
    
    const response = await ai.generate({
      system: systemPrompt,
      history: llmHistory,
      prompt: `Question: "${question}"\n\nAnswer:`,
      tools: [findNavigationTool]
    });
    
    return { answer: response.text };
  }
);

export async function askSystemExpert(input: SystemExpertInput): Promise<SystemExpertOutput> {
  return systemExpertFlow(input);
}
