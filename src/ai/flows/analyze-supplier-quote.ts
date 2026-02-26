'use server';
/**
 * @fileOverview محرك تحليل صور عروض الأسعار المطور.
 * تم تحسينه لحل خطأ plugin is not a function عبر تحديد contentType وتطهير JSON.
 */

import { ai } from '../genkit';

export async function analyzeSupplierQuote(input: { 
  quoteFileDataUri: string, 
  rfqItems: { id: string, name: string }[] 
}) {
  try {
    const response = await ai.generate({
      config: {
        responseMimeType: 'application/json',
      },
      system: `أنت محاسب ومهندس خبير. استخرج البيانات من عرض السعر وطابقها مع معرفات RFQ المقدمة.`,
      prompt: [
        { text: "حلل صورة الجدول المستخرج. استخرج: البند، الكمية، السعر. المخرجات JSON فقط بهذا التنسيق:" },
        { text: `{ "vendorName": "...", "date": "YYYY-MM-DD", "totalAmount": 0, "extractedPrices": [ { "rfqItemId": "id", "unitPrice": 0 } ] }` },
        { 
          media: { 
            url: input.quoteFileDataUri, 
            contentType: 'image/jpeg' // ضروري جداً لتجنب خطأ plugin is not a function
          } 
        }
      ]
    });

    const output = response.text;
    
    // تنظيف المخرجات من أي علامات Markdown قد يضيفها الموديل لضمان نجاح الـ Parse
    const cleanJson = output.replace(/```json|```/g, '').trim();
    
    return JSON.parse(cleanJson);

  } catch (e: any) {
    console.error("AI Flow Error:", e);
    throw new Error("حدث خطأ في معالجة الصورة، يرجى التأكد من تحديث المكتبات وتجربة صورة أكثر وضوحاً.");
  }
}
