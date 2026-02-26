'use server';
/**
 * @fileOverview محرك تحليل عروض الأسعار المطور.
 * تم تبسيط الكود لاستخدام ai.generate مباشرة لضمان أعلى استقرار وتجنب أخطاء التنسيق.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AnalyzeQuoteInputSchema = z.object({
  quoteFileDataUri: z.string(),
  rfqItems: z.array(z.object({
    id: z.string(),
    name: z.string()
  })),
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
  try {
    const { output } = await ai.generate({
      model: 'googleai/gemini-1.5-flash',
      output: { 
        schema: AnalyzeQuoteOutputSchema,
        format: 'json'
      },
      prompt: [
        { text: `أنت مساعد محاسبي خبير. استخرج أسعار الوحدة لكل صنف من الأصناف المطلوبة التالية من صورة عرض السعر المرفقة.
        
الأصناف المطلوبة (المعرف - الاسم):
${input.rfqItems.map(i => `${i.id} - ${i.name}`).join('\n')}

التعليمات:
1. ابحث عن السعر المطابق لكل صنف بدقة.
2. إذا وجدت السعر، ضعه في حقل unitPrice.
3. حدد نسبة الثقة (confidence) من 0 إلى 1.
4. لا تخترع أسعاراً غير موجودة.` },
        { media: { url: input.quoteFileDataUri } }
      ]
    });

    if (!output) {
      throw new Error('لم يرجع الذكاء الاصطناعي نتائج صالحة.');
    }

    return output;
  } catch (error: any) {
    console.error("Critical AI Analysis Error:", error);
    throw new Error(`فشل التحليل الذكي: ${error.message}`);
  }
}
