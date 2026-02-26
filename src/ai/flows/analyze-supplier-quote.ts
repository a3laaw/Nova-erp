'use server';
/**
 * @fileOverview محرك تحليل عروض الأسعار المطور.
 * تم تحديث الموديل واستخدام الهيكلية المستقرة لضمان نجاح التحليل.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AnalyzeQuoteInputSchema = z.object({
  quoteFileDataUri: z.string().describe("صورة عرض السعر بصيغة Data URI"),
  rfqItems: z.array(z.object({
    id: z.string(),
    name: z.string()
  })).describe("الأصناف المطلوب استخراج أسعارها"),
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
        { text: `أنت مساعد محاسبي خبير في قراءة عروض أسعار الموردين العربية.
        قم باستخراج "سعر الوحدة" لكل صنف من الأصناف التالية المذكورة في الصورة المرفقة.
        
الأصناف المطلوبة (المعرف - الاسم):
${input.rfqItems.map(i => `${i.id} - ${i.name}`).join('\n')}

التعليمات:
1. ابحث عن السعر المطابق لكل صنف بدقة من الصورة.
2. أرجع النتيجة كقائمة JSON تحتوي على المعرف (rfqItemId) والسعر (unitPrice).
3. حدد نسبة الثقة (confidence) لكل سعر مستخرج (من 0 إلى 1).
4. إذا لم تجد سعراً لصنف ما، ضع السعر 0.
5. لا تضف أي نص شرح خارج الـ JSON.` },
        { media: { url: input.quoteFileDataUri } }
      ]
    });

    if (!output) {
      throw new Error('لم يتمكن الذكاء الاصطناعي من قراءة البيانات. يرجى التأكد من وضوح الصورة ومطابقتها للأصناف.');
    }

    return output;
  } catch (error: any) {
    console.error("AI Analysis Error:", error);
    // إرجاع رسالة خطأ تقنية واضحة للتشخيص
    throw new Error(`فشل التحليل الذكي: ${error.message}`);
  }
}
