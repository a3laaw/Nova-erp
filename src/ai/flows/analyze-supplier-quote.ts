'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * @fileOverview محرك تحليل عروض أسعار الموردين باستخدام الرؤية الحاسوبية (Computer Vision).
 */

const getApiKey = () => process.env.GOOGLE_GENAI_API_KEY || "";

export async function analyzeSupplierQuote(input: {
  quoteFileDataUri: string;
  rfqItems: { id: string; name: string }[];
}) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("مفتاح الـ API غير متوفر.");

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const [mimePart, base64Data] = input.quoteFileDataUri.split(';base64,');
    const mimeType = mimePart.split(':')[1];

    const prompt = `أنت خبير مشتريات ومحاسب تكاليف دقيق. قم بتحليل مستند عرض السعر المرفق واستخراج البيانات التالية.

الأصناف التي نبحث عنها (RFQ Items):
${input.rfqItems.map(item => `- المعرف: "${item.id}", الاسم المطلوب: "${item.name}"`).join('\n')}

المطلوب استخراج JSON بالصيغة التالية:
{
  "items": [
    { "rfqItemId": "المعرف المطابق من القائمة أعلاه", "unitPrice": 123.45 }
  ],
  "discountAmount": 0.0, 
  "deliveryFees": 0.0,
  "deliveryTimeDays": 0,
  "paymentTerms": "شرح طريقة الدفع (بالعربية)",
  "summary": "ملخص سريع لما وجدته (بالعربية)"
}

ملاحظات:
1. طابق الأصناف في الصورة مع القائمة المرسلة إليك بناءً على الاسم والمعنى.
2. استخرج سعر الوحدة الصافي.
3. ابحث عن أي خصومات إجمالية أو مصاريف شحن وتوصيل.
4. إذا لم تجد بنداً معيناً، لا تضفه في قائمة items.`;

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
    return JSON.parse(response.text());
  } catch (error) {
    console.error("AI Analysis Error:", error);
    throw new Error("فشل التحليل الذكي للمستند. تأكد من وضوح الصورة.");
  }
}
