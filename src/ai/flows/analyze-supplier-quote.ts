'use server';
/**
 * @fileOverview AI flow to analyze supplier quote documents (PDF/Images) and extract unit prices.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AnalyzeQuoteInputSchema = z.object({
  quoteFileDataUri: z.string().describe("The quote document as a data URI (PDF or Image). Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
  rfqItems: z.array(z.object({
    id: z.string(),
    name: z.string()
  })).describe("The list of items we are looking for in the supplier's quote."),
});
export type AnalyzeQuoteInput = z.infer<typeof AnalyzeQuoteInputSchema>;

const AnalyzeQuoteOutputSchema = z.object({
  extractedPrices: z.array(z.object({
    rfqItemId: z.string(),
    unitPrice: z.number().describe("The extracted unit price from the document."),
    confidence: z.number().describe("Confidence score between 0 and 1.")
  })),
  currency: z.string().optional().describe("Detected currency in the document."),
  notes: z.string().optional().describe("Any extra notes or warnings from the AI."),
});
export type AnalyzeQuoteOutput = z.infer<typeof AnalyzeQuoteOutputSchema>;

export async function analyzeSupplierQuote(input: AnalyzeQuoteInput): Promise<AnalyzeQuoteOutput> {
  return analyzeSupplierQuoteFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeSupplierQuotePrompt',
  model: 'googleai/gemini-1.5-flash',
  input: { schema: AnalyzeQuoteInputSchema },
  output: { schema: AnalyzeQuoteOutputSchema },
  config: {
    temperature: 0.1,
  },
  prompt: `You are a professional procurement auditor AI specialized in extracting prices from Arabic and English supplier quotations.

أنت مدقق مشتريات محترف. مهمتك استخراج أسعار الوحدة من عرض أسعار المورد.

Match the items in the document to the following items (ابحث عن هذه الأصناف في المستند):
{{#each rfqItems}}
- ID: {{this.id}}, Name: {{this.name}}
{{/each}}

Instructions / التعليمات:
1. Scan the document (image or PDF) and find the table or list of prices / افحص المستند وابحث عن جدول الأسعار
2. For each item in my list, find the corresponding unit price / لكل صنف، ابحث عن سعر الوحدة المقابل
3. If the supplier used a slightly different name, use your reasoning to find the best match / إذا استخدم المورد اسم مختلف قليلاً، استخدم الذكاء للمطابقة
4. Extract the numeric price only (remove currency symbols) / استخرج الرقم فقط بدون رمز العملة
5. Return ONLY the unit prices for the requested IDs in JSON format / أرجع فقط الأسعار بصيغة JSON
6. If an item is not found, do not include it / إذا لم تجد صنف، لا تضمنه في النتيجة
7. Common Arabic terms: د.ك (دينار كويتي), ر.س (ريال سعودي), ج.م (جنيه مصري)

Document: {{media url=quoteFileDataUri}}`,
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
      if (!output) {
        throw new Error('Failed to analyze the document. No data extracted.');
      }
      return output;
    } catch (error: any) {
      console.error("AI Analysis Flow Error:", error);
      throw new Error(`AI Analysis failed: ${error.message}`);
    }
  }
);
