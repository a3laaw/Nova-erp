'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * @fileOverview محرك تحليل صور عروض الأسعار باستخدام مكتبة Google الرسمية المباشرة.
 */

// استخدام المفتاح من ملف البيئة
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY || "");

export async function analyzeSupplierQuote(input: { 
   quoteFileDataUri: string, 
   rfqItems: { id: string, name: string }[] 
}) {
  try {
    // تهيئة الموديل مباشرة (gemini-1.5-flash)
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    // تنظيف بيانات الصورة لاستخراج Base64 والـ MimeType
    const parts = input.quoteFileDataUri.split(",");
    const base64Data = parts[1];
    const mimeType = parts[0].split(":")[1].split(";")[0];

    const prompt = `أنت محاسب ومهندس خبير. قم بتحليل صورة جدول عرض السعر المرفقة واستخرج البيانات المالية بدقة كـ JSON.
    المطلوب هو مطابقة الأصناف الموجودة في الصورة مع قائمة الـ RFQ المقدمة: ${JSON.stringify(input.rfqItems)}
    
    التنسيق المطلوب للمخرجات:
    {
      "vendorName": "string",
      "date": "YYYY-MM-DD",
      "totalAmount": number,
      "extractedPrices": [ 
        { 
          "rfqItemId": "string (معرف الصنف من القائمة أعلاه)", 
          "unitPrice": number 
        } 
      ]
    }`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      }
    ]);

    const response = await result.response;
    const text = response.text();
    
    return JSON.parse(text);
  } catch (error) {
    console.error("Direct AI Analysis Error:", error);
    throw new Error("فشل التحليل الذكي لعرض السعر. يرجى التأكد من وضوح الصورة وتوفر مفتاح الـ API.");
  }
}