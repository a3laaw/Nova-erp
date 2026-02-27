'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * @fileOverview المساعد المحاسبي الذكي باستخدام مكتبة Google الرسمية المباشرة.
 */

const getApiKey = () => process.env.GOOGLE_GENAI_API_KEY || "";

export async function runAccountingAssistant(input: { command: string, currentDate: string }) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("مفتاح الـ API غير متوفر.");

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `أنت مساعد محاسبي خبير في نظام ERP. 
    مهمتك تحويل طلبات المستخدم إلى JSON منظم.
    الأوامر المدعومة: create_journal_entry, create_receipt_voucher, create_payment_voucher.
    التزم دائماً بالقيد المزدوج (Debit = Credit).
    
    التاريخ اليوم: ${input.currentDate}. 
    نفذ الأمر التالي: ${input.command}
    
    التنسيق المطلوب:
    {
      "command": "string",
      "payload": any,
      "explanation": "string (بالعربية)",
      "warnings": string[]
    }`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return JSON.parse(response.text().replace(/```json|```/g, "").trim());
  } catch (error) {
    console.error("Accounting Assistant Error:", error);
    throw new Error("تعذر معالجة الطلب المحاسبي حالياً.");
  }
}
