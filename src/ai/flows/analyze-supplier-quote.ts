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
      config: {
        responseMimeType: 'application/json',
      },
      system: `أنت محاسب ومهندس خبير ومحلل بيانات. القاعدة الذهبية: ابحث عن القيم (المورد، الأصناف، الأسعار) مهما كانت المسميات (مثلا 'البيان' بدل 'الصنف'). استخرج البيانات وطابقها مع معرفات RFQ المقدمة.`,
      prompt: [
        { text: "حلل صورة الجدول المستخرج. استخرج: البند، الكمية، السعر. المخرجات JSON فقط بهذا التنسيق:" },
        { text: `{ "vendorName": "...", "date": "YYYY-MM-DD", "totalAmount": 0, "extractedPrices": [ { "rfqItemId": "id", "unitPrice": 0 } ] }` },
        { 
          media: { 
            url: input.quoteFileDataUri, 
            contentType: 'image/jpeg' 
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
    throw new Error("حدث خطأ في معالجة الصورة، يرجى التأكد من وضوح الصورة والمحاولة مرة أخرى.");
  }
}
