'use server';
/**
 * @fileOverview محرك تحليل صور عروض الأسعار.
 * يستخرج الأسعار من صور الفواتير ويربطها بأصناف طلب التسعير.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AnalyzeQuoteInputSchema = z.object({
  quoteFileDataUri: z.string().describe("صورة عرض السعر كـ Data URI"),
  rfqItems: z.array(z.object({
    id: z.string(),
    name: z.string()
  })).describe("الأصناف المطلوب تسعيرها"),
});

const AnalyzeQuoteOutputSchema = z.object({
  extractedPrices: z.array(z.object({
    rfqItemId: z.string(),
    unitPrice: z.number(),
    confidence: z.number()
  })),
  notes: z.string().optional()
});

export type AnalyzeQuoteInput = z.infer<typeof AnalyzeQuoteInputSchema>;
export type AnalyzeQuoteOutput = z.infer<typeof AnalyzeQuoteOutputSchema>;

export async function analyzeSupplierQuote(input: AnalyzeQuoteInput): Promise<AnalyzeQuoteOutput> {
  const { output } = await ai.generate({
    model: 'googleai/gemini-1.5-flash',
    prompt: [
      { text: `استخرج سعر الوحدة لكل صنف من الصورة المرفقة. 
      الأصناف المطلوبة: ${input.rfqItems.map(i => `${i.name} (ID: ${i.id})`).join(', ')}` },
      { media: { url: input.quoteFileDataUri } }
    ],
    output: { format: 'json', schema: AnalyzeQuoteOutputSchema }
  });

  if (!output) throw new Error('فشل استخراج البيانات من الصورة');
  return output;
}
