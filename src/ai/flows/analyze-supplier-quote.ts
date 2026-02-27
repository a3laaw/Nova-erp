'use server';
/**
 * @fileOverview محرك تحليل صور عروض الأسعار المطور.
 * يستخدم الموديل المستورد مباشرة ويقوم بتنظيف بيانات Base64 لضمان أعلى دقة.
 */

import { ai } from '../genkit';
import { gemini15Flash } from '@genkit-ai/googleai';

export async function analyzeSupplierQuote(input: { 
  quoteFileDataUri: string, 
  rfqItems: { id: string, name: string }[] 
}) {
  try {
    // تنظيف الـ Data URI لاستخراج Base64 صافي كما طلب المستخدم
    const base64Data = input.quoteFileDataUri.includes(',') 
      ? input.quoteFileDataUri.split(',')[1] 
      : input.quoteFileDataUri;

    const response = await ai.generate({
      model: gemini15Flash, // استخدام المتغير المستورد بدلاً من النص
      prompt: [
        { text: "أنت محاسب ومهندس خبير ومحلل بيانات. قم بقراءة صورة جدول عروض الأسعار المرفقة. حلل الجدول وحوله لـ JSON فقط بالتنسيق التالي:" },
        { text: `{ "vendorName": "...", "date": "YYYY-MM-DD", "totalAmount": 0, "extractedPrices": [ { "rfqItemId": "id", "unitPrice": 0 } ] }` },
        { 
          media: { 
            url: `data:image/jpeg;base64,${base64Data}`, 
            contentType: 'image/jpeg' // تحديد نوع المحتوى بدقة
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
    throw new Error("حدث خطأ في معالجة الصورة، يرجى التأكد من وضوح الصورة وتوافق إصدارات المكتبات.");
  }
}
