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

// Define the tool
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
# ... (same content)
`;

const systemPrompt = `You are a helpful and friendly system expert for an ERP system. Always use 'googleai/gemini-1.5-flash' for your responses.`;

export async function askSystemExpert(input: SystemExpertInput): Promise<SystemExpertOutput> {
    const { question, history } = input;
    const llmHistory = history?.map(msg => ({
      role: msg.role,
      content: [{ text: msg.content }],
    })) || [];
    
    const response = await ai.generate({
      model: 'googleai/gemini-1.5-flash',
      history: llmHistory,
      prompt: `Question: "${question}"\n\nAnswer:`,
      tools: [findNavigationTool, getClientDebt]
    });
    
    return { answer: response.text };
}

export const systemExpertFlow = ai.defineFlow(
  {
    name: 'systemExpertFlow',
    inputSchema: SystemExpertInputSchema,
    outputSchema: SystemExpertOutputSchema,
  },
  askSystemExpert
);
