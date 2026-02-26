'use server';
/**
 * @fileOverview AI flow to analyze supplier quote documents (PDF/Images) and extract unit prices.
 * This flow is optimized for the v1 stable API.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AnalyzeQuoteInputSchema = z.object({
  quoteFileDataUri: z.string().describe("The quote document as a data URI. Format: 'data:<mimetype>;base64,<encoded_data>'."),
  rfqItems: z.array(z.object({
    id: z.string(),
    name: z.string()
  })).describe("The list of items to match in the document."),
});
export type AnalyzeQuoteInput = z.infer<typeof AnalyzeQuoteInputSchema>;

const AnalyzeQuoteOutputSchema = z.object({
  extractedPrices: z.array(z.object({
    rfqItemId: z.string(),
    unitPrice: z.number().describe("Extracted numeric unit price."),
    confidence: z.number().describe("Score between 0 and 1.")
  })),
  notes: z.string().optional().describe("Any extra notes from the AI."),
});
export type AnalyzeQuoteOutput = z.infer<typeof AnalyzeQuoteOutputSchema>;

export async function analyzeSupplierQuote(input: AnalyzeQuoteInput): Promise<AnalyzeQuoteOutput> {
  return analyzeSupplierQuoteFlow(input);
}

const analyzeSupplierQuoteFlow = ai.defineFlow(
  {
    name: 'analyzeSupplierQuoteFlow',
    inputSchema: AnalyzeQuoteInputSchema,
    outputSchema: AnalyzeQuoteOutputSchema,
  },
  async input => {
    // We define the prompt inside the flow or use a simpler generate call to ensure v1 compatibility
    const response = await ai.generate({
      model: 'googleai/gemini-1.5-flash',
      input: input,
      output: { schema: AnalyzeQuoteOutputSchema },
      prompt: [
        { text: `أنت مساعد مشتريات محترف. مهمتك استخراج أسعار الوحدة لكل صنف من عرض السعر المرفق باللغة العربية أو الإنجليزية.` },
        { text: `المطلوب البحث عن هذه الأصناف وتحديد سعر الوحدة (Unit Price) لكل منها:` },
        ...input.rfqItems.map(item => ({ text: `- ID: ${item.id}, Name: ${item.name}` })),
        { media: { url: input.quoteFileDataUri } },
        { text: `الرجاء إرجاع النتائج بصيغة JSON فقط، مع استخراج الأرقام بدقة. إذا لم تجد سعراً لصنف معين، لا تضعه في القائمة.` }
      ],
    });

    if (!response.output) {
      throw new Error('فشل استخراج البيانات من المستند.');
    }
    return response.output;
  }
);
