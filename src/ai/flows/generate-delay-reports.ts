'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * @fileOverview محرك توليد تقارير التأخير باستخدام المكتبة الرسمية المباشرة.
 */

const getApiKey = () => process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || "";

export async function generateDelayReport(input: { projectTimelineData: string, currentDate: string }) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API Key missing");

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `أنت خبير في إدارة المشاريع الهندسية. قم بتحليل بيانات الجدول الزمني التالية وتوليد تقرير عن التأخيرات:
    
    بيانات المشروع: ${input.projectTimelineData}
    تاريخ اليوم: ${input.currentDate}
    
    المطلوب:
    1. تحديد المراحل المتأخرة.
    2. حساب مدة التأخير.
    3. اقتراح إجراءات تصحيحية باللغة العربية.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return { delayReport: response.text() };
  } catch (error) {
    console.error("Delay Report AI Error:", error);
    throw new Error("تعذر توليد تقرير التأخير حالياً.");
  }
}
