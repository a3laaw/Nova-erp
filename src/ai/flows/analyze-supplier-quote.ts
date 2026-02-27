'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * @fileOverview محرك تحليل صور عروض الأسعار باستخدام مكتبة Google الرسمية المباشرة.
 * تم تحسينه للتعامل مع أخطاء المفاتيح وتنظيف مخرجات JSON.
 */

const getApiKey = () => process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || "";

export async function analyzeSupplierQuote(input: { 
   quoteFileDataUri: string, 
   rfqItems: { id: string, name: string }[] 
}) {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    throw new Error("مفتاح الـ API (GOOGLE_GENAI_API_KEY) غير موجود في ملف .env");
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { 
        responseMimeType: "application/json",
        temperature: 0.1 // درجة حرارة منخفضة لضمان دقة الأرقام
      }
    });

    // تنظيف بيانات الصورة لاستخراج الـ Base64 الصافي
    const dataParts = input.quoteFileDataUri.split(",");
    if (dataParts.length < 2) throw new Error("صيغة الصورة غير صالحة.");
    
    const base64Data = dataParts[1];
    const mimeType = dataParts[0].split(":")[1].split(";")[0];

    const prompt = `أنت محاسب ومهندس خبير. قم بتحليل صورة جدول عرض السعر المرفقة واستخرج البيانات المالية بدقة كـ JSON.
    المطلوب هو مطابقة الأصناف الموجودة في الصورة مع قائمة الـ RFQ المقدمة: ${JSON.stringify(input.rfqItems)}
    
    التنسيق المطلوب للمخرجات (JSON فقط بدون أي نص إضافي):
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
    const text = response.text();
    
    // تنظيف المخرجات من أي Markdown قد يضيفه Gemini
    const cleanJson = text.replace(/```json|```/g, "").trim();
    
    return JSON.parse(cleanJson);
  } catch (error: any) {
    console.error("Direct AI Error:", error);
    if (error.message?.includes("API_KEY_INVALID")) {
        throw new Error("مفتاح الـ API غير صالح. يرجى التأكد من صلاحية المفتاح في ملف .env");
    }
    throw new Error("فشل التحليل الذكي. تأكد من وضوح الصورة ومن وجود مفتاح الـ API في الإعدادات.");
  }
}
