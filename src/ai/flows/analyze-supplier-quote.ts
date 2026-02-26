'use server';
/**
 * @fileOverview محرك تحليل صور عروض الأسعار - نسخة 2026 المستقرة.
 * يقوم باستخراج الأسعار من الصور وربطها بالأصناف المطلوبة مع نظام محاولات متعددة للموديلات.
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
 * قائمة الموديلات المراد تجربتها بالترتيب حسب الاستقرار لعام 2026
 */
const SUPPORTED_MODELS = [
  'googleai/gemini-1.5-flash-002',
  'googleai/gemini-2.0-flash',
  'googleai/gemini-1.5-pro-002'
];

export async function analyzeSupplierQuote(input: AnalyzeQuoteInput): Promise<AnalyzeQuoteOutput> {
  let lastError = null;

  for (const modelName of SUPPORTED_MODELS) {
    try {
      console.log(`Attempting analysis with model: ${modelName}`);
      
      const response = await ai.generate({
        model: modelName,
        system: `أنت خبير تقني في تحليل عروض الأسعار الهندسية والمقاولات باللغة العربية.
        مهمتك هي استخراج "سعر الوحدة" (Unit Price) لكل صنف مطلوب بناءً على الصورة المرفقة.
        
        قواعد التحليل:
        1. ابحث عن اسم الصنف أو ما يشابهه في الصورة.
        2. استخرج سعر الوحدة كرقـم فقط.
        3. إذا لم تجد سعراً لصنف معين، اجعل قيمته null وأضف ملاحظة.
        4. تجاهل الضرائب أو الإجماليات، ركز فقط على سعر الوحدة الصافي.
        5. الرد يجب أن يكون كائن JSON صالح فقط، بدون أي شرح إضافي.`,
        prompt: [
          { text: `استخرج الأسعار للأصناف التالية من صورة عرض السعر:
          ${input.rfqItems.map(i => `- ${i.name} (المعرف البرمجي: ${i.id})`).join('\n')}
          
          تنسيق الرد المطلوب (JSON):
          {
            "extractedPrices": [
              { "rfqItemId": "المعرف هنا", "unitPrice": 150.5, "confidence": 0.98 }
            ],
            "notes": "أي ملاحظات عن العملة أو وضوح بنود معينة"
          }` },
          { media: { url: input.quoteFileDataUri } }
        ],
      });

      const rawText = response.text;
      if (!rawText) continue;

      // استخراج الـ JSON باستخدام Regex لضمان الاستقرار
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Could not find JSON in response");
      
      const parsedData = JSON.parse(jsonMatch[0]);
      
      // التأكد من جودة البيانات
      if (parsedData.extractedPrices && Array.isArray(parsedData.extractedPrices)) {
        console.log(`Success with model: ${modelName}`);
        return parsedData as AnalyzeQuoteOutput;
      }

    } catch (e: any) {
      console.warn(`Model ${modelName} failed:`, e.message);
      lastError = e;
      // إذا كان الخطأ ليس 404 (مثل خطأ في الصورة)، توقف فوراً ولا تجرب موديلات أخرى
      if (!e.message.includes('404') && !e.message.includes('not found')) {
        throw e;
      }
    }
  }

  console.error("All models failed analysis.");
  throw new Error(lastError?.message || "تعذر تحليل الصورة باستخدام الموديلات المتاحة. يرجى التأكد من وضوح الصورة.");
}
