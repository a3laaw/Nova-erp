'use server';
/**
 * @fileOverview محرك تحليل صور عروض الأسعار - إصدار فائق الاستقرار.
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
  // الحل الجذري: نستخدم generate بدون تحديد مخرجات منظمة لتجنب خطأ الـ Payload (400 Bad Request)
  const response = await ai.generate({
    model: 'googleai/gemini-1.5-flash',
    system: `أنت خبير في تحليل الفواتير وعروض الأسعار الهندسية باللغة العربية.
    مهمتك استخراج "سعر الوحدة" لكل صنف من القائمة المرفقة بناءً على الصورة المزودة.
    يجب أن يكون ردك عبارة عن كائن JSON فقط ولا شيء غيره.`,
    prompt: [
      { text: `استخرج الأسعار للأصناف التالية من الصورة:
      ${input.rfqItems.map(i => `- ${i.name} (المعرف البرمجي: ${i.id})`).join('\n')}
      
      تنسيق الرد المطلوب (JSON فقط):
      {
        "extractedPrices": [
          { "rfqItemId": "المعرف البرمجي هنا", "unitPrice": السعر_كرقم, "confidence": 0.95 }
        ],
        "notes": "أي ملاحظات إضافية حول القراءة"
      }` },
      { media: { url: input.quoteFileDataUri } }
    ],
  });

  const rawText = response.text;
  if (!rawText) throw new Error('لم يستطع الموديل استخراج أي نص من الصورة.');

  try {
    // تنظيف النص المستخرج لضمان وجود JSON فقط (إزالة أي Markdown أو نصوص زائدة)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("تنسيق البيانات المستخرجة غير صالح.");
    
    const parsedData = JSON.parse(jsonMatch[0]);
    return parsedData as AnalyzeQuoteOutput;
  } catch (e) {
    console.error("AI Raw Response:", rawText);
    throw new Error("تعذر تحليل بيانات الأسعار بدقة. يرجى التأكد من وضوح صورة الفاتورة.");
  }
}
