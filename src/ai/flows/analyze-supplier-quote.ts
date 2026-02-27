'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * @fileOverview محرك تحليل صور عروض الأسعار باستخدام مكتبة Google الرسمية المباشرة.
 */

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY || "");

export async function analyzeSupplierQuote(input: { 
   quoteFileDataUri: string, 
   rfqItems: { id: string, name: string }[] 
}) {
  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const base64Data = input.quoteFileDataUri.split(",")[1];
    const mimeType = input.quoteFileDataUri.split(",")[0].split(":")[1].split(";")[0];

    const prompt = `أنت محاسب ومهندس خبير. قم بتحليل صورة جدول عرض السعر المرفقة واستخرج البيانات المالية بدقة كـ JSON.
    المطلوب هو مطابقة الأصناف الموجودة في الصورة مع قائمة الـ RFQ المقدمة: ${JSON.stringify(input.rfqItems)}
    
    التنسيق المطلوب للمخرجات:
    {
      "vendorName": "string",
      "date": "YYYY-MM-DD",
      "totalAmount": number,
      "extractedPrices": [ 
        { 
          "rfqItemId": "string", 
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
    return JSON.parse(response.text());
  } catch (error) {
    console.error("Direct AI Error:", error);
    throw new Error("فشل التحليل الذكي. يرجى التحقق من مفتاح الـ API وصيغة الصورة.");
  }
}
