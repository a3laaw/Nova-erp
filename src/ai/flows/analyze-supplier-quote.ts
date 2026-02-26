'use server';
/**
 * @fileOverview محرك تحليل صور عروض الأسعار باستخدام Gemini 1.5 Flash.
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
      { text: `أنت خبير في استخراج البيانات من فواتير الموردين باللغة العربية.
      المهمة: استخرج سعر الوحدة (Unit Price) لكل صنف من الأصناف المذكورة أدناه والموجودة في صورة الفاتورة المرفقة.
      
      الأصناف المطلوب البحث عنها:
      ${input.rfqItems.map(i => `- ${i.name} (ID: ${i.id})`).join('\n')}
      
      المخرجات المطلوبة:
      يجب أن يكون الرد بصيغة JSON فقط، ويحتوي على مصفوفة extractedPrices، كل عنصر فيها يحتوي على:
      - rfqItemId: معرف الصنف من القائمة أعلاه.
      - unitPrice: السعر المستخرج كرقم.
      - confidence: نسبة الثقة في الاستخراج (0-1).
      
      التزم بالصيغة التالية بدقة:
      { "extractedPrices": [{ "rfqItemId": "...", "unitPrice": 0.0, "confidence": 0.95 }] }` },
      { media: { url: input.quoteFileDataUri } }
    ],
  });

  if (!output?.text) throw new Error('فشل استخراج البيانات من الصورة');
  
  try {
      // تنظيف الرد لاستخراج الـ JSON فقط في حال وجود نصوص زائدة
      const jsonMatch = output.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
          return JSON.parse(jsonMatch[0]) as AnalyzeQuoteOutput;
      }
      throw new Error("تنسيق الرد غير صالح");
  } catch (e) {
      console.error("Parse error:", output.text);
      throw new Error("تعذر تحليل بيانات الفاتورة بشكل صحيح.");
  }
}
