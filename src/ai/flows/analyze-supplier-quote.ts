'use server';
/**
 * @fileOverview محرك تحليل صور عروض الأسعار باستخدام Google AI Studio.
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

export async function analyzeSupplierQuote(input: AnalyzeQuoteInput): Promise<AnalyzeQuoteOutput> {
  try {
    const response = await ai.generate({
      model: 'googleai/gemini-1.5-flash',
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
        
        تنسيق الرد المطلوب (JSON فقط):
        {
          "extractedPrices": [
            { "rfqItemId": "المعرف هنا", "unitPrice": 150.5, "confidence": 0.95 }
          ],
          "notes": "أي ملاحظات إضافية"
        }` },
        { media: { url: input.quoteFileDataUri } }
      ],
      config: {
        temperature: 0.1,
      }
    });

    const rawText = response.text;
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Could not find JSON in response");
    
    return JSON.parse(jsonMatch[0]) as AnalyzeQuoteOutput;

  } catch (e: any) {
    console.error("AI Analysis Error:", e.message);
    throw new Error("فشل تحليل الصورة. يرجى التأكد من وضوح البيانات أو إدخالها يدوياً.");
  }
}
