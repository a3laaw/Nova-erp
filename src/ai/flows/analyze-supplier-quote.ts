'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * @fileOverview تحليل عروض أسعار الموردين باستخدام الذكاء الاصطناعي (Gemini Vision).
 * يقوم هذا التدفق باستقبال صورة أو ملف PDF واستخراج أسعار الوحدات للأصناف المطلوبة في RFQ.
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
      generationConfig: { responseMimeType: "application/json" }
    });

    // Extract mime type and base64 data from Data URI
    const parts = input.quoteFileDataUri.split(';base64,');
    if (parts.length !== 2) throw new Error("تنسيق الملف غير صالح.");
    
    const mimeType = parts[0].split(':')[1];
    const base64Data = parts[1];

    const prompt = `أنت خبير مشتريات ومحاسب تكاليف. قم بتحليل ملف عرض السعر المرفق واستخراج أسعار الوحدات (Unit Price) للأصناف المطلوبة التالية حصراً.
    
    الأصناف المطلوبة من نظامنا (RFQ Items):
    ${input.rfqItems.map(item => `- المعرف: ${item.id}, الاسم: ${item.name}`).join('\n')}
    
    المطلوب منك:
    1. قراءة محتوى الصورة/الملف بدقة.
    2. البحث عن كل صنف من الأصناف المذكورة أعلاه (بالاسم أو ما يشابهه سياقياً).
    3. استخراج سعر الوحدة (Unit Price) لهذا الصنف.
    4. إرجاع النتيجة بتنسيق JSON فقط كما هو موضح أدناه.
    
    قواعد مهمة:
    - إذا وجد السعر بعملة غير الدينار الكويتي، حوله أو اتركه كما هو مع التوضيح إذا لزم الأمر، لكن الأولوية للرقم المجرد.
    - إذا لم تجد سعراً واضحاً لصنف معين، لا تدرجه في مصفوفة النتائج.
    
    التنسيق المطلوب للرد (JSON):
    {
      "items": [
        { "rfqItemId": "string (المعرف المذكور أعلاه)", "unitPrice": number }
      ],
      "summary": "ملخص سريع بالعربية لما تم العثور عليه"
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
    const jsonResponse = JSON.parse(response.text().replace(/```json|```/g, "").trim());
    
    return jsonResponse;
  } catch (error) {
    console.error("AI Analysis Error:", error);
    throw new Error("فشل الذكاء الاصطناعي في تحليل المستند. يرجى التأكد من جودة الصورة أو إدخال البيانات يدوياً.");
  }
}
