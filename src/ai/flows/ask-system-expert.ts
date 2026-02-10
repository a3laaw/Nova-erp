'use server';
/**
 * @fileOverview A system expert AI that answers questions based on provided documentation.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const SystemExpertInputSchema = z.object({
  question: z.string().describe('The user\'s question about the system.'),
  history: z.array(z.object({
    role: z.enum(['user', 'model']),
    content: z.string(),
  })).optional().describe('The previous conversation history.'),
});
export type SystemExpertInput = z.infer<typeof SystemExpertInputSchema>;

const SystemExpertOutputSchema = z.object({
  answer: z.string().describe('The AI\'s answer to the user\'s question.'),
});
export type SystemExpertOutput = z.infer<typeof SystemExpertOutputSchema>;

// This is where you would ideally load the documentation from files.
// Since we can't do that in this environment, we'll paste the content directly.
const systemDocumentation = `
# System Documentation

## Accounting Features (docs/accounting-features.md)
${docs.accounting-features.md}

## Appointment Details Features (docs/appointment-details-features.md)
${docs/appointment-details-features.md}

## Appointments Features (docs/appointments-features.md)
${docs/appointments-features.md}

## Cash Receipts Features (docs/cash-receipts-features.md)
${docs/cash-receipts-features.md}

## HR Features (docs/hr-features.md)
${docs/hr-features.md}

## Reports Logic (docs/reports-logic.md)
${docs/reports-logic.md}

## System Overview (docs/system_overview_ar.md)
${docs/system_overview_ar.md}
`;


export async function askSystemExpert(input: SystemExpertInput): Promise<SystemExpertOutput> {
  return systemExpertFlow(input);
}

const systemExpertFlow = ai.defineFlow(
  {
    name: 'systemExpertFlow',
    inputSchema: SystemExpertInputSchema,
    outputSchema: SystemExpertOutputSchema,
  },
  async ({ question, history }) => {
    const llm = ai.model('googleai/gemini-2.5-flash');

    const prompt = `أنت مساعد ذكي وخبير في نظام ERP. وظيفتك هي الإجابة على أسئلة الموظفين حول كيفية استخدام النظام.
    استخدم المستندات التالية كمصدر أساسي لمعلوماتك. أجب باللغة العربية بأسلوب واضح ومباشر.

    System Documentation:
    ---
    ${systemDocumentation}
    ---

    Question: "${question}"
    
    Answer:`;

    const llmHistory = history?.map(msg => ({
      role: msg.role,
      content: [{ text: msg.content }],
    })) || [];


    const response = await llm.generate({
      history: llmHistory,
      prompt: prompt,
    });

    return { answer: response.text };
  }
);
