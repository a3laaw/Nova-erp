'use server';
/**
 * @fileOverview محرك تحليل صور عروض الأسعار باستخدام Genkit و Vertex AI.
 * يتميز هذا المحرك بالقدرة على فهم الجداول المحاسبية العربية واستخراج الأسعار بدقة.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

/**
 * وظيفة تحليل عرض السعر (Supplier Quotation Analysis)
 * تقوم بقراءة صورة عرض السعر ومطابقتها مع الأصناف المطلوبة في الـ RFQ.
 */
export async function analyzeSupplierQuote(input: { quoteFileDataUri: string, rfqItems: { id: string, name: string }[] }) {
  try {
    const response = await ai.generate({
      model: 'vertexai/gemini-1.5-flash',
      config: {
        responseMimeType: 'application/json',
      },
      system: `أنت محاسب خبير ومحلل بيانات مالية. مهمتك هي قراءة صورة عرض السعر المرفقة واستخراج البيانات المالية منها بدقة.
      
      المخرجات المطلوبة:
      1. اسم المورد (من الشعار أو الترويسة).
      2. تاريخ العرض.
      3. إجمالي المبلغ (القيمة الكبرى النهائية).
      4. قائمة الأسعار: قم بمطابقة الأصناف الموجودة في الصورة مع القائمة المزودة إليك واستخرج "سعر الوحدة" لكل صنف.
      
      الأصناف المطلوب تسعيرها:
      ${input.rfqItems.map(i => `- ${i.name} (المعرف البرمجي: ${i.id})`).join('\n')}
      
      القاعدة الذهبية: افهم السياق؛ إذا كتب المورد "البيان" فهو يقصد "الصنف"، وإذا كتب "سعر الإفراد" فهو يقصد "سعر الوحدة".`,
      prompt: [
        { text: "حلل صورة جدول عروض الأسعار المرفقة. استخرج: البند، الكمية، السعر. المخرجات يجب أن تكون JSON فقط بالتنسيق التالي:" },
        { text: `{ "vendorName": "...", "date": "YYYY-MM-DD", "totalAmount": 0, "extractedPrices": [ { "rfqItemId": "id", "unitPrice": 0 } ] }` },
        { media: { url: input.quoteFileDataUri } }
      ]
    });

    const output = response.text;
    // تنظيف النص المستخرج لضمان أنه JSON صالح
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("لم يتمكن الذكاء الاصطناعي من توليد بيانات منظمة.");
    
    return JSON.parse(jsonMatch[0]);

  } catch (e: any) {
    console.error("AI Flow Error:", e);
    throw new Error("فشل تحليل المستند. يرجى التأكد من وضوح الصورة أو المحاولة لاحقاً.");
  }
}
