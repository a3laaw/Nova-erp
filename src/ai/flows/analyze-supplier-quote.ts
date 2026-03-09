'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * @fileOverview محرك تحليل عروض أسعار الموردين باستخدام الرؤية الحاسوبية (Computer Vision).
 * يعالج الصور المرسلة كـ Base64 لاستخراج الأسعار والبيانات المالية فوراً.
 */

const getApiKey = () => process.env.GOOGLE_GENAI_API_KEY || "";

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

    // فصل نوع الملف عن البيانات المشفرة (The "Reading" Solution)
    const [mimePart, base64Data] = input.quoteFileDataUri.split(';base64,');
    const mimeType = mimePart.split(':')[1];

    const prompt = `أنت خبير مشتريات ومحاسب تكاليف دقيق جداً.
قم بتحليل مستند عرض السعر المرفق واستخراج البيانات المطلوبة بشكل JSON فقط.

الأصناف التي نبحث عنها في طلب عرض السعر (RFQ Items):
${input.rfqItems.map(item => `- المعرف: "${item.id}", الاسم المطلوب: "${item.name}"`).join('\n')}

المطلوب استخراج JSON بالصيغة التالية بدقة تامة:
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

ملاحظات رقابية:
1. طابق الأصناف في الصورة مع القائمة المرسلة إليك بناءً على الاسم والمعنى الفني.
2. استخرج سعر الوحدة الصافي لكل بند.
3. إذا وجدت خصماً إجمالياً للمستند، ضعه في discountAmount.
4. إذا لم تجد سعراً لبند معين، لا تضفه في قائمة items لضمان سلامة ميزان المقارنة.`;

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
  } catch (error) {
    console.error("AI Quote Analysis Error:", error);
    throw new Error("فشل التحليل الذكي للمستند. يرجى التأكد من وضوح الصورة ومطابقتها لبنود الطلب.");
  }
}
