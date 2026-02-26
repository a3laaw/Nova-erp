'use server';

/**
 * @fileOverview المساعد المحاسبي الذكي.
 * يحول الأوامر النصية العربية إلى قيود يومية وسندات منظمة.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AccountingAssistantInputSchema = z.object({
  command: z.string().describe('الأمر النصي من المستخدم'),
  currentDate: z.string().describe('التاريخ الحالي بصيغة YYYY-MM-DD')
});

const AccountingAssistantOutputSchema = z.object({
  command: z.string().describe("اسم العملية البرمجية"),
  payload: z.any().describe("البيانات المنظمة للعملية"),
  explanation: z.string().describe("شرح بالعربية لما سيتم تنفيذه"),
  warnings: z.array(z.string()).describe("تحذيرات أو افتراضات")
});

export type AccountingAssistantInput = z.infer<typeof AccountingAssistantInputSchema>;
export type AccountingAssistantOutput = z.infer<typeof AccountingAssistantOutputSchema>;

export async function runAccountingAssistant(input: AccountingAssistantInput): Promise<AccountingAssistantOutput> {
  const { output } = await ai.generate({
    model: 'googleai/gemini-1.5-flash',
    system: `أنت مساعد محاسبي خبير في نظام ERP. 
    مهمتك تحويل طلبات المستخدم إلى JSON منظم.
    الأوامر المدعومة: create_journal_entry, create_receipt_voucher, create_payment_voucher.
    التزم دائماً بالقيد المزدوج (Debit = Credit).`,
    prompt: `التاريخ اليوم: ${input.currentDate}. نفذ الأمر التالي: ${input.command}`,
    output: { format: 'json', schema: AccountingAssistantOutputSchema }
  });

  if (!output) throw new Error('تعذر معالجة الطلب من قبل الذكاء الاصطناعي');
  return output;
}
