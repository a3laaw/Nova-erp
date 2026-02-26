'use server';
/**
 * @fileOverview محرك تحليل صور عروض الأسعار - النسخة فائقة الاستقرار.
 * يقوم باستخراج الأسعار من الصور وربطها بالأصناف المطلوبة مع معالجة يدوية للـ JSON لتجنب أخطاء الـ API.
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
  // استخدام استدعاء نصي مباشر لضمان التوافق مع النسخة المستقرة V1 وتجنب خطأ 400
  const response = await ai.generate({
    model: 'googleai/gemini-1.5-flash',
    system: `أنت خبير في تحليل الفواتير وعروض الأسعار الهندسية.
    مهمتك استخراج "سعر الوحدة" لكل صنف من القائمة المرفقة بناءً على الصورة المزودة.
    يجب أن يكون ردك عبارة عن كائن JSON فقط داخل النص، بدون أي نصوص توضيحية خارج الـ JSON.`,
    prompt: [
      { text: `استخرج الأسعار للأصناف التالية من الصورة المرفقة بدقة عالية:
      ${input.rfqItems.map(i => `- ${i.name} (المعرف: ${i.id})`).join('\n')}
      
      تنسيق الرد المطلوب هو كائن JSON بهذا الهيكل تماماً:
      {
        "extractedPrices": [
          { "rfqItemId": "المعرف هنا", "unitPrice": السعر_كرقم, "confidence": 0.95 }
        ],
        "notes": "أي ملاحظات حول الوضوح أو العملة"
      }` },
      { media: { url: input.quoteFileDataUri } }
    ],
  });

  const rawText = response.text;
  if (!rawText) throw new Error('لم يستطع الموديل قراءة البيانات من الصورة.');

  try {
    // استخراج الـ JSON من الرد النصي باستخدام Regex لضمان العمل حتى لو أضاف الموديل علامات Markdown
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("تنسيق البيانات المستخرجة غير صالح.");
    
    const parsedData = JSON.parse(jsonMatch[0]);
    
    // التأكد من أن البيانات تطابق الهيكل المطلوب
    if (!parsedData.extractedPrices || !Array.isArray(parsedData.extractedPrices)) {
        throw new Error("البيانات المستخرجة ناقصة.");
    }

    return parsedData as AnalyzeQuoteOutput;
  } catch (e) {
    console.error("AI Stable Parsing Error. Raw response was:", rawText);
    throw new Error("تعذر تحليل الأسعار بدقة. يرجى التأكد من وضوح صورة عرض السعر ومطابقتها للأصناف.");
  }
}
