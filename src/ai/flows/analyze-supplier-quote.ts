'use server';
/**
 * @fileOverview AI flow to analyze supplier quote documents and extract unit prices.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AnalyzeQuoteInputSchema = z.object({
  quoteFileDataUri: z.string().describe("The quote document as a data URI. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
  rfqItems: z.array(z.object({
    id: z.string(),
    name: z.string()
  })).describe("The list of items we are looking for in the supplier's quote."),
});
export type AnalyzeQuoteInput = z.infer<typeof AnalyzeQuoteInputSchema>;

const AnalyzeQuoteOutputSchema = z.object({
  extractedPrices: z.array(z.object({
    rfqItemId: z.string(),
    unitPrice: z.number().describe("The extracted unit price."),
    confidence: z.number().describe("Confidence score between 0 and 1.")
  })),
  notes: z.string().optional().describe("Any warnings or notes."),
});
export type AnalyzeQuoteOutput = z.infer<typeof AnalyzeQuoteOutputSchema>;

const prompt = ai.definePrompt({
  name: 'analyzeSupplierQuotePrompt',
  input: { schema: AnalyzeQuoteInputSchema },
  output: { schema: AnalyzeQuoteOutputSchema },
  prompt: `أنت خبير في تدقيق عروض أسعار الموردين. مهمتك استخراج أسعار الوحدة لكل صنف مطلوب من المستند المرفق.

الأصناف المطلوبة التي يجب البحث عنها:
{{#each rfqItems}}
- المعرف: {{this.id}}، الاسم: {{this.name}}
{{/each}}

التعليمات:
1. ابحث عن جدول الأسعار في المستند.
2. طابق الأصناف المطلوبة مع الأصناف الموجودة في عرض السعر.
3. استخرج "سعر الوحدة" (Unit Price) بدقة لكل صنف.
4. أرجع النتائج بصيغة JSON المحددة فقط.

المستند للتحليل: {{media url=quoteFileDataUri}}`,
});

export async function analyzeSupplierQuote(input: AnalyzeQuoteInput): Promise<AnalyzeQuoteOutput> {
  try {
    const { output } = await prompt(input);
    if (!output) throw new Error('لم يتمكن الذكاء الاصطناعي من استخراج بيانات صالحة.');
    return output;
  } catch (error: any) {
    console.error("AI Analysis Flow Error:", error);
    throw new Error(`فشل التحليل الذكي: ${error.message}`);
  }
}