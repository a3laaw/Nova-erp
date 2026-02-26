'use server';
/**
 * @fileOverview محرك تحليل صور عروض الأسعار - مطور ليكون أكثر استقراراً مع Gemini 1.5 Flash.
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
    system: `أنت خبير في تحليل الفواتير وعروض الأسعار الهندسية باللغة العربية.
    مهمتك استخراج "سعر الوحدة" لكل صنف من القائمة المرفقة.
    يجب أن تكون مخرجاتك بتنسيق JSON فقط دون أي نصوص إضافية.`,
    prompt: [
      { text: `استخرج الأسعار للأصناف التالية من الصورة المرفقة:
      ${input.rfqItems.map(i => `- ${i.name} (المعرف: ${i.id})`).join('\n')}
      
      تنسيق الرد المطلوب:
      { "extractedPrices": [ { "rfqItemId": "المعرف", "unitPrice": السعر_كرقم, "confidence": 0.9 } ] }` },
      { media: { url: input.quoteFileDataUri } }
    ],
  });

  if (!output?.text) throw new Error('لم يستطع الذكاء الاصطناعي قراءة الصورة.');
  
  try {
      const jsonMatch = output.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("تنسيق الرد غير صالح");
      return JSON.parse(jsonMatch[0]) as AnalyzeQuoteOutput;
  } catch (e) {
      console.error("Parse error:", output.text);
      throw new Error("تعذر تحليل بيانات الفاتورة. تأكد من وضوح الصورة.");
  }
}