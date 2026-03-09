'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * @fileOverview محرك تحليل وثائق الموظفين (البطاقة المدنية / الجواز) باستخدام الذكاء الاصطناعي.
 * تم التحديث لضمان التوافق مع النسخة المستقرة من Gemini 2.0 Flash.
 */

const getApiKey = () => process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || "";

export async function analyzeEmployeeDocument(input: {
  fileDataUri: string;
}) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("مفتاح الـ API للذكاء الاصطناعي غير متوفر في ملف .env");

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // نستخدم gemini-2.0-flash لضمان أفضل توافق وأسرع أداء
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      generationConfig: { 
        responseMimeType: "application/json",
        temperature: 0.1,
      }
    });

    const [mimePart, base64Data] = input.fileDataUri.split(';base64,');
    const mimeType = mimePart.split(':')[1];

    const prompt = `أنت خبير في معالجة الوثائق الرسمية الكويتية (بطاقة مدنية، جواز سفر).
قم بتحليل الصورة المرفقة واستخراج البيانات الشخصية منها بدقة تامة.

المطلوب استخراج JSON بالصيغة التالية فقط:
{
  "fullName": "الاسم الكامل بالعربية كما هو في الوثيقة",
  "nameEn": "Full name in English as in the document",
  "civilId": "الرقم المدني المكون من 12 رقم",
  "nationality": "الجنسية (مثال: كويتي، مصري، هندي...)",
  "dob": "تاريخ الميلاد بصيغة YYYY-MM-DD",
  "residencyExpiry": "تاريخ انتهاء البطاقة أو الإقامة بصيغة YYYY-MM-DD",
  "gender": "male or female",
  "summary": "ملخص سريع لما وجدته (بالعربية)"
}

ملاحظات:
1. إذا كانت الوثيقة بطاقة مدنية كويتية، تأكد من استخراج الرقم المدني بدقة.
2. إذا لم تجد حقلاً معيناً، اتركه فارغاً.
3. التزم بصيغة التاريخ المحددة YYYY-MM-DD.`;

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
    if (!response) throw new Error("لم يتم تلقي استجابة من محرك الذكاء الاصطناعي.");

    const text = response.text().replace(/```json|```/g, "").trim();
    return JSON.parse(text);
  } catch (error: any) {
    console.error("AI Document Analysis Error:", error);
    if (error.message?.includes('404')) {
        throw new Error("خطأ 404: النموذج غير متاح لهذا المفتاح. يرجى التأكد من تفعيل Generative Language API في مشروع جوجل الخاص بك.");
    }
    throw new Error(error.message || "فشل التحليل الذكي للوثيقة. تأكد من وضوح الصورة وصلاحية المفتاح.");
  }
}
