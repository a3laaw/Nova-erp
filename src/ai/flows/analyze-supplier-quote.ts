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
      model: 'googleai/gemini-1.5-flash',
      prompt: [
        { text: "أنت محاسب ومهندس خبير ومحلل بيانات. قم بقراءة صورة جدول عروض الأسعار المرفقة. حلل الجدول وحوله لـ JSON فقط بالتنسيق التالي:" },
        { text: `{ "vendorName": "...", "date": "YYYY-MM-DD", "totalAmount": 0, "extractedPrices": [ { "rfqItemId": "id", "unitPrice": 0 } ] }` },
        { 
          media: { 
            url: input.quoteFileDataUri, 
            contentType: 'image/jpeg' 
          } 
        }
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const output = response.text;
    
    // تنظيف المخرجات من أي علامات Markdown قد يضيفها الموديل لضمان نجاح الـ Parse
    const cleanJson = output.replace(/```json|```/g, '').trim();
    
    return JSON.parse(cleanJson);

  } catch (e: any) {
    console.error("AI Flow Error:", e);
    throw new Error("حدث خطأ في معالجة الصورة، يرجى التأكد من وضوح الصورة والمحاولة مرة أخرى.");
  }
}
