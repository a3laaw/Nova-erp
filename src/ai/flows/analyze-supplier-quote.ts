'use server';

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

/**
 * @fileOverview تحليل عروض أسعار الموردين باستخدام الذكاء الاصطناعي (Gemini Vision).
 * تم تحسينه لاستخراج JSON بشكل آمن وتجاوز فلاتر الأمان الخاطئة.
 */

const getApiKey = () => process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || "";

export async function analyzeSupplierQuote(input: {
  quoteFileDataUri: string;
  rfqItems: { id: string; name: string }[];
}) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("مفتاح الـ API غير متوفر في إعدادات النظام.");

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { 
        responseMimeType: "application/json",
        temperature: 0.1, // لضمان دقة أعلى في الأرقام
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
      ],
    });

    // Extract mime type and base64 data from Data URI
    const parts = input.quoteFileDataUri.split(';base64,');
    if (parts.length !== 2) throw new Error("تنسيق الملف غير صالح.");
    
    const mimeType = parts[0].split(':')[1];
    const base64Data = parts[1];

    const prompt = `أنت خبير مشتريات ومحاسب تكاليف دقيق جداً. قم بتحليل مستند عرض السعر المرفق واستخراج أسعار الوحدات (Unit Price) للأصناف المطلوبة التالية.
    
    الأصناف المطلوبة (RFQ Items):
    ${input.rfqItems.map(item => `- المعرف الفريد: "${item.id}", اسم الصنف: "${item.name}"`).join('\n')}
    
    المطلوب منك:
    1. ابحث في المستند عن كل صنف يطابق أو يشابه في المعنى الأصناف المذكورة أعلاه.
    2. استخرج سعر الوحدة (Unit Price) المجرد (رقم فقط).
    3. إذا كان السعر بعملة أخرى، حوله للدينار الكويتي إن أمكن أو ضعه كما هو.
    4. أجب بتنسيق JSON فقط ولا تضف أي نص شرح خارج الـ JSON.
    
    التنسيق المطلوب (JSON):
    {
      "items": [
        { "rfqItemId": "المعرف الفريد المذكور أعلاه", "unitPrice": 123.45 }
      ],
      "summary": "ملخص لما وجدته بالعربية"
    }`;

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      },
      { text: prompt }
    ]);

    const response = await result.response;
    const text = response.text();
    
    // محاولة استخراج الـ JSON بشكل آمن حتى لو أضاف النموذج نصوصاً إضافية
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        console.error("AI Response was not valid JSON:", text);
        throw new Error("لم يتمكن الذكاء الاصطناعي من استخراج البيانات بتنسيق صحيح.");
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error: any) {
    console.error("AI Analysis Detailed Error:", error);
    // إذا كان الخطأ متعلق بالأمان
    if (error.message?.includes('SAFETY')) {
        throw new Error("تم حظر الملف بواسطة فلاتر الأمان. يرجى محاولة رفع صورة أوضح أو إدخال البيانات يدوياً.");
    }
    throw new Error("فشل الذكاء الاصطناعي في تحليل المستند. يرجى التأكد من جودة الصورة أو إدخال البيانات يدوياً.");
  }
}
