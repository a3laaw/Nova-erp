'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * @fileOverview خبير النظام الذكي مع معالجة أخطاء الحصص المتقدمة.
 */

const getApiKey = () => process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || "";

export async function askSystemExpert(input: { question: string, history?: any[] }) {
  const apiKey = getApiKey();
  if (!apiKey) return { answer: "خطأ: مفتاح الـ API غير معرّف في النظام." };

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      systemInstruction: "أنت المساعد الذكي لنظام Nova ERP. مهمتك هي مساعدة المستخدم في استخدام النظام والإجابة على استفساراته حول البيانات. كن مهذباً ومختصراً في إجاباتك باللغة العربية."
    });

    const chat = model.startChat({
      history: input.history?.map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.content }],
      })) || [],
    });

    const result = await chat.sendMessage(input.question);
    const response = await result.response;
    
    return { answer: response.text() };
  } catch (error: any) {
    console.error("System Expert Error:", error);
    
    if (error.message?.includes('429') || error.message?.includes('Resource has been exhausted')) {
        return { answer: "عذراً، خادم الذكاء الاصطناعي مشغول حالياً بسبب تجاوز حصة الطلبات المجانية. يرجى المحاولة مرة أخرى خلال دقائق." };
    }
    
    return { answer: "عذراً، واجهت مشكلة في معالجة سؤالك. يرجى المحاولة مرة أخرى لاحقاً." };
  }
}
