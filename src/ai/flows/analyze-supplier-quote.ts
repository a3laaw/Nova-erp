'use server';
/**
 * @fileOverview محرك تحليل صور عروض الأسعار - نسخة 2026 المستقرة للمشتركين.
 * يستخدم نظام المحاولات المتعددة للموديلات لتجنب أخطاء الكوتا (429).
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
    unitPrice: z.number().nullable(),
    confidence: z.number()
  })),
  notes: z.string().optional()
});

export type AnalyzeQuoteInput = z.infer<typeof AnalyzeQuoteInputSchema>;
export type AnalyzeQuoteOutput = z.infer<typeof AnalyzeQuoteOutputSchema>;

/**
 * قائمة الموديلات المخصصة للحسابات المدفوعة (Stable Versions)
 */
const SUPPORTED_MODELS = [
  'googleai/gemini-1.5-flash-002', // الأسرع والأكثر استقراراً للحسابات المدفوعة
  'googleai/gemini-1.5-pro-002',   // الأقوى في التحليل في حال تعذر الأول
  'googleai/gemini-2.0-flash'      // نسخة المعاينة المستقرة
];

export async function analyzeSupplierQuote(input: AnalyzeQuoteInput): Promise<AnalyzeQuoteOutput> {
  let lastError = null;

  for (const modelName of SUPPORTED_MODELS) {
    try {
      console.log(`Attempting analysis with stable model: ${modelName}`);
      
      const response = await ai.generate({
        model: modelName,
        system: `أنت خبير تقني في تحليل عروض الأسعار الهندسية والمقاولات باللغة العربية.
        مهمتك هي استخراج "سعر الوحدة" (Unit Price) لكل صنف مطلوب بناءً على الصورة المرفقة.
        
        قواعد التحليل:
        1. ابحث عن اسم الصنف أو ما يشابهه في الصورة.
        2. استخرج سعر الوحدة كرقـم فقط.
        3. إذا لم تجد سعراً لصنف معين، اجعل قيمته null.
        4. الرد يجب أن يكون كائن JSON صالح فقط.`,
        prompt: [
          { text: `استخرج الأسعار للأصناف التالية من صورة عرض السعر:
          ${input.rfqItems.map(i => `- ${i.name} (المعرف: ${i.id})`).join('\n')}
          
          تنسيق الرد (JSON):
          {
            "extractedPrices": [
              { "rfqItemId": "المعرف هنا", "unitPrice": 150.5, "confidence": 0.95 }
            ],
            "notes": "أي ملاحظات إضافية"
          }` },
          { media: { url: input.quoteFileDataUri } }
        ],
        config: {
          temperature: 0.1, // لضمان دقة الأرقام
        }
      });

      const rawText = response.text;
      if (!rawText) continue;

      // استخراج الـ JSON وتنظيفه
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Could not find JSON in response");
      
      const parsedData = JSON.parse(jsonMatch[0]);
      
      if (parsedData.extractedPrices && Array.isArray(parsedData.extractedPrices)) {
        return parsedData as AnalyzeQuoteOutput;
      }

    } catch (e: any) {
      console.warn(`Model ${modelName} encountered an issue:`, e.message);
      lastError = e;
      // إذا كان الخطأ هو الكوتا (429)، ننتقل فوراً للموديل التالي (عادة Pro لديه كوتا أعلى)
      if (e.message.includes('429') || e.message.includes('404')) {
        continue;
      }
      throw e; // خطأ آخر غير الكوتا يتطلب توقفاً
    }
  }

  throw new Error("فشل التحليل بعد تجربة كافة الموديلات المتاحة. يرجى التحقق من حالة الدفع في Google Cloud Console.");
}
