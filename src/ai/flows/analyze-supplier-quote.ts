'use server';
/**
 * @fileOverview AI flow to analyze supplier quote documents (PDF/Images) and extract unit prices.
 * نستخدم تقنية Multimodal في Gemini لقراءة الصور والملفات مباشرة واستخراج الجداول.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AnalyzeQuoteInputSchema = z.object({
  quoteFileDataUri: z.string().describe("The quote document as a data URI (PDF or Image). Format: 'data:<mimetype>;base64,<encoded_data>'."),
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

export async function analyzeSupplierQuote(input: AnalyzeQuoteInput): Promise<AnalyzeQuoteOutput> {
  return analyzeSupplierQuoteFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeSupplierQuotePrompt',
  input: { schema: AnalyzeQuoteInputSchema },
  output: { schema: AnalyzeQuoteOutputSchema },
  config: {
    temperature: 0.1,
  },
  prompt: `أنت مدقق مشتريات محترف. مهمتك استخراج أسعار الوحدة لكل صنف مطلوب من عرض السعر المرفق.

الأصناف المطلوبة (ابحث عن هذه الأسماء أو ما يشابهها في المستند):
{{#each rfqItems}}
- ID: {{this.id}}, Name: {{this.name}}
{{/each}}

التعليمات:
1. قم بمسح المستند المرفق (صورة أو PDF) بدقة.
2. ابحث عن جدول الأسعار وطابق الأصناف المطلوبة مع الأصناف الموجودة في عرض السعر.
3. استخرج "سعر الوحدة" (Unit Price) لكل صنف.
4. إذا لم تجد صنفاً معيناً، لا تضعه في قائمة النتائج.
5. أرجع النتيجة فقط بصيغة JSON المطلوبة.

المستند: {{media url=quoteFileDataUri}}`,
});

const analyzeSupplierQuoteFlow = ai.defineFlow(
  {
    name: 'analyzeSupplierQuoteFlow',
    inputSchema: AnalyzeQuoteInputSchema,
    outputSchema: AnalyzeQuoteOutputSchema,
  },
  async input => {
    try {
      const {output} = await prompt(input);
      if (!output) throw new Error('فشل الذكاء الاصطناعي في استخراج أي بيانات من المستند.');
      return output;
    } catch (error: any) {
      console.error("AI Analysis Flow Error:", error);
      throw new Error(`فشل التحليل: ${error.message}`);
    }
  }
);
