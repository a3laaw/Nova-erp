'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * @fileOverview المساعد المحاسبي مع تحسين معالجة الأخطاء.
 */

const getApiKey = () => process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || "";

export async function runAccountingAssistant(input: { command: string, currentDate: string }) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("مفتاح الـ API غير متوفر.");

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `أنت مساعد محاسبي في نظام ERP. حول الطلب التالي إلى JSON:
    ${input.command}
    التاريخ: ${input.currentDate}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return JSON.parse(response.text().replace(/```json|```/g, "").trim());
  } catch (error: any) {
    console.error("Accounting Assistant Error:", error);
    throw new Error(`خطأ في معالجة الطلب المحاسبي: ${error.message}`);
  }
}
