'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * @fileOverview محرك تحديد أولويات المهام باستخدام المكتبة الرسمية المباشرة.
 */

const getApiKey = () => process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || "";

export async function suggestTaskPrioritization(input: { projectTimeline: string, dependencies: string, resourceAvailability: string }) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API Key missing");

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `أنت مساعد ذكي للمهندسين. قم بترتيب أولويات المهام بناءً على المعطيات التالية:
    الجدول الزمني: ${input.projectTimeline}
    الاعتمادات: ${input.dependencies}
    توفر الموارد: ${input.resourceAvailability}
    
    قدم قائمة مرتبة مع شرح الأسباب باللغة العربية.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return { prioritizedTasks: response.text() };
  } catch (error) {
    console.error("Prioritization AI Error:", error);
    throw new Error("تعذر تحديد الأولويات حالياً.");
  }
}
