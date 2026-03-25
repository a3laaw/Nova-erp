'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * @fileOverview المساعد المحاسبي مع معالجة ذكية لأخطاء تجاوز الحصة.
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
    const text = response.text().replace(/```json|```/g, "").trim();
    return JSON.parse(text);
  } catch (error: any) {
    console.error("Accounting Assistant Error:", error);
    
    // التعامل مع خطأ تجاوز الحصة 429
    if (error.message?.includes('429') || error.message?.includes('Resource has been exhausted')) {
        throw new Error("عذراً، تم تجاوز حصة الطلبات المجانية للذكاء الاصطناعي حالياً. يرجى المحاولة بعد قليل أو ترقية الحساب.");
    }
    
    throw new Error(`خطأ في معالجة الطلب المحاسبي: ${error.message}`);
  }
}
