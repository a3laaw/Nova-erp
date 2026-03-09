'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * @fileOverview محرك تحليل عروض الأسعار مع التعرف على أخطاء الحصص والفوترة.
 */

const getApiKey = () => process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || "";

export async function analyzeSupplierQuote(input: {
  quoteFileDataUri: string;
  rfqItems: { id: string; name: string }[];
}) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("مفتاح الـ API للذكاء الاصطناعي غير متوفر.");

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const [mimePart, base64Data] = input.quoteFileDataUri.split(';base64,');
    const mimeType = mimePart.split(':')[1];

    const prompt = `تحليل عرض السعر المستخرج من الصورة.
الأصناف المطلوبة:
${input.rfqItems.map(item => `- ${item.name} (ID: ${item.id})`).join('\n')}

المطلوب JSON:
{
  "items": [{ "rfqItemId": "string", "unitPrice": number }],
  "discountAmount": number,
  "deliveryFees": number,
  "deliveryTimeDays": number,
  "paymentTerms": "string",
  "summary": "string"
}`;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mimeType,
          data: base64Data
        }
      },
      { text: prompt }
    ]);

    const response = await result.response;
    const text = response.text().replace(/```json|```/g, "").trim();
    return JSON.parse(text);
  } catch (error: any) {
    console.error("AI Quote Analysis Error:", error);
    
    if (error.message?.includes('429') || error.message?.includes('Resource has been exhausted')) {
        throw new Error("تنبيه: تم استنفاد حصة الطلبات المجانية. يرجى تحويل مفتاح الـ API إلى 'مدفوع' لضمان عمل تحليل الصور بكفاءة.");
    }
    
    throw new Error(`خطأ AI: ${error.message}`);
  }
}
