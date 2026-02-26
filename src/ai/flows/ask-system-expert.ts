'use server';
/**
 * @fileOverview خبير النظام الذكي باستخدام Google AI.
 */
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { findNavigationTool } from '@/ai/tools/find-navigation';

const SystemExpertInputSchema = z.object({
  question: z.string().describe("سؤال المستخدم حول النظام أو البيانات."),
  history: z.array(z.object({
    role: z.enum(['user', 'model']),
    content: z.string(),
  })).optional().describe('سجل المحادثة السابقة.'),
});
export type SystemExpertInput = z.infer<typeof SystemExpertInputSchema>;

const SystemExpertOutputSchema = z.object({
  answer: z.string().describe("إجابة الذكاء الاصطناعي."),
});
export type SystemExpertOutput = z.infer<typeof SystemExpertOutputSchema>;

export async function askSystemExpert(input: SystemExpertInput): Promise<SystemExpertOutput> {
    const { question, history } = input;
    const llmHistory = history?.map(msg => ({
      role: msg.role,
      content: [{ text: msg.content }],
    })) || [];
    
    const response = await ai.generate({
      model: 'googleai/gemini-1.5-flash',
      history: llmHistory,
      system: `أنت المساعد الذكي لنظام Nova ERP. مهمتك هي مساعدة المستخدم في استخدام النظام والإجابة على استفساراته حول البيانات.
      - إذا سأل المستخدم عن مديونية عميل، استخدم الأدوات المتاحة.
      - كن مهذباً ومختصراً في إجاباتك باللغة العربية.`,
      prompt: question,
      tools: [findNavigationTool]
    });
    
    return { answer: response.text };
}
