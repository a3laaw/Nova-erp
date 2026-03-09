'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * @fileOverview محرك تحليل وثائق الموظفين (البطاقة المدنية / الجواز) باستخدام الذكاء الاصطناعي.
 * يستخرج البيانات الشخصية والتاريخية لتسريع عملية إدخال البيانات.
 */

const getApiKey = () => process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || "";

export async function analyzeEmployeeDocument(input: {
  fileDataUri: string;
}) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("مفتاح الـ API للذكاء الاصطناعي غير متوفر.");

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const [mimePart, base64Data] = input.fileDataUri.split(';base64,');
    const mimeType = mimePart.split(':')[1];

    const prompt = `أنت خبير في معالجة الوثائق الرسمية الكويتية (بطاقة مدنية، جواز سفر).
قم بتحليل الصورة المرفقة واستخراج البيانات الشخصية منها بدقة تامة.

المطلوب استخراج JSON بالصيغة التالية:
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
3. التزم بصيغة التاريخ المحددة.`;

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
    console.error("AI Document Analysis Error:", error);
    throw new Error("فشل التحليل الذكي للوثيقة. يرجى التأكد من وضوح الصورة.");
  }
}
