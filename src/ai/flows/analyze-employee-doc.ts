'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * @fileOverview محرك تحليل وثائق الموظفين مع تحسين تبليغ الأخطاء التقنية.
 */

const getApiKey = () => process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || "";

export async function analyzeEmployeeDocument(input: {
  fileDataUri: string;
}) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("مفتاح الـ API غير متوفر في إعدادات البيئة.");

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
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
  "fullName": "الاسم الكامل بالعربية",
  "nameEn": "Full name in English",
  "civilId": "الرقم المدني",
  "nationality": "الجنسية",
  "dob": "YYYY-MM-DD",
  "residencyExpiry": "YYYY-MM-DD",
  "gender": "male or female",
  "summary": "ملخص سريع"
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
    console.error("AI Employee Doc Analysis Error:", error);
    // تمرير الرسالة الأصلية من جوجل للمستخدم للتشخيص
    throw new Error(error.message || "فشل التحليل الذكي للوثيقة.");
  }
}
